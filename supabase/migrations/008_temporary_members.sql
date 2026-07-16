-- =====================
-- TEMPORARY HOUSEHOLD MEMBERS
-- =====================
--
-- Until now membership was all-or-nothing: once profiles.household_id pointed
-- at a household, every domain table's RLS granted full read/write via
-- get_my_household_id(). This migration adds *temporary* members (housesitters,
-- petsitters) who get read/write to only a chosen subset of sections for a
-- defined time window.
--
-- Grantable sections a temporary member may receive:
--   dashboard (always, implicit), tasks, plants, notes, contacts, inventory
-- Sections temporary members are never given (blocked at the DB):
--   projects, calendar (events), budget (categories/transactions),
--   shopping (lists/items)
--
-- Enforcement is done in Postgres (RLS) -- the real security boundary, since
-- pages talk to Supabase directly from the browser. The UI and the proxy.ts
-- route guard layer on top for good UX.

-- =====================
-- SCHEMA
-- =====================

alter table public.household_members
  add column if not exists member_type text not null default 'permanent'
    check (member_type in ('permanent', 'temporary')),
  add column if not exists allowed_sections text[],       -- null => all (permanent)
  add column if not exists access_starts_at timestamptz,  -- null => active immediately
  add column if not exists access_expires_at timestamptz; -- null => never expires

-- A pending invitation carries the grant it will confer on acceptance, so the
-- privileged fields come from the (trusted) inviter, not the invitee.
alter table public.household_invitations
  add column if not exists member_type text not null default 'permanent'
    check (member_type in ('permanent', 'temporary')),
  add column if not exists allowed_sections text[],
  add column if not exists access_starts_at timestamptz,
  add column if not exists access_expires_at timestamptz;

-- =====================
-- HELPERS (security definer to avoid self-referential RLS recursion)
-- =====================

-- Is the current user a permanent member of the given household?
create or replace function public.is_permanent_member(hh uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where user_id = auth.uid()
      and household_id = hh
      and member_type = 'permanent'
  )
$$;

-- Does the current user have access to `section` in their *active* household?
-- Permanent members always do. Temporary members do only while their access
-- window is open and the section is one they were granted (dashboard is always
-- implicitly granted so they have a landing page).
create or replace function public.has_section_access(section text)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where user_id = auth.uid()
      and household_id = public.get_my_household_id()
      and (
        member_type = 'permanent'
        or (
          (access_starts_at is null or access_starts_at <= now())
          and (access_expires_at is null or access_expires_at > now())
          and (
            section = 'dashboard'
            or section = any(coalesce(allowed_sections, '{}'))
          )
        )
      )
  )
$$;

-- =====================
-- DOMAIN-TABLE RLS: add section gating
-- =====================
--
-- Each policy keeps the existing household scope and additionally requires
-- has_section_access(<section>). Permanent members always pass; temporary
-- members pass only for their granted, unexpired sections.

drop policy if exists "projects_all" on public.projects;
create policy "projects_all" on public.projects
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('projects'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('projects'));

drop policy if exists "project_photos_all" on public.project_photos;
create policy "project_photos_all" on public.project_photos
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('projects'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('projects'));

drop policy if exists "tasks_all" on public.tasks;
create policy "tasks_all" on public.tasks
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('tasks'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('tasks'));

drop policy if exists "events_all" on public.events;
create policy "events_all" on public.events
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('calendar'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('calendar'));

drop policy if exists "event_attendees_all" on public.event_attendees;
create policy "event_attendees_all" on public.event_attendees
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('calendar'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('calendar'));

drop policy if exists "budget_categories_all" on public.budget_categories;
create policy "budget_categories_all" on public.budget_categories
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('budget'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('budget'));

drop policy if exists "transactions_all" on public.transactions;
create policy "transactions_all" on public.transactions
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('budget'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('budget'));

drop policy if exists "shopping_lists_all" on public.shopping_lists;
create policy "shopping_lists_all" on public.shopping_lists
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('shopping'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('shopping'));

drop policy if exists "shopping_items_all" on public.shopping_items;
create policy "shopping_items_all" on public.shopping_items
  for all to authenticated
  using (
    public.has_section_access('shopping')
    and exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id
        and sl.household_id = public.get_my_household_id()
    )
  )
  with check (
    public.has_section_access('shopping')
    and exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id
        and sl.household_id = public.get_my_household_id()
    )
  );

drop policy if exists "contacts_all" on public.contacts;
create policy "contacts_all" on public.contacts
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('contacts'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('contacts'));

drop policy if exists "inventory_all" on public.inventory_items;
create policy "inventory_all" on public.inventory_items
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('inventory'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('inventory'));

drop policy if exists "notes_all" on public.notes;
create policy "notes_all" on public.notes
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('notes'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('notes'));

drop policy if exists "plants_all" on public.plants;
create policy "plants_all" on public.plants
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('plants'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('plants'));

drop policy if exists "plant_photos_all" on public.plant_photos;
create policy "plant_photos_all" on public.plant_photos
  for all to authenticated
  using (household_id = public.get_my_household_id() and public.has_section_access('plants'))
  with check (household_id = public.get_my_household_id() and public.has_section_access('plants'));

-- Storage buckets: gate photo access by the same section as the underlying
-- table, so a temporary member without plants/projects can't reach the files.
drop policy if exists "plant_photos_insert" on storage.objects;
create policy "plant_photos_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('plants')
  );
drop policy if exists "plant_photos_select" on storage.objects;
create policy "plant_photos_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('plants')
  );
drop policy if exists "plant_photos_delete" on storage.objects;
create policy "plant_photos_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('plants')
  );

drop policy if exists "project_photos_insert" on storage.objects;
create policy "project_photos_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('projects')
  );
drop policy if exists "project_photos_select" on storage.objects;
create policy "project_photos_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('projects')
  );
drop policy if exists "project_photos_delete" on storage.objects;
create policy "project_photos_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] = public.get_my_household_id()::text
    and public.has_section_access('projects')
  );

-- activity_log: map each action to its section so the dashboard feed can't
-- leak titles from sections a temporary member can't see.
drop policy if exists "activity_log_all" on public.activity_log;
create policy "activity_log_all" on public.activity_log
  for all to authenticated
  using (
    household_id = public.get_my_household_id()
    and public.has_section_access(
      case action_type
        when 'task_completed'    then 'tasks'
        when 'task_created'      then 'tasks'
        when 'note_created'      then 'notes'
        when 'transaction_added' then 'budget'
        when 'shopping_checked'  then 'shopping'
        when 'project_created'   then 'projects'
        when 'event_created'     then 'calendar'
        else 'dashboard'
      end)
  )
  with check (
    household_id = public.get_my_household_id()
    and public.has_section_access(
      case action_type
        when 'task_completed'    then 'tasks'
        when 'task_created'      then 'tasks'
        when 'note_created'      then 'notes'
        when 'transaction_added' then 'budget'
        when 'shopping_checked'  then 'shopping'
        when 'project_created'   then 'projects'
        when 'event_created'     then 'calendar'
        else 'dashboard'
      end)
  );

-- =====================
-- MEMBERSHIP MANAGEMENT
-- =====================
--
-- Does the household already have any members?
create or replace function public.household_has_members(hh uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.household_members where household_id = hh)
$$;

-- Direct self-insert is allowed only for the *first* member of a household --
-- i.e. the person creating it. Every later join goes through a definer RPC
-- (join_household_by_code / accept_invitation) that validates the code or
-- invitation. Previously any authenticated user could self-insert a permanent
-- membership into any household whose id they knew (household ids and invite
-- codes are world-readable), which would let an invited *temporary* sitter
-- escalate to full permanent access. Restricting direct insert to household
-- creation closes that path while keeping "create a household" working.
drop policy if exists "household_members_insert" on public.household_members;
create policy "household_members_insert" on public.household_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and member_type = 'permanent'
    and allowed_sections is null
    and access_starts_at is null
    and access_expires_at is null
    and not public.household_has_members(household_id)
  );

-- Join an existing household by its invite code (permanent membership). Runs as
-- definer so it bypasses the first-member-only insert policy, but only after
-- verifying the code -- so knowing a household id alone is no longer enough.
create or replace function public.join_household_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare hh uuid;
begin
  select id into hh from public.households where upper(invite_code) = upper(trim(p_code));
  if hh is null then
    raise exception 'Invalid invite code';
  end if;
  insert into public.household_members (household_id, user_id, member_type)
  values (hh, auth.uid(), 'permanent')
  on conflict (household_id, user_id) do nothing;
  update public.profiles set household_id = hh where id = auth.uid();
  return hh;
end;
$$;

-- Renaming the household is a permanent-member action; a temporary member's
-- active household is the one they sit for, so gate it on permanent membership
-- (the UI already hides it, this closes the API path too).
drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households
  for update to authenticated using (public.is_permanent_member(id));

-- Only a permanent member may invite; and only temporary invites may carry a
-- grant (a permanent invite confers full membership).
drop policy if exists "household_invitations_insert" on public.household_invitations;
create policy "household_invitations_insert" on public.household_invitations
  for insert to authenticated with check (
    public.is_permanent_member(household_id)
    and invited_by = auth.uid()
  );

-- Accept an invitation: create/refresh the caller's membership copying the
-- grant *from the invitation* (so privileged fields can't be forged by the
-- invitee), mark it accepted, and make it the caller's active household.
create or replace function public.accept_invitation(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  inv public.household_invitations%rowtype;
  my_email text := lower(auth.jwt() ->> 'email');
begin
  select * into inv from public.household_invitations where id = p_invite_id;
  if not found then
    raise exception 'Invitation not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;
  if lower(inv.email) <> my_email then
    raise exception 'This invitation is not addressed to you';
  end if;

  insert into public.household_members
    (household_id, user_id, member_type, allowed_sections, access_starts_at, access_expires_at)
  values
    (inv.household_id, auth.uid(), inv.member_type, inv.allowed_sections, inv.access_starts_at, inv.access_expires_at)
  on conflict (household_id, user_id) do update set
    member_type       = excluded.member_type,
    allowed_sections  = excluded.allowed_sections,
    access_starts_at  = excluded.access_starts_at,
    access_expires_at = excluded.access_expires_at;

  update public.household_invitations set status = 'accepted' where id = p_invite_id;
  update public.profiles set household_id = inv.household_id where id = auth.uid();
end;
$$;

-- Edit a temporary member's grant. Caller must be a permanent member of the
-- household; only temporary members can be edited (a permanent member is never
-- silently downgraded).
create or replace function public.set_temporary_access(
  p_household_id uuid,
  p_user_id uuid,
  p_allowed_sections text[],
  p_starts_at timestamptz,
  p_expires_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_permanent_member(p_household_id) then
    raise exception 'Only a permanent member can manage temporary access';
  end if;

  update public.household_members set
    allowed_sections  = p_allowed_sections,
    access_starts_at  = p_starts_at,
    access_expires_at = p_expires_at
  where household_id = p_household_id
    and user_id = p_user_id
    and member_type = 'temporary';

  if not found then
    raise exception 'No temporary member found to update';
  end if;
end;
$$;

-- Remove a temporary member from a household. Caller must be a permanent
-- member. Clears the removed user's active-household pointer if it referenced
-- this household, so nothing dangles.
create or replace function public.remove_member(p_household_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_permanent_member(p_household_id) then
    raise exception 'Only a permanent member can remove members';
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id
    and member_type = 'temporary';

  update public.profiles set household_id = null
  where id = p_user_id and household_id = p_household_id;
end;
$$;

grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.set_temporary_access(uuid, uuid, text[], timestamptz, timestamptz) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.join_household_by_code(text) to authenticated;
grant execute on function public.is_permanent_member(uuid) to authenticated;
grant execute on function public.has_section_access(text) to authenticated;
grant execute on function public.household_has_members(uuid) to authenticated;
