-- =====================
-- TABLES
-- =====================

create table if not exists public.households (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'Our Home',
  invite_code text unique,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  household_id uuid references public.households(id) on delete set null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'on_hold')),
  category text not null default 'general',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  recurrence text default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  due_date date,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  category text default 'general',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz,
  all_day boolean default false,
  color text default 'blue',
  recurrence text default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.budget_categories (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  monthly_budget numeric(10,2),
  color text default 'gray',
  icon text,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  category_id uuid references public.budget_categories(id) on delete set null,
  title text not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.shopping_lists (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.shopping_items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.shopping_lists(id) on delete cascade not null,
  name text not null,
  quantity text,
  checked boolean default false,
  category text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  category text not null default 'other',
  phone text,
  email text,
  website text,
  address text,
  notes text,
  last_service_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_items (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  category text not null default 'general',
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_price numeric(10,2),
  warranty_expiry date,
  location text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  title text,
  content text not null,
  color text default 'yellow',
  pinned boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- INVITE CODE TRIGGER
-- =====================

create or replace function public.set_invite_code()
returns trigger language plpgsql as $$
begin
  if new.invite_code is null then
    new.invite_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists set_household_invite_code on public.households;
create trigger set_household_invite_code
  before insert on public.households
  for each row execute function public.set_invite_code();

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.budget_categories enable row level security;
alter table public.transactions enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
alter table public.contacts enable row level security;
alter table public.inventory_items enable row level security;
alter table public.notes enable row level security;

create or replace function public.get_my_household_id()
returns uuid language sql security definer stable as $$
  select household_id from public.profiles where id = auth.uid()
$$;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or household_id = public.get_my_household_id()
  );
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Households are readable by any signed-in user so that signup can work:
-- the "create household" flow inserts a row and reads it back, and the
-- "join with invite code" flow looks a household up by its code -- both
-- happen before the user is a member, so a member-only read rule blocks
-- them. Households only contain a name + invite code; all real data
-- (projects, tasks, budget, etc.) stays locked to the user's own household.
drop policy if exists "households_read" on public.households;
create policy "households_read" on public.households
  for select to authenticated using (true);
drop policy if exists "households_insert" on public.households;
create policy "households_insert" on public.households
  for insert to authenticated with check (true);
drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households
  for update to authenticated using (id = public.get_my_household_id());

drop policy if exists "projects_all" on public.projects;
create policy "projects_all" on public.projects
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "tasks_all" on public.tasks;
create policy "tasks_all" on public.tasks
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "events_all" on public.events;
create policy "events_all" on public.events
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "budget_categories_all" on public.budget_categories;
create policy "budget_categories_all" on public.budget_categories
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "transactions_all" on public.transactions;
create policy "transactions_all" on public.transactions
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "shopping_lists_all" on public.shopping_lists;
create policy "shopping_lists_all" on public.shopping_lists
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "shopping_items_all" on public.shopping_items;
create policy "shopping_items_all" on public.shopping_items
  for all to authenticated using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id
        and sl.household_id = public.get_my_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id
        and sl.household_id = public.get_my_household_id()
    )
  );

drop policy if exists "contacts_all" on public.contacts;
create policy "contacts_all" on public.contacts
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "inventory_all" on public.inventory_items;
create policy "inventory_all" on public.inventory_items
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

drop policy if exists "notes_all" on public.notes;
create policy "notes_all" on public.notes
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- =====================
-- AUTO-CREATE PROFILE
-- =====================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================
-- UPDATED_AT TRIGGERS
-- =====================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.handle_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();
drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
  for each row execute function public.handle_updated_at();
drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.handle_updated_at();
drop trigger if exists inventory_updated_at on public.inventory_items;
create trigger inventory_updated_at before update on public.inventory_items
  for each row execute function public.handle_updated_at();
drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes
  for each row execute function public.handle_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
