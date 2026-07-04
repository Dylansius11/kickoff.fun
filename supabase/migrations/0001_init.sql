-- KICK.FUN initial schema (mirrors docs/technical/ERD.md)
-- Apply: supabase db push (or paste into the SQL editor)

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  privy_id text unique,
  wallet_pubkey text,
  handle text not null,
  avatar_url text,
  tournament_points int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists fixtures (
  id bigint primary key,               -- TxLINE fixture id
  home_team text not null,
  away_team text not null,
  group_round text,
  kickoff_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming','live','final')),
  last_snapshot jsonb
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),   -- bridges on-chain Room.room_id
  fixture_id bigint not null references fixtures(id),
  host_user_id uuid references users(id),
  room_code text unique not null,
  status text not null default 'open' check (status in ('open','live','settling','settled','cancelled')),
  visibility text not null default 'private' check (visibility in ('private','public','sponsored')),
  onchain_room_pda text,
  results_hash text,
  settle_tx_sig text,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references users(id),
  points int not null default 0,
  streak int not null default 0,
  rank int,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists props (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  fixture_id bigint not null,
  type text not null,
  prompt text not null,
  options jsonb not null,
  state text not null default 'open' check (state in ('open','locked','under_review','settled','voided')),
  resolution jsonb,
  opens_at timestamptz not null default now(),
  locks_at timestamptz not null,
  settled_at timestamptz
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  prop_id uuid not null references props(id) on delete cascade,
  user_id uuid not null references users(id),
  room_id uuid not null references rooms(id) on delete cascade,
  choice text not null,
  points_awarded int not null default 0,
  is_correct boolean,
  settle_state text not null default 'pending' check (settle_state in ('pending','settled','voided')),
  created_at timestamptz not null default now(),
  unique (prop_id, user_id)
);

create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  room_id uuid references rooms(id),
  pick_id uuid references picks(id),
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists cosmetics (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('oracle_voice','room_theme','card_skin','avatar','badge')),
  name text not null,
  points_cost int not null default 0,
  price_cents int
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  cosmetic_id uuid not null references cosmetics(id),
  unlocked_via text not null check (unlocked_via in ('points','purchase','reward')),
  created_at timestamptz not null default now(),
  unique (user_id, cosmetic_id)
);

create table if not exists oracle_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  type text not null,
  line text not null,
  audio_ref text,
  created_at timestamptz not null default now()
);

create table if not exists sponsor_pots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid unique not null references rooms(id),
  sponsor_name text not null,
  mint text not null,
  amount bigint not null default 0,
  vault_pda text,
  fund_tx_sig text,
  claim_tx_sig text,
  winner_user_id uuid references users(id),
  status text not null default 'unfunded' check (status in ('unfunded','funded','settled','claimed'))
);

-- indexes (ERD §6)
create index if not exists idx_room_members_leaderboard on room_members (room_id, points desc);
create index if not exists idx_picks_prop on picks (prop_id);
create index if not exists idx_picks_user_room on picks (user_id, room_id);
create index if not exists idx_props_room_state on props (room_id, state);
create index if not exists idx_users_tournament on users (tournament_points desc);
create index if not exists idx_fixtures_kickoff on fixtures (kickoff_at, status);

-- points integrity: ledger is the audit source; totals via trigger
create or replace function apply_points_delta() returns trigger as $$
begin
  update users set tournament_points = tournament_points + new.delta where id = new.user_id;
  if new.room_id is not null then
    update room_members set points = points + new.delta
      where room_id = new.room_id and user_id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_points_ledger on points_ledger;
create trigger trg_points_ledger after insert on points_ledger
  for each row execute function apply_points_delta();

-- RLS (ERD §5): clients read their rooms; only service role writes game state
alter table users enable row level security;
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table props enable row level security;
alter table picks enable row level security;
alter table points_ledger enable row level security;
alter table oracle_events enable row level security;
alter table sponsor_pots enable row level security;
alter table inventory enable row level security;
alter table cosmetics enable row level security;
alter table fixtures enable row level security;

create policy read_own_user on users for select using (auth.uid()::text = privy_id or true);
create policy read_fixtures on fixtures for select using (true);
create policy read_cosmetics on cosmetics for select using (true);
create policy member_reads_room on rooms for select using (
  exists (select 1 from room_members m join users u on u.id = m.user_id
          where m.room_id = rooms.id and u.privy_id = auth.uid()::text)
  or visibility = 'public'
);
create policy member_reads_members on room_members for select using (true);
create policy member_reads_props on props for select using (true);
create policy member_reads_picks on picks for select using (true);
create policy member_reads_oracle on oracle_events for select using (true);
create policy member_reads_pots on sponsor_pots for select using (true);
create policy read_own_ledger on points_ledger for select using (true);
create policy read_own_inventory on inventory for select using (true);
-- writes: service_role only (no insert/update policies for anon/authenticated)

-- realtime channels
alter publication supabase_realtime add table props, room_members, oracle_events, sponsor_pots, fixtures;
