create table if not exists public.plants (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  species text,
  room text,
  light_requirement text
    check (light_requirement in ('low', 'medium', 'bright_indirect', 'direct_sun')),
  watering_interval_days integer,
  last_watered_at date,
  acquired_date date,
  toxic_to_pets boolean not null default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plant_photos (
  id uuid default gen_random_uuid() primary key,
  plant_id uuid references public.plants(id) on delete cascade not null,
  household_id uuid references public.households(id) on delete cascade not null,
  photo_url text not null,
  storage_path text not null,
  taken_at date not null default current_date,
  caption text,
  created_at timestamptz default now()
);

alter table public.plants enable row level security;
alter table public.plant_photos enable row level security;

drop policy if exists "plants_all" on public.plants;
create policy "plants_all" on public.plants
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "plant_photos_all" on public.plant_photos;
create policy "plant_photos_all" on public.plant_photos
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop trigger if exists plants_updated_at on public.plants;
create trigger plants_updated_at before update on public.plants
  for each row execute function public.handle_updated_at();

-- Storage bucket for plant growth photos. Public bucket: this app has no
-- other privacy layer beyond RLS, and plant photos aren't sensitive, so a
-- permanent public URL avoids building signed-URL refresh logic for no
-- benefit. Access to upload/list/delete is still restricted by household
-- via the folder-prefix policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plant-photos', 'plant-photos', true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: `${household_id}/${plant_id}/${uuid}-${filename}` — the
-- first folder segment identifies the owning household.

drop policy if exists "plant_photos_insert" on storage.objects;
create policy "plant_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
  );

drop policy if exists "plant_photos_select" on storage.objects;
create policy "plant_photos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
  );

drop policy if exists "plant_photos_delete" on storage.objects;
create policy "plant_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
  );
