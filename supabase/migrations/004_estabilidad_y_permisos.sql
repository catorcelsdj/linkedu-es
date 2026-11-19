-- Linkedu 5 · Aplicar después de 001, 002 y 003. Migración transaccional e idempotente.
-- No elimina tablas ni contenido. Los índices y restricciones se aplican a nuevas escrituras.
begin;

-- Perfil ampliado: conserva los valores existentes y repara columnas ausentes.
alter table public.profiles
  add column if not exists center text default '',
  add column if not exists city text default '',
  add column if not exists education_levels text[] default '{}',
  add column if not exists website text default '',
  add column if not exists social jsonb not null default '{}'::jsonb;

-- El correo de Auth y los códigos de invitación no forman parte de los listados públicos.
revoke select on public.profiles from public, anon, authenticated;
grant select (id,role,full_name,subject_area,bio,avatar_url,center,city,education_levels,website,social,created_at) on public.profiles to authenticated;
revoke update on public.profiles from public, anon, authenticated;
grant update (full_name,role,subject_area,bio,avatar_url,center,city,education_levels,website,social) on public.profiles to authenticated;
revoke select on public.projects from public, anon, authenticated;
grant select (id,owner_id,title,description,is_public,tags,created_at) on public.projects to authenticated;
revoke update on public.projects from public, anon, authenticated;
grant update (title,description,is_public,tags) on public.projects to authenticated;

create or replace function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and owner_id = auth.uid());
$$;
create or replace function public.can_see_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p where p.id = pid and
    (p.is_public or p.owner_id = auth.uid() or public.is_project_member(p.id)));
$$;
drop policy if exists "Ver proyectos" on public.projects;
create policy "Ver proyectos" on public.projects for select to authenticated using (public.can_see_project(id));

-- Una solicitud pendiente no da acceso al perfil privado de otros alumnos.
-- El responsable sí necesita ver el nombre de quien solicita entrar.
create or replace function public.can_see_student(student_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = student_id or exists (
    select 1 from public.project_members member join public.projects p on p.id = member.project_id
    where member.user_id = student_id and (p.owner_id = auth.uid() or
      (member.status = 'aceptado' and public.is_project_member(p.id))));
$$;
drop policy if exists "Privacidad del alumno" on public.profiles;
create policy "Privacidad del alumno" on public.profiles for select to authenticated
  using (auth.uid() = id or (role = 'alumno' and public.can_see_student(id)));

drop policy if exists "Ver miembros" on public.project_members;
create policy "Ver miembros" on public.project_members for select to authenticated
  using (user_id = auth.uid() or public.owns_project(project_id) or (status = 'aceptado' and public.is_project_member(project_id)));
drop policy if exists "Solicitar ingreso o añadir al propietario" on public.project_members;
create policy "Solicitar ingreso o añadir al propietario" on public.project_members for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() in ('docente','alumno') and status = 'pendiente'
    and exists (select 1 from public.projects p where p.id = project_id and p.is_public));
drop policy if exists "Aceptar solicitudes" on public.project_members;
create policy "Aceptar solicitudes" on public.project_members for update to authenticated
  using (public.owns_project(project_id) and user_id <> auth.uid())
  with check (public.owns_project(project_id) and user_id <> auth.uid());
drop policy if exists "Salir o rechazar" on public.project_members;
create policy "Salir o rechazar" on public.project_members for delete to authenticated
  using ((user_id = auth.uid() or public.owns_project(project_id))
    and not exists (select 1 from public.projects p where p.id = project_id and p.owner_id = user_id));
revoke update on public.project_members from public, anon, authenticated;
grant update (status) on public.project_members to authenticated;

-- El propietario se añade en la misma transacción que el proyecto, incluso usando la API directamente.
create or replace function public.add_project_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members(project_id,user_id,status) values (new.id,new.owner_id,'aceptado')
    on conflict (project_id,user_id) do update set status = 'aceptado';
  return new;
end; $$;
drop trigger if exists add_project_owner on public.projects;
create trigger add_project_owner after insert on public.projects for each row execute function public.add_project_owner();
insert into public.project_members(project_id,user_id,status)
  select id,owner_id,'aceptado' from public.projects
  on conflict (project_id,user_id) do update set status = 'aceptado';

create or replace function public.create_project(project_title text, project_description text default '', project_public boolean default true, project_tags text[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare project_id uuid; invitation text;
begin
  if auth.uid() is null or public.my_role() is distinct from 'docente' then raise exception 'Solo los docentes pueden crear proyectos'; end if;
  if project_title is null or char_length(trim(project_title)) not between 4 and 100 then raise exception 'El título necesita entre 4 y 100 caracteres'; end if;
  if char_length(coalesce(project_description,'')) > 600 or cardinality(project_tags) > 8 then raise exception 'La descripción o las etiquetas superan el límite'; end if;
  for attempt in 1..10 loop
    invitation := 'LK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,7));
    begin
      insert into public.projects(owner_id,title,description,is_public,tags,invite_code)
        values(auth.uid(),trim(project_title),trim(coalesce(project_description,'')),coalesce(project_public,true),coalesce(project_tags,'{}'),invitation)
        returning id into project_id;
      return project_id;
    exception when unique_violation then
      if attempt = 10 then raise exception 'No se pudo generar el código. Vuelve a intentarlo'; end if;
    end;
  end loop;
  return null;
end; $$;
create or replace function public.project_invite_code(pid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare invitation text;
begin
  if auth.uid() is null or not (public.owns_project(pid) or public.is_project_member(pid)) then raise exception 'Solo los participantes pueden ver la invitación'; end if;
  select invite_code into invitation from public.projects where id = pid;
  return invitation;
end; $$;
create or replace function public.join_project_by_code(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null or coalesce(public.my_role(),'') not in ('docente','alumno') then raise exception 'Tu rol no puede unirse a proyectos'; end if;
  select id into pid from public.projects where invite_code = upper(trim(code));
  if pid is null then raise exception 'Ese código no existe'; end if;
  insert into public.project_members(project_id,user_id,status) values(pid,auth.uid(),'aceptado')
    on conflict(project_id,user_id) do update set status = 'aceptado';
  return pid;
end; $$;

-- Mensajería: también se comprueba el destinatario; solo read_at es editable.
drop policy if exists "Enviar mensajes (docentes y empresas)" on public.messages;
create policy "Enviar mensajes (docentes y empresas)" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and receiver_id <> auth.uid() and public.my_role() in ('docente','empresa')
    and exists (select 1 from public.profiles p where p.id = receiver_id and p.role in ('docente','empresa')));
revoke update on public.messages from public, anon, authenticated;
grant update (read_at) on public.messages to authenticated;
create or replace function public.messages_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then raise exception 'Solo se puede marcar un mensaje como leído'; end if;
  new.read_at := coalesce(old.read_at,now());
  return new;
end; $$;
alter table public.messages drop constraint if exists messages_content_length;
alter table public.messages add constraint messages_content_length check(char_length(trim(content)) between 1 and 2000) not valid;
create index if not exists idx_messages_thread on public.messages(sender_id,receiver_id,created_at desc,id desc);

-- Un resultado por contacto, sin perder conversaciones al superar los 300 mensajes.
-- SECURITY INVOKER: se aplican las políticas RLS de mensajes y perfiles del usuario.
create or replace function public.message_conversations()
returns table(id uuid, last jsonb, unread bigint, person jsonb)
language sql stable security invoker set search_path = public as $$
  with mine as (
    select m.*, case when sender_id = auth.uid() then receiver_id else sender_id end as peer
    from public.messages m where sender_id = auth.uid() or receiver_id = auth.uid()
  ), latest as (
    select distinct on (peer) * from mine order by peer, created_at desc, id desc
  ), counts as (
    select peer, count(*) as total from mine where receiver_id = auth.uid() and read_at is null group by peer
  )
  select latest.peer,
    jsonb_build_object('id',latest.id,'content',latest.content,'sender_id',latest.sender_id,'receiver_id',latest.receiver_id,'created_at',latest.created_at,'read_at',latest.read_at),
    coalesce(counts.total,0),
    case when p.id is null then null else jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'avatar_url',p.avatar_url,'subject_area',p.subject_area) end
  from latest left join counts on counts.peer = latest.peer left join public.profiles p on p.id = latest.peer
  order by latest.created_at desc, latest.id desc;
$$;

-- Permisos explícitos: funcionan también en proyectos nuevos sin grants por defecto.
grant usage on schema public to authenticated;
grant select,insert,delete on public.project_members,public.resources,public.project_posts,public.messages to authenticated;
grant insert,delete on public.projects to authenticated;
grant update on public.resources to authenticated;
revoke all on function public.create_project(text,text,boolean,text[]), public.project_invite_code(uuid), public.message_conversations(), public.join_project_by_code(text), public.owns_project(uuid), public.can_see_student(uuid), public.can_see_project(uuid), public.is_project_member(uuid), public.my_role() from public, anon;
grant execute on function public.create_project(text,text,boolean,text[]), public.project_invite_code(uuid), public.message_conversations(), public.join_project_by_code(text), public.owns_project(uuid), public.can_see_student(uuid), public.can_see_project(uuid), public.is_project_member(uuid), public.my_role() to authenticated;
revoke all on function public.add_project_owner() from public, anon, authenticated;

-- Publicación Realtime: 003 la añade. Comprobación idempotente en 004 también.
alter table public.messages replica identity full;
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
