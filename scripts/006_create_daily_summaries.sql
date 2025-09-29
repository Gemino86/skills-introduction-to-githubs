-- Create daily summaries view for quick access to productivity metrics
create or replace view public.daily_summaries as
select
  p.id as user_id,
  p.full_name,
  p.email,
  date(tl.timestamp) as date,
  -- Calculate total work time (excluding breaks)
  sum(
    case
      when tl.log_type = 'work_start' then
        extract(epoch from (
          select min(timestamp)
          from public.time_logs tl2
          where tl2.user_id = tl.user_id
            and tl2.log_type in ('work_end', 'break_start')
            and tl2.timestamp > tl.timestamp
        ) - tl.timestamp) / 60
      else 0
    end
  ) as total_work_minutes,
  -- Calculate break time
  sum(
    case
      when tl.log_type = 'break_start' then
        extract(epoch from (
          select min(timestamp)
          from public.time_logs tl2
          where tl2.user_id = tl.user_id
            and tl2.log_type = 'break_end'
            and tl2.timestamp > tl.timestamp
        ) - tl.timestamp) / 60
      else 0
    end
  ) as total_break_minutes,
  -- Core tasks time
  (
    select coalesce(sum(time_spent), 0)
    from public.task_logs
    where user_id = p.id
      and date(completed_at) = date(tl.timestamp)
  ) as core_tasks_minutes,
  -- Diverted tasks time
  (
    select coalesce(sum(time_spent), 0)
    from public.diverted_tasks
    where user_id = p.id
      and date(completed_at) = date(tl.timestamp)
  ) as diverted_tasks_minutes
from public.profiles p
left join public.time_logs tl on p.id = tl.user_id
where p.is_active = true
group by p.id, p.full_name, p.email, date(tl.timestamp);
