-- Linkedu.es · Migración 003: etiquetas, redes sociales, avatares, cambio de rol seguro y mensajería en tiempo real.
-- Ejecutar DESPUÉS de 001 y 002 (Supabase > SQL Editor). Es idempotente.

-- 1. ETIQUETAS en proyectos y recursos (categoría, tecnología, destinatarios)
alter table public.projects  add column if not exists tags text[] not null default '{}';
alter table public.resources add column if not exists tags text[] not null default '{}';
alter table public.projects  drop constraint if exists projects_tags_max;
alter table public.projects  add constraint projects_tags_max check (cardinality(tags) <= 8);
alter table public.resources drop constraint if exists resources_tags_max;
alter table public.resources add constraint resources_tags_max check (cardinality(tags) <= 8);
create index if not exists idx_projects_tags  on public.projects  using gin (tags);
create index if not exists idx_resources_tags on public.resources using gin (tags);

-- 2. REDES SOCIALES en el perfil
alter table public.profiles add column if not exists social jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_social_obj;
alter table public.profiles add constraint profiles_social_obj check (jsonb_typeof(social) = 'object');

-- 3. CAMBIO DE ROL CONTROLADO. Antes cualquiera podía poner role = 'docente' por la API.
--    Ahora solo se permite pasar entre docente y empresa; el alumnado no puede cambiar ni a ni desde su rol.
create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role and not (old.role in ('docente','empresa') and new.role in ('docente','empresa')) then
      raise exception 'No puedes cambiar a ese tipo de cuenta';
    end if;
    if new.id <> old.id or new.email <> old.email then
      raise exception 'Ese dato no se puede modificar';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- 4. AVATARES: bucket público de lectura, escritura solo en la carpeta propia y solo docentes y empresas
--    (por privacidad, el alumnado no sube fotos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Ver avatares" on storage.objects;
drop policy if exists "Subir mi avatar" on storage.objects;
drop policy if exists "Actualizar mi avatar" on storage.objects;
drop policy if exists "Borrar mi avatar" on storage.objects;
create policy "Ver avatares" on storage.objects for select to public using (bucket_id = 'avatars');
create policy "Subir mi avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.my_role() in ('docente','empresa'));
create policy "Actualizar mi avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Borrar mi avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5. REALTIME en mensajes. Las políticas RLS de messages también filtran lo que recibe cada cliente.
alter table public.messages replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
