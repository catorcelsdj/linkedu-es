-- Linkedu 5.1 · Aplicar después de 001–004. Transaccional e idempotente: se puede repetir.
-- Búsqueda sin tildes, edición segura de proyectos y recursos, y avisos de proyecto en tiempo real.
-- No elimina tablas ni contenido. Las restricciones nuevas son NOT VALID: solo se aplican a escrituras nuevas.
begin;

-- 1. BÚSQUEDA SIN TILDES NI MAYÚSCULAS. translate() es inmutable y no requiere extensiones.
create or replace function public.search_text(value text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(coalesce(value, '')), 'áàäâãåéèëêíìïîóòöôõúùüûñçý', 'aaaaaaeeeeiiiiooooouuuuncy')
$$;
alter table public.projects add column if not exists search text
  generated always as (public.search_text(title || ' ' || coalesce(description, ''))) stored;
alter table public.resources add column if not exists search text
  generated always as (public.search_text(title || ' ' || coalesce(description, ''))) stored;
alter table public.profiles add column if not exists search text
  generated always as (public.search_text(full_name || ' ' || coalesce(bio, '') || ' ' || coalesce(center, '') || ' ' || coalesce(city, ''))) stored;
grant select (search) on public.projects to authenticated;
grant select (search) on public.profiles to authenticated;
grant execute on function public.search_text(text) to authenticated;

-- 2. EDICIÓN. Mismos límites que al crear, también si se usa la API directamente.
alter table public.projects drop constraint if exists projects_title_len;
alter table public.projects add constraint projects_title_len check (char_length(trim(title)) between 4 and 100) not valid;
alter table public.projects drop constraint if exists projects_description_len;
alter table public.projects add constraint projects_description_len check (char_length(description) <= 600) not valid;
alter table public.resources drop constraint if exists resources_title_len;
alter table public.resources add constraint resources_title_len check (char_length(trim(title)) between 3 and 120) not valid;
alter table public.resources drop constraint if exists resources_description_len;
alter table public.resources add constraint resources_description_len check (char_length(coalesce(description, '')) <= 500) not valid;
alter table public.resources drop constraint if exists resources_link_http;
alter table public.resources add constraint resources_link_http check (link_url is null or link_url ~* '^https?://') not valid;
-- Solo se editan los datos descriptivos: el responsable, el tipo y el fichero no cambian.
revoke update on public.resources from public, anon, authenticated;
grant update (title, description, subject_area, education_level, tags, link_url) on public.resources to authenticated;
drop policy if exists "Editar mis recursos" on public.resources;
create policy "Editar mis recursos" on public.resources for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Editar mis proyectos" on public.projects;
create policy "Editar mis proyectos" on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant update (title, description, is_public, tags) on public.projects to authenticated;

-- 3. AVISOS DE PROYECTO. Realtime aplica las políticas de lectura: cada persona solo recibe
--    solicitudes de sus proyectos, sus propias aceptaciones y publicaciones de proyectos en los que participa.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_members') then
      alter publication supabase_realtime add table public.project_members;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_posts') then
      alter publication supabase_realtime add table public.project_posts;
    end if;
  end if;
end $$;
create index if not exists idx_members_pending on public.project_members (project_id) where status = 'pendiente';

notify pgrst, 'reload schema';
commit;
