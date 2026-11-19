-- Linkedu 5.2 · Aplicar después de 001–005. Transaccional e idempotente: se puede repetir.
-- Centro de notificaciones: los avisos los crean disparadores en la base de datos, no el navegador,
-- así que llegan aunque la persona no tenga la aplicación abierta y no se pueden falsificar desde la API.
begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('mensaje', 'solicitud', 'union', 'aceptado', 'publicacion')),
  project_id uuid references public.projects(id) on delete cascade,
  preview text not null default '' check (char_length(preview) <= 160),
  count integer not null default 1 check (count > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc, id desc);
create index if not exists idx_notifications_unread on public.notifications (user_id) where read_at is null;

-- Cada persona ve y marca solo sus avisos. Nadie los inserta por la API: solo los disparadores.
alter table public.notifications enable row level security;
drop policy if exists "Ver mis notificaciones" on public.notifications;
create policy "Ver mis notificaciones" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "Marcar mis notificaciones" on public.notifications;
create policy "Marcar mis notificaciones" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Borrar mis notificaciones" on public.notifications;
create policy "Borrar mis notificaciones" on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke all on public.notifications from public, anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notification_preview(value text) returns text
language sql immutable set search_path = '' as $$
  select left(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g'), 160)
$$;

-- Mensajes: un aviso por conversación sin leer; los mensajes seguidos se agrupan y actualizan el aviso.
create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set count = count + 1, created_at = now(), preview = public.notification_preview(new.content)
    where user_id = new.receiver_id and actor_id = new.sender_id and type = 'mensaje' and read_at is null;
  if not found then
    insert into public.notifications (user_id, actor_id, type, preview) values (new.receiver_id, new.sender_id, 'mensaje', public.notification_preview(new.content));
  end if;
  return new;
end; $$;
drop trigger if exists notify_message on public.messages;
create trigger notify_message after insert on public.messages for each row execute function public.notify_message();

-- Al leer una conversación, su aviso de mensajes también queda leído.
create or replace function public.read_message_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.read_at is null and new.read_at is not null then
    update public.notifications set read_at = now()
      where user_id = new.receiver_id and actor_id = new.sender_id and type = 'mensaje' and read_at is null;
  end if;
  return new;
end; $$;
drop trigger if exists read_message_notifications on public.messages;
create trigger read_message_notifications after update of read_at on public.messages for each row execute function public.read_message_notifications();

-- Proyectos: solicitudes y entradas con código (para el responsable) y aceptaciones (para quien entra).
create or replace function public.notify_membership() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select p.owner_id into owner from public.projects p where p.id = new.project_id;
  if owner is null or owner = new.user_id then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, type, project_id)
      values (owner, new.user_id, case when new.status = 'pendiente' then 'solicitud' else 'union' end, new.project_id);
  elsif old.status = 'pendiente' and new.status = 'aceptado' then
    -- Si es la propia persona (entra con el código tras haberlo solicitado), se avisa al responsable.
    if auth.uid() is not distinct from new.user_id then
      insert into public.notifications (user_id, actor_id, type, project_id) values (owner, new.user_id, 'union', new.project_id);
    else
      insert into public.notifications (user_id, actor_id, type, project_id) values (new.user_id, owner, 'aceptado', new.project_id);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists notify_membership on public.project_members;
create trigger notify_membership after insert or update of status on public.project_members for each row execute function public.notify_membership();

-- Publicaciones del muro: avisa al resto de participantes aceptados.
create or replace function public.notify_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, project_id, preview)
    select m.user_id, new.author_id, 'publicacion', new.project_id, public.notification_preview(new.content)
    from public.project_members m
    where m.project_id = new.project_id and m.status = 'aceptado' and m.user_id <> new.author_id;
  return new;
end; $$;
drop trigger if exists notify_post on public.project_posts;
create trigger notify_post after insert on public.project_posts for each row execute function public.notify_post();

revoke all on function public.notify_message(), public.read_message_notifications(), public.notify_membership(), public.notify_post() from public, anon, authenticated;

-- Tiempo real: el contador y el panel se actualizan solos.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
