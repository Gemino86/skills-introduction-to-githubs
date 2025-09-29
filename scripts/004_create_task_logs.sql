-- Create task logs for tracking core tasks completed
create table if not exists public.task_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  core_task_id uuid not null references public.core_tasks(id) on delete cascade,
  time_spent integer not null, -- in minutes
  completed_at timestamp with time zone default now(),
  notes text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.task_logs enable row level security;

-- Users can view their own task logs
create policy "Users can view their own task logs"
  on public.task_logs for select
  using (auth.uid() = user_id);

-- Admins can view all task logs
create policy "Admins can view all task logs"
  on public.task_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Users can insert their own task logs
create policy "Users can insert their own task logs"
  on public.task_logs for insert
  with check (auth.uid() = user_id);

-- Create indexes
create index if not exists task_logs_user_id_idx on public.task_logs(user_id);
create index if not exists task_logs_completed_at_idx on public.task_logs(completed_at);
