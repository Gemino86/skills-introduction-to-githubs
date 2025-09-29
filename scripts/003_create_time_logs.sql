-- Create time logs table for tracking work sessions
create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_type text not null check (log_type in ('work_start', 'work_end', 'break_start', 'break_end')),
  timestamp timestamp with time zone default now(),
  notes text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.time_logs enable row level security;

-- Users can view their own logs
create policy "Users can view their own time logs"
  on public.time_logs for select
  using (auth.uid() = user_id);

-- Admins can view all logs
create policy "Admins can view all time logs"
  on public.time_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Users can insert their own logs
create policy "Users can insert their own time logs"
  on public.time_logs for insert
  with check (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists time_logs_user_id_idx on public.time_logs(user_id);
create index if not exists time_logs_timestamp_idx on public.time_logs(timestamp);
