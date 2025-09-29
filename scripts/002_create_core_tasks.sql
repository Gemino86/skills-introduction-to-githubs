-- Create core tasks table (the 23 task types)
create table if not exists public.core_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  allocated_time integer not null, -- in minutes
  category text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.core_tasks enable row level security;

-- Everyone can read core tasks
create policy "Anyone can view core tasks"
  on public.core_tasks for select
  using (true);

-- Only admins can modify core tasks
create policy "Admins can insert core tasks"
  on public.core_tasks for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update core tasks"
  on public.core_tasks for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Insert the 23 core tasks
insert into public.core_tasks (name, allocated_time, category) values
  ('Validation', 15, 'Registration'),
  ('Document Review', 20, 'Registration'),
  ('Data Entry', 10, 'Registration'),
  ('Quality Check', 15, 'Registration'),
  ('Follow-up Call', 12, 'Communication'),
  ('Email Response', 8, 'Communication'),
  ('Client Meeting', 30, 'Communication'),
  ('Report Generation', 25, 'Documentation'),
  ('File Organization', 10, 'Documentation'),
  ('System Update', 15, 'Technical'),
  ('Database Maintenance', 20, 'Technical'),
  ('Verification Process', 18, 'Registration'),
  ('Approval Workflow', 22, 'Registration'),
  ('Status Update', 10, 'Communication'),
  ('Team Sync', 15, 'Communication'),
  ('Research', 20, 'Analysis'),
  ('Analysis', 25, 'Analysis'),
  ('Planning', 20, 'Planning'),
  ('Scheduling', 12, 'Planning'),
  ('Review Meeting', 30, 'Communication'),
  ('Training Material', 25, 'Documentation'),
  ('Process Improvement', 30, 'Planning'),
  ('Audit', 35, 'Quality')
on conflict (name) do nothing;
