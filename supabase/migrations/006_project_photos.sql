create table if not exists public.project_photos (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  household_id uuid references public.households(id) on delete cascade not null,
  kind text not null check (kind in ('before', 'after')),
  photo_url text not null,
  storage_path text not null,
  created_at timestamptz default now(),
  unique (project_id, kind)
);

alter table public.project_photos enable row level security;

drop policy if exists "project_photos_all" on public.project_photos;
create policy "project_photos_all" on public.project_photos
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- Storage bucket for project before/after photos. Public bucket: this app has
-- no other privacy layer beyond RLS, and project photos aren't sensitive, so a
-- permanent public URL avoids building signed-URL refresh logic for no
-- benefit. Access to upload/list/delete is still restricted by household
-- via the folder-prefix policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-photos', 'project-photos', true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: `${household_id}/${project_id}/${kind}-${uuid}-${filename}`
-- — the first folder segment identifies the owning household.

drop policy if exists "project_photos_insert" on storage.objects;
create policy "project_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
  );

drop policy if exists "project_photos_select" on storage.objects;
create policy "project_photos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
  );

drop policy if exists "project_photos_delete" on storage.objects;
create policy "project_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
  );
