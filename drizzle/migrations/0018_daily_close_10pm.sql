-- Opening cash for the automatic 10 PM closing report
create table if not exists public.pos_shift_float (
  id int primary key default 1 check (id = 1),
  opening_float numeric not null default 1000,
  updated_at timestamptz not null default now()
);
alter table public.pos_shift_float enable row level security;
grant select, insert, update on public.pos_shift_float to authenticated;
drop policy if exists "team manages opening float" on public.pos_shift_float;
create policy "team manages opening float" on public.pos_shift_float
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
insert into public.pos_shift_float (id) values (1) on conflict do nothing;

-- Private scheduler token (no policies = only the server can read it)
create table if not exists public.cron_tokens (name text primary key, token text not null);
alter table public.cron_tokens enable row level security;
revoke all on public.cron_tokens from anon, authenticated;
insert into public.cron_tokens (name, token)
values ('daily_close', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

-- 10:00 PM IST = 16:30 UTC every day
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('daily-close-10pm') where exists (select 1 from cron.job where jobname = 'daily-close-10pm');
select cron.schedule('daily-close-10pm', '30 16 * * *', $$
  select net.http_post(
    url := 'https://fishnfresh.lovable.app/api/public/cron/daily-close',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization', 'Bearer ' || (select token from public.cron_tokens where name = 'daily_close')),
    body := '{}'::jsonb);
$$);

notify pgrst, 'reload schema';