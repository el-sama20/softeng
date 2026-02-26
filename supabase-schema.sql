create table if not exists public.employees (
  id text primary key,
  name text not null,
  role text not null,
  contact text,
  address text,
  daily_rate numeric(10,2) not null default 0,
  joined_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.work_logs (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  work_date date not null,
  description text not null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_logs_employee_id on public.work_logs(employee_id);
create index if not exists idx_work_logs_work_date on public.work_logs(work_date);

alter table public.employees enable row level security;
alter table public.work_logs enable row level security;

-- Demo policy: allow public read/write for anon key in this prototype.
-- Tighten this before production deployment.
drop policy if exists "employees_all" on public.employees;
create policy "employees_all"
on public.employees
for all
using (true)
with check (true);

drop policy if exists "work_logs_all" on public.work_logs;
create policy "work_logs_all"
on public.work_logs
for all
using (true)
with check (true);
