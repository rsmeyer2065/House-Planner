create table if not exists public.event_attendees (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  household_id uuid references public.households(id) on delete cascade not null,
  status text not null default 'attending' check (status in ('attending', 'declined', 'maybe')),
  created_at timestamptz default now(),
  unique (event_id, user_id)
);

alter table public.event_attendees enable row level security;

drop policy if exists "event_attendees_all" on public.event_attendees;
create policy "event_attendees_all" on public.event_attendees
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());
