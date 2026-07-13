-- =====================
-- MULTI-HOUSEHOLD MEMBERSHIP
-- =====================
--
-- Until now a user belonged to exactly one household via the single
-- `profiles.household_id` FK, and every table's RLS keyed off it through
-- `get_my_household_id()`. This migration lets a user belong to many
-- households while keeping `profiles.household_id` as the *active household*
-- pointer -- so all existing domain RLS keeps working untouched. Switching
-- households is just updating that pointer to another household the user is a
-- member of.

-- =====================
-- TABLES
-- =====================

create table if not exists public.household_members (
  household_id uuid references public.households(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'member',   -- reserved for future owner/admin use
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);

create table if not exists public.household_invitations (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now()
);

-- Backfill existing single-household memberships so nobody loses access.
insert into public.household_members (household_id, user_id)
select household_id, id from public.profiles where household_id is not null
on conflict do nothing;

-- =====================
-- HELPERS (security definer to avoid self-referential RLS recursion)
-- =====================

-- Does the current user belong to the given household?
create or replace function public.is_household_member(hh uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where user_id = auth.uid() and household_id = hh
  )
$$;

-- Does the current user share any household with the target user?
create or replace function public.shares_household_with(target uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.household_members m_me
    join public.household_members m_them
      on m_me.household_id = m_them.household_id
    where m_me.user_id = auth.uid()
      and m_them.user_id = target
  )
$$;

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;

-- household_members: read anyone in a household you belong to; only ever
-- add/remove *yourself* (join code / accept invite / leave).
drop policy if exists "household_members_read" on public.household_members;
create policy "household_members_read" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "household_members_insert" on public.household_members;
create policy "household_members_insert" on public.household_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "household_members_delete" on public.household_members;
create policy "household_members_delete" on public.household_members
  for delete to authenticated using (user_id = auth.uid());

-- household_invitations: an invitee (matched by email) or any member of the
-- inviting household can read; members can create/revoke; the invitee can
-- accept/decline.
drop policy if exists "household_invitations_read" on public.household_invitations;
create policy "household_invitations_read" on public.household_invitations
  for select to authenticated using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or public.is_household_member(household_id)
  );

drop policy if exists "household_invitations_insert" on public.household_invitations;
create policy "household_invitations_insert" on public.household_invitations
  for insert to authenticated with check (
    public.is_household_member(household_id)
    and invited_by = auth.uid()
  );

drop policy if exists "household_invitations_update" on public.household_invitations;
create policy "household_invitations_update" on public.household_invitations
  for update to authenticated using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or public.is_household_member(household_id)
  );

drop policy if exists "household_invitations_delete" on public.household_invitations;
create policy "household_invitations_delete" on public.household_invitations
  for delete to authenticated using (public.is_household_member(household_id));

-- =====================
-- PROFILES READ: co-members stay visible across active households
-- =====================
--
-- The old policy exposed profiles sharing your *active* household
-- (household_id = get_my_household_id()). With multi-household, a co-member's
-- active pointer may point at a different household of theirs, which would
-- hide them from your roster. Match on shared membership instead.

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.shares_household_with(id)
  );

-- =====================
-- GUARD THE ACTIVE-HOUSEHOLD POINTER
-- =====================
--
-- App code only ever switches to a household you belong to, but enforce it in
-- the database too: you cannot point profiles.household_id at a household you
-- are not a member of.

create or replace function public.enforce_active_household_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.household_id is not null
     and new.household_id is distinct from old.household_id
     and not exists (
       select 1 from public.household_members
       where user_id = new.id and household_id = new.household_id
     ) then
    raise exception 'Cannot set active household to one you are not a member of';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_active_household on public.profiles;
create trigger profiles_enforce_active_household
  before update on public.profiles
  for each row execute function public.enforce_active_household_membership();
