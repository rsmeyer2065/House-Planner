create table if not exists public.activity_log (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null check (action_type in (
    'task_completed', 'task_created', 'transaction_added',
    'shopping_checked', 'note_created', 'project_created', 'event_created'
  )),
  entity_id uuid,
  entity_title text,
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "activity_log_all" on public.activity_log;
create policy "activity_log_all" on public.activity_log
  for all to authenticated using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());
