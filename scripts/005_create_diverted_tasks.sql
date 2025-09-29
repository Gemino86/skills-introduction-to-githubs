-- Create diverted tasks table (Meeting, Coaching, Training, Compliance Training)
create table if not exists public.diverted_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_type text not null check (task_type in ('Meeting', 'Coaching', 'Training', 'Compliance Training')),
  time_spent integer not null, -- in minutes
  description text,
  completed_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.diverted_tasks enable row level security;

-- Users can view their own diverted tasks
create policy "Users can view their own diverted tasks"
  on public.diverted_tasks for select
  using (auth.uid() = user_id);

-- Admins can view all diverted tasks
create policy "Admins can view all diverted tasks"
  on public.diverted_tasks for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Users can insert their own diverted tasks
create policy "Users can insert their own diverted tasks"
  on public.diverted_tasks for insert
  with check (auth.uid() = user_id);

-- Create indexes
create index if not exists diverted_tasks_user_id_idx on public.diverted_tasks(user_id);
create index if not exists diverted_tasks_completed_at_idx on public.diverted_tasks(completed_at);
