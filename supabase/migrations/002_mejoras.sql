-- Linkedu.es · Migración 002: perfiles ampliados, actividad de proyecto, ficheros, mensajes leídos.
-- Ejecutar DESPUÉS de 001_schema_inicial.sql (Supabase > SQL Editor). Es idempotente.

-- 1. PERFILES: centro, ciudad, etapas educativas, web
alter table public.profiles
  add column if not exists center text default '',
  add column if not exists city text default '',
  add column if not exists education_levels text[] default '{}',
  add column if not exists website text default '';
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (char_length(bio) <= 600);

-- 2. RECURSOS: etapa, fichero en Storage
alter table public.resources
  add column if not exists education_level text default '',
  add column if not exists file_path text,
  add column if not exists file_size integer;
alter table public.resources alter column link_url drop not null;
alter table public.resources drop constraint if exists resources_source_check;
alter table public.resources add constraint resources_source_check check (
  (resource_type = 'external_link' and link_url is not null) or
  (resource_type = 'file' and file_path is not null));

-- 3. MENSAJES: marca de lectura
alter table public.messages add column if not exists read_at timestamptz;
create or replace function public.messages_guard() returns trigger language plpgsql as $$
begin
  if new.content <> old.content or new.sender_id <> old.sender_id or new.receiver_id <> old.receiver_id then
    raise exception 'Solo se puede marcar un mensaje como leído';
  end if;
  return new;
end; $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before update on public.messages for each row execute function public.messages_guard();
drop policy if exists "Marcar mensajes como leídos" on public.messages;
create policy "Marcar mensajes como leídos" on public.messages for update to authenticated
  using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- 4. FUNCIONES AUXILIARES (security definer evita recursión entre políticas)
create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid() and status = 'aceptado') $$;

create or replace function public.can_see_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.projects p where p.id = pid and (p.is_public or p.owner_id = auth.uid()
     or exists (select 1 from public.project_members m where m.project_id = p.id and m.user_id = auth.uid()))) $$;

-- Los miembros de proyectos privados ya no son visibles para todo el mundo
drop policy if exists "Ver miembros" on public.project_members;
create policy "Ver miembros" on public.project_members for select to authenticated using (public.can_see_project(project_id));

-- 5. ACTIVIDAD DE PROYECTO (muro de cada proyecto)
create table if not exists public.project_posts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz default now() not null
);
alter table public.project_posts enable row level security;
drop policy if exists "Ver actividad" on public.project_posts;
drop policy if exists "Publicar actividad" on public.project_posts;
drop policy if exists "Borrar actividad" on public.project_posts;
create policy "Ver actividad" on public.project_posts for select to authenticated using (public.is_project_member(project_id));
create policy "Publicar actividad" on public.project_posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_project_member(project_id));
create policy "Borrar actividad" on public.project_posts for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- 6. ÍNDICES
create index if not exists idx_projects_created on public.projects (created_at desc);
create index if not exists idx_members_user on public.project_members (user_id);
create index if not exists idx_members_project on public.project_members (project_id);
create index if not exists idx_resources_subject on public.resources (subject_area, created_at desc);
create index if not exists idx_posts_project on public.project_posts (project_id, created_at desc);
create index if not exists idx_messages_receiver on public.messages (receiver_id, read_at);
create index if not exists idx_messages_sender on public.messages (sender_id, created_at desc);

-- 7. STORAGE: bucket privado para ficheros (máx. 5 MB, tipos permitidos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('resources', 'resources', false, 5242880, array[
  'application/pdf','image/png','image/jpeg','application/zip','text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Leer ficheros de recursos" on storage.objects;
drop policy if exists "Subir ficheros propios" on storage.objects;
drop policy if exists "Borrar ficheros propios" on storage.objects;
create policy "Leer ficheros de recursos" on storage.objects for select to authenticated using (bucket_id = 'resources');
create policy "Subir ficheros propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text and public.my_role() = 'docente');
create policy "Borrar ficheros propios" on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);
