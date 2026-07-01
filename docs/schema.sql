-- ============================================================================
-- Recall — схема базы данных + защита (RLS) + триггеры.
-- КАК ЗАПУСТИТЬ: Supabase → проект → SQL Editor → New query →
--   вставить ВЕСЬ этот файл → Run. Можно запускать повторно (idempotent).
-- ============================================================================

-- ---------- ТАБЛИЦЫ ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  level text check (level in ('A2','B1','B2','C1','C2')) default 'B1',
  native_lang text default 'ru',
  role text check (role in ('learner','teacher')) default 'learner',
  created_at timestamptz default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  is_shared boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references public.decks(id) on delete cascade,
  front text not null,
  back text,
  example text,
  ipa text,
  audio_url text,
  source text check (source in ('manual','reader','ai')) default 'manual',
  created_at timestamptz default now()
);

create table if not exists public.review_states (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  stability double precision,
  difficulty double precision,
  due timestamptz default now(),
  last_review timestamptz,
  reps int default 0,
  lapses int default 0,
  state text check (state in ('new','learning','review','relearning')) default 'new',
  unique (card_id, user_id)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  level text,
  title text,
  body text,
  type text check (type in ('reading','listening')) default 'reading',
  audio_url text,
  source text default 'ai',
  created_at timestamptz default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  day date default current_date,
  type text,
  items_done int default 0,
  duration_sec int default 0,
  created_at timestamptz default now()
);

-- Для стрика (Фаза 3): одна строка на пользователя+день+тип занятия,
-- чтобы можно было делать upsert с инкрементом счётчиков.
create unique index if not exists activity_log_user_day_type_uidx
  on public.activity_log (user_id, day, type);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  started_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  role text check (role in ('user','assistant','system')),
  content text,
  created_at timestamptz default now()
);

create table if not exists public.writing_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  prompt text,
  text text not null,
  feedback jsonb,
  created_at timestamptz default now()
);

-- ---------- ВКЛЮЧАЕМ RLS (Row Level Security) ----------
alter table public.profiles            enable row level security;
alter table public.decks               enable row level security;
alter table public.cards               enable row level security;
alter table public.review_states       enable row level security;
alter table public.content_items       enable row level security;
alter table public.activity_log        enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.writing_submissions enable row level security;

-- ---------- ПОЛИТИКИ ДОСТУПА ----------
-- Каждый пользователь видит/меняет только свои данные.
-- (drop policy if exists — чтобы скрипт можно было запускать повторно)

-- profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- decks
drop policy if exists "own decks" on public.decks;
create policy "own decks" on public.decks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- cards (карточка принадлежит колоде, которой владеет пользователь)
drop policy if exists "cards via own deck" on public.cards;
create policy "cards via own deck" on public.cards
  for all using (
    exists (select 1 from public.decks d where d.id = cards.deck_id and d.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.decks d where d.id = cards.deck_id and d.owner_id = auth.uid())
  );

-- review_states
drop policy if exists "own review states" on public.review_states;
create policy "own review states" on public.review_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- content_items (общий контент: читать может любой вошедший, добавлять — тоже)
drop policy if exists "read content" on public.content_items;
create policy "read content" on public.content_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "write content" on public.content_items;
create policy "write content" on public.content_items
  for insert with check (auth.role() = 'authenticated');

-- activity_log
drop policy if exists "own activity" on public.activity_log;
create policy "own activity" on public.activity_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations
drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages (через владение беседой)
drop policy if exists "messages via own conversation" on public.messages;
create policy "messages via own conversation" on public.messages
  for all using (
    exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  );

-- writing_submissions
drop policy if exists "own writing" on public.writing_submissions;
create policy "own writing" on public.writing_submissions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- ТРИГГЕР: при регистрации создаём профиль + колоду по умолчанию ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.decks (owner_id, title, description)
  values (new.id, 'Мои слова', 'Слова из чтения и добавленные вручную');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Готово. Таблицы созданы, защита включена, новые пользователи получают профиль и колоду.
