-- Run against a new Supabase project. Demo records are never inserted here.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  birth_date date,
  preferences jsonb not null default '{}'::jsonb,
  bookmarks jsonb not null default '[]'::jsonb,
  read_progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.profile_members (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (profile_id,user_id)
);
create index profile_members_user on public.profile_members(user_id,profile_id);
create function public.can_access_profile(target uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profile_members where profile_id = target and user_id = (select auth.uid()));
$$;
create function public.can_edit_profile(target uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profile_members where profile_id = target and user_id = (select auth.uid()) and role in ('owner','editor'));
$$;
revoke all on function public.can_access_profile(uuid), public.can_edit_profile(uuid) from public,anon;
grant execute on function public.can_access_profile(uuid), public.can_edit_profile(uuid) to authenticated,service_role;

create table public.health_records (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('glucose','pressure','bmi','temperature')),
  value double precision not null check (value > 0 and value < 1501),
  secondary double precision,
  height double precision,
  measured_at timestamptz not null check (measured_at <= now() + interval '1 minute'),
  context text not null default 'Other' check (length(context) <= 100),
  source text not null check (source in ('manual','device')),
  created_at timestamptz not null default now(),
  check (kind <> 'pressure' or (secondary is not null and secondary between 10 and 200 and value between 30 and 300 and value > secondary)),
  check (kind <> 'bmi' or (height is not null and height between 50 and 250 and value between 10 and 500)),
  check (kind <> 'temperature' or value between 15 and 45)
);
create index health_records_profile_date on public.health_records(profile_id,kind,measured_at desc);
create table public.care_tasks (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 140),
  due_at timestamptz not null,
  completed_at timestamptz,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index tasks_profile_due on public.care_tasks(profile_id,due_at);
create table public.devices (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  firmware text,
  calibration jsonb,
  created_at timestamptz not null default now(),
  unique(id,profile_id)
);
create index devices_profile on public.devices(profile_id);
create table public.ble_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  foreign key(device_id,profile_id) references public.devices(id,profile_id) on delete cascade
);
create table public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  session_id uuid,
  side text not null check (side in ('left','right')),
  measured_at timestamptz not null default now(),
  pressure_unit text not null check (pressure_unit in ('relative','kPa')),
  sensors jsonb not null check (jsonb_typeof(sensors) = 'array'),
  temperature_c double precision check (temperature_c between 15 and 45),
  foreign key(device_id,profile_id) references public.devices(id,profile_id) on delete cascade
);
create index sensors_profile_time on public.sensor_readings(profile_id,measured_at desc);
create table public.risk_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  level text not null check (level in ('review_recommended','contact_care_team')),
  reason text not null,
  measurement_ids uuid[] not null,
  clinical_rule_version text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index alerts_profile_time on public.risk_alerts(profile_id,created_at desc);
create table public.educational_content (
  id text primary key,
  title text not null,
  category text not null,
  body jsonb not null,
  sources jsonb not null,
  reviewed_by text,
  reviewed_at timestamptz,
  published boolean not null default false
);
create table public.subscriptions (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('active','expired','revoked')),
  provider text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index subscription_profile_status on public.subscriptions(profile_id,status,expires_at);
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  included_history boolean not null,
  consent_version text not null,
  created_at timestamptz not null default now()
);
create index ai_requests_user_time on public.ai_requests(user_id,created_at desc);
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  messages jsonb not null default '[]'::jsonb
);
-- Conversations are not persisted by default. Configure an approved retention policy first.
alter table public.profiles enable row level security;
alter table public.profile_members enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (public.can_access_profile(id));
create policy profiles_update on public.profiles for update to authenticated using (public.can_edit_profile(id)) with check (public.can_edit_profile(id));
create policy memberships_read on public.profile_members for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.profiles,public.profile_members from anon,authenticated;
grant select on public.profiles,public.profile_members to authenticated;
grant update(name,preferences,bookmarks,read_progress) on public.profiles to authenticated;

do $$ declare tbl text; begin
  foreach tbl in array array['health_records','care_tasks','devices','ble_sessions','sensor_readings','risk_alerts','subscriptions','ai_conversations'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('create policy member_read on public.%I for select to authenticated using (public.can_access_profile(profile_id))',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
  end loop;
  foreach tbl in array array['health_records','care_tasks','devices','ble_sessions','sensor_readings'] loop
    execute format('create policy member_insert on public.%I for insert to authenticated with check (public.can_edit_profile(profile_id))',tbl);
    execute format('grant insert on public.%I to authenticated',tbl);
  end loop;
end $$;
-- Health records and measured sensor history are append-only from the client.
create policy tasks_update on public.care_tasks for update to authenticated using (public.can_edit_profile(profile_id)) with check (public.can_edit_profile(profile_id));
grant update(title,due_at,completed_at) on public.care_tasks to authenticated;
create policy device_update on public.devices for update to authenticated using (public.can_edit_profile(profile_id)) with check (public.can_edit_profile(profile_id));
grant update(name) on public.devices to authenticated;
create policy session_update on public.ble_sessions for update to authenticated using (public.can_edit_profile(profile_id)) with check (public.can_edit_profile(profile_id));
grant update(ended_at) on public.ble_sessions to authenticated;
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon,authenticated;
alter table public.educational_content enable row level security;
create policy published_content on public.educational_content for select to anon,authenticated using (published);
grant select on public.educational_content to anon,authenticated;
-- No client can create risk alerts, assign membership or grant premium entitlements.

create function public.create_initial_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid;
begin
  insert into public.profiles(owner_id,name) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'My profile'),60)) returning id into profile_uuid;
  insert into public.profile_members(profile_id,user_id,role) values(profile_uuid,new.id,'owner');
  return new;
end $$;
revoke all on function public.create_initial_profile() from public,anon,authenticated;
create trigger create_neem_profile after insert on auth.users for each row execute procedure public.create_initial_profile();

create function public.save_profile_changes(target_profile uuid, records jsonb, tasks jsonb, prefs jsonb, saved jsonb, progress jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  if not public.can_edit_profile(target_profile) then raise exception 'Profile access denied' using errcode='42501'; end if;
  if jsonb_typeof(records) <> 'array' or jsonb_typeof(tasks) <> 'array' or jsonb_array_length(records) > 50 or jsonb_array_length(tasks) > 100 then raise exception 'Invalid update'; end if;
  if jsonb_typeof(prefs) <> 'object' or jsonb_typeof(saved) <> 'array' or jsonb_typeof(progress) <> 'object' then raise exception 'Invalid preferences'; end if;
  for item in select * from jsonb_array_elements(records) loop
    if item->>'source' <> 'manual' then raise exception 'Manual records only'; end if;
    insert into public.health_records(id,profile_id,kind,value,secondary,height,measured_at,context,source)
    values(item->>'id',target_profile,item->>'kind',(item->>'value')::double precision,(item->>'secondary')::double precision,(item->>'height')::double precision,(item->>'at')::timestamptz,item->>'context','manual')
    on conflict(id) do nothing;
  end loop;
  for item in select * from jsonb_array_elements(tasks) loop
    insert into public.care_tasks(id,profile_id,title,due_at,completed_at)
    values(item->>'id',target_profile,item->>'title',(item->>'dueAt')::timestamptz,(item->>'completedAt')::timestamptz)
    on conflict(id) do update set title=excluded.title,due_at=excluded.due_at,completed_at=excluded.completed_at where public.care_tasks.profile_id=target_profile;
  end loop;
  update public.profiles set preferences=prefs,bookmarks=saved,read_progress=progress where id=target_profile;
end $$;
revoke all on function public.save_profile_changes(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_profile_changes(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

-- Atomic daily AI quota, used only by the authenticated edge function's service client.
create function public.reserve_ai_request(subject uuid,target uuid,with_history boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(subject::text));
  if (select count(*) from public.ai_requests where user_id=subject and created_at > now()-interval '24 hours') >= 30 then return false; end if;
  insert into public.ai_requests(user_id,profile_id,included_history,consent_version) values(subject,target,with_history,'2026-10-21');
  return true;
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,boolean) to service_role;
grant all on public.profiles,public.profile_members,public.health_records,public.care_tasks,public.devices,public.ble_sessions,public.sensor_readings,public.risk_alerts,public.educational_content,public.subscriptions,public.ai_requests,public.ai_conversations to service_role;
