-- Pets: the household's animals and everything a pet/house sitter needs to
-- care for them — feeding, walks, litter, medications, vet and emergency
-- contacts. `pets` is a temp-grantable section (see 008), so a sitter can be
-- invited with time-limited access to just this section.

create table if not exists public.pets (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,

  -- Identity
  name text not null,
  species text not null default 'dog'
    check (species in ('dog', 'cat', 'bird', 'fish', 'reptile', 'small_mammal', 'other')),
  breed text,
  sex text check (sex in ('male', 'female', 'unknown')),
  birthdate date,
  weight text,
  color_markings text,
  microchip_id text,

  -- Single profile photo, kept on the row rather than in a child table.
  photo_url text,
  photo_storage_path text,

  -- Feeding
  food_type text
    check (food_type in ('dry', 'wet', 'both', 'raw', 'prescription', 'other')),
  food_brand text,
  food_amount text,
  feeding_schedule text,
  feeding_notes text,
  allergies text,

  -- Dogs
  walk_required boolean not null default false,
  walk_schedule text,
  walk_notes text,

  -- Cats
  litter_box_location text,
  litter_cleaning_interval_days integer,
  litter_notes text,

  -- Who to call
  vet_name text,
  vet_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,

  behavior_notes text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pet_medications (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references public.pets(id) on delete cascade not null,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  dosage text,
  schedule text,
  instructions text,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now()
);

create index if not exists pet_medications_pet_id_idx on public.pet_medications(pet_id);

alter table public.pets enable row level security;
alter table public.pet_medications enable row level security;

drop policy if exists "pets_all" on public.pets;
create policy "pets_all" on public.pets
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('pets'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('pets'));

drop policy if exists "pet_medications_all" on public.pet_medications;
create policy "pet_medications_all" on public.pet_medications
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('pets'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('pets'));

drop trigger if exists pets_updated_at on public.pets;
create trigger pets_updated_at before update on public.pets
  for each row execute function public.handle_updated_at();

-- Storage bucket for pet profile photos. Public bucket, matching the existing
-- plant/project buckets: this app has no privacy layer beyond RLS, and a
-- permanent public URL avoids building signed-URL refresh logic for no
-- benefit. Upload/list/delete stay restricted by household and by section
-- access via the folder-prefix policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos', 'pet-photos', true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: `${household_id}/${pet_id}/${uuid}-${filename}` — the first
-- folder segment identifies the owning household.

drop policy if exists "pet_photos_insert" on storage.objects;
create policy "pet_photos_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('pets')
  );

drop policy if exists "pet_photos_select" on storage.objects;
create policy "pet_photos_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('pets')
  );

drop policy if exists "pet_photos_delete" on storage.objects;
create policy "pet_photos_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('pets')
  );
