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
    lang text not null default 'en',
    created_at timestamptz default now()
  );

  -- Мультиязычность (объединение с испанским приложением, 2026-07-07):
  -- у колоды появился язык. Для баз, созданных до этого, добавляем колонку.
  alter table public.decks add column if not exists lang text not null default 'en';
  alter table public.decks drop constraint if exists decks_lang_check;
  alter table public.decks add constraint decks_lang_check check (lang in ('en','es'));

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

  -- ---------- ТРИГГЕР: при регистрации создаём профиль + колоды по умолчанию ----------
  -- Две колоды: английская и испанская (по одной на язык).
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

    insert into public.decks (owner_id, title, description, lang)
    values
      (new.id, 'Мои слова',    'Английские слова из чтения и добавленные вручную', 'en'),
      (new.id, 'Mis palabras', 'Испанские слова из паков, чтения и добавленные вручную', 'es');

    return new;
  end;
  $$;

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

  -- ---------- ДОЗАПОЛНЕНИЕ: испанская колода для уже существующих пользователей ----------
  -- (idempotent: пропускает тех, у кого испанская колода уже есть)
  insert into public.decks (owner_id, title, description, lang)
  select p.id, 'Mis palabras', 'Испанские слова из паков, чтения и добавленные вручную', 'es'
  from public.profiles p
  where not exists (
    select 1 from public.decks d where d.owner_id = p.id and d.lang = 'es'
  );

  -- Готово. Таблицы созданы, защита включена, новые пользователи получают
  -- профиль и две колоды (en + es); существующим добавлена испанская колода.

  -- ============================================================================
  -- ФАЗА 4: режим «Преподаватель». Блок idempotent — можно запускать повторно.
  -- ============================================================================

  -- Код-приглашение преподавателя (ученица вводит его на Главной)
  alter table public.profiles add column if not exists invite_code text unique;

  -- Связь преподаватель — ученица
  create table if not exists public.teacher_students (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now(),
    unique (teacher_id, student_id),
    check (teacher_id <> student_id)
  );

  -- Назначение колоды ученице (ученица видит карточки, расписание у неё своё)
  create table if not exists public.deck_assignments (
    id uuid primary key default gen_random_uuid(),
    deck_id uuid not null references public.decks(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now(),
    unique (deck_id, student_id)
  );

  alter table public.teacher_students enable row level security;
  alter table public.deck_assignments enable row level security;

  -- Хелперы security definer: политики decks<->deck_assignments ссылаются друг
  -- на друга; без обхода RLS внутри подзапроса Postgres падает с
  -- «infinite recursion detected in policy».
  create or replace function public.deck_assigned_to(d_id uuid, s_id uuid)
  returns boolean language sql security definer set search_path = public as
  $$ select exists (select 1 from deck_assignments
                    where deck_id = d_id and student_id = s_id) $$;

  create or replace function public.deck_owned_by(d_id uuid, u_id uuid)
  returns boolean language sql security definer set search_path = public as
  $$ select exists (select 1 from decks where id = d_id and owner_id = u_id) $$;

  create or replace function public.is_student_of(t_id uuid, s_id uuid)
  returns boolean language sql security definer set search_path = public as
  $$ select exists (select 1 from teacher_students
                    where teacher_id = t_id and student_id = s_id) $$;

  -- Связи: видят и разрывают обе стороны; создаёт только функция join_teacher
  drop policy if exists "see own links" on public.teacher_students;
  create policy "see own links" on public.teacher_students
    for select using (auth.uid() in (teacher_id, student_id));
  drop policy if exists "unlink" on public.teacher_students;
  create policy "unlink" on public.teacher_students
    for delete using (auth.uid() in (teacher_id, student_id));

  -- Назначения: преподаватель управляет назначениями СВОИХ колод СВОИМ ученицам
  drop policy if exists "teacher manages assignments" on public.deck_assignments;
  create policy "teacher manages assignments" on public.deck_assignments
    for all using (public.deck_owned_by(deck_id, auth.uid()))
    with check (
      public.deck_owned_by(deck_id, auth.uid())
      and public.is_student_of(auth.uid(), student_id)
    );
  drop policy if exists "student sees assignments" on public.deck_assignments;
  create policy "student sees assignments" on public.deck_assignments
    for select using (auth.uid() = student_id);

  -- Ученице видны назначенные колоды и их карточки (только чтение)
  drop policy if exists "assigned decks readable" on public.decks;
  create policy "assigned decks readable" on public.decks
    for select using (public.deck_assigned_to(id, auth.uid()));
  drop policy if exists "assigned cards readable" on public.cards;
  create policy "assigned cards readable" on public.cards
    for select using (public.deck_assigned_to(deck_id, auth.uid()));

  -- Преподавателю видны профили и активность привязанных учениц;
  -- ученице — профиль её преподавателя (для имени)
  drop policy if exists "linked profiles visible" on public.profiles;
  create policy "linked profiles visible" on public.profiles
    for select using (
      exists (select 1 from public.teacher_students ts
              where (ts.teacher_id = auth.uid() and ts.student_id = profiles.id)
                or (ts.student_id = auth.uid() and ts.teacher_id = profiles.id))
    );
  drop policy if exists "teacher reads student activity" on public.activity_log;
  create policy "teacher reads student activity" on public.activity_log
    for select using (
      exists (select 1 from public.teacher_students ts
              where ts.student_id = activity_log.user_id
                and ts.teacher_id = auth.uid())
    );

  -- Привязка по коду: security definer — ищет преподавателя по коду в обход RLS
  create or replace function public.join_teacher(code text)
  returns text
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    t_id uuid;
    t_name text;
  begin
    select id, coalesce(display_name, 'Преподаватель') into t_id, t_name
      from profiles
    where invite_code = upper(trim(code)) and role = 'teacher';
    if t_id is null then
      raise exception 'Код не найден. Проверь код у преподавателя.';
    end if;
    if t_id = auth.uid() then
      raise exception 'Нельзя привязать саму себя.';
    end if;
    insert into teacher_students (teacher_id, student_id)
    values (t_id, auth.uid())
    on conflict (teacher_id, student_id) do nothing;
    return t_name;
  end;
  $$;

  -- ============================================================================
  -- МАТЕРИАЛЫ ПРЕПОДАВАТЕЛЯ: сгенерированные тексты с упражнениями.
  -- Блок idempotent — можно запускать повторно.
  -- ============================================================================

  create table if not exists public.materials (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    lang text not null check (lang in ('en','es')) default 'en',
    level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
    topic text not null,
    format text not null,
    length_range text not null,
    title text,
    body text not null,
    exercises jsonb not null,
    plan jsonb,
    created_at timestamptz default now()
  );

  create table if not exists public.material_assignments (
    id uuid primary key default gen_random_uuid(),
    material_id uuid not null references public.materials(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    status text not null check (status in ('assigned','submitted','reviewed')) default 'assigned',
    answers jsonb,
    auto_score int,
    auto_total int,
    ai_review jsonb,
    teacher_review jsonb,
    submitted_at timestamptz,
    reviewed_at timestamptz,
    created_at timestamptz default now(),
    unique (material_id, student_id)
  );

  alter table public.materials enable row level security;
  alter table public.material_assignments enable row level security;

  -- Хелперы security definer (обход взаимных ссылок политик, как у колод)
  create or replace function public.material_owned_by(m_id uuid, u_id uuid)
  returns boolean language sql security definer set search_path = public as
  $$ select exists (select 1 from materials where id = m_id and teacher_id = u_id) $$;

  create or replace function public.material_assigned_to(m_id uuid, s_id uuid)
  returns boolean language sql security definer set search_path = public as
  $$ select exists (select 1 from material_assignments
                    where material_id = m_id and student_id = s_id) $$;

  -- materials: преподаватель распоряжается своими; ученице назначенные — на чтение
  drop policy if exists "own materials" on public.materials;
  create policy "own materials" on public.materials
    for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
  drop policy if exists "assigned materials readable" on public.materials;
  create policy "assigned materials readable" on public.materials
    for select using (public.material_assigned_to(id, auth.uid()));

  -- material_assignments: преподаватель управляет назначениями своих материалов
  -- (и назначает только СВОИМ ученицам); ученица видит и обновляет свои
  drop policy if exists "teacher manages material assignments" on public.material_assignments;
  create policy "teacher manages material assignments" on public.material_assignments
    for all using (public.material_owned_by(material_id, auth.uid()))
    with check (
      public.material_owned_by(material_id, auth.uid())
      and public.is_student_of(auth.uid(), student_id)
    );
  drop policy if exists "student sees own material assignments" on public.material_assignments;
  create policy "student sees own material assignments" on public.material_assignments
    for select using (auth.uid() = student_id);
  drop policy if exists "student updates own material assignments" on public.material_assignments;
  create policy "student updates own material assignments" on public.material_assignments
    for update using (auth.uid() = student_id) with check (auth.uid() = student_id);

  -- Материалы: переназначение с историей попыток (2026-07-19)
  alter table public.material_assignments add column if not exists attempts jsonb;
  alter table public.material_assignments add column if not exists note text;

  -- ============================================================================
  -- ПЕРЕПРОВЕРКА СЛОВ (учитель → ученица) + доступ учителя к словам учениц.
  -- Блок idempotent — можно запускать повторно.
  -- ============================================================================

  create table if not exists public.word_checks (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    card_ids jsonb not null,
    results jsonb,
    created_at timestamptz default now(),
    completed_at timestamptz
  );

  alter table public.word_checks enable row level security;

  drop policy if exists "teacher manages word checks" on public.word_checks;
  create policy "teacher manages word checks" on public.word_checks
    for all using (auth.uid() = teacher_id)
    with check (auth.uid() = teacher_id and public.is_student_of(auth.uid(), student_id));
  drop policy if exists "student sees word checks" on public.word_checks;
  create policy "student sees word checks" on public.word_checks
    for select using (auth.uid() = student_id);
  drop policy if exists "student updates word checks" on public.word_checks;
  create policy "student updates word checks" on public.word_checks
    for update using (auth.uid() = student_id) with check (auth.uid() = student_id);

  -- Учителю видны (только чтение) колоды, карточки и расписания привязанных учениц
  create or replace function public.deck_owned_by_student_of(d_id uuid, t_id uuid)
  returns boolean language sql security definer set search_path = public as
  $$ select exists (select 1 from decks d
                    join teacher_students ts on ts.student_id = d.owner_id
                    where d.id = d_id and ts.teacher_id = t_id) $$;

  drop policy if exists "teacher reads student decks" on public.decks;
  create policy "teacher reads student decks" on public.decks
    for select using (public.is_student_of(auth.uid(), owner_id));
  drop policy if exists "teacher reads student cards" on public.cards;
  create policy "teacher reads student cards" on public.cards
    for select using (public.deck_owned_by_student_of(deck_id, auth.uid()));
  drop policy if exists "teacher reads student review states" on public.review_states;
  create policy "teacher reads student review states" on public.review_states
    for select using (public.is_student_of(auth.uid(), user_id));

  -- ============================================================================
  -- ЗАЩИТА ОТ ПОДДЕЛКИ (2026-07-20, по итогам ревью безопасности).
  -- Прямая запись оценок/вердиктов/роли из клиента запрещена; всё — через
  -- security-definer функции, которые проверяют права. RLS-строки защищают ОТ
  -- чтения чужого, но НЕ от записи в свою строку любых колонок — поэтому оценки
  -- (teacher_review, status, results) и роль пишутся только этими функциями.
  -- Блок idempotent.
  -- ============================================================================

  -- ---- profiles: запрет менять role и invite_code напрямую ----
  -- (роль выдаётся администратором через SQL Editor = роль postgres, обходит grant;
  --  invite_code — через функцию ensure_invite_code)
  revoke update on public.profiles from authenticated;
  grant update (display_name, level, native_lang) on public.profiles to authenticated;

  -- Код-приглашение: генерирует и возвращает (только для преподавателя)
  create or replace function public.ensure_invite_code()
  returns text language plpgsql security definer set search_path = public as $fn$
  declare
    existing text;
    new_code text;
    alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    i int;
    attempt int;
  begin
    select invite_code into existing from profiles where id = auth.uid() and role = 'teacher';
    if existing is not null then return existing; end if;
    if not exists (select 1 from profiles where id = auth.uid() and role = 'teacher') then
      raise exception 'Код-приглашение доступен только преподавателю.';
    end if;
    for attempt in 1..6 loop
      new_code := '';
      for i in 1..6 loop
        new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      begin
        update profiles set invite_code = new_code where id = auth.uid();
        return new_code;
      exception when unique_violation then
        -- код занят, пробуем ещё
      end;
    end loop;
    raise exception 'Не удалось сгенерировать код, попробуйте ещё раз.';
  end $fn$;

  -- ---- material_assignments: запись только через функции ----
  revoke insert, update, delete on public.material_assignments from authenticated;

  -- Ученица сдаёт работу (только свою, только из статуса assigned)
  create or replace function public.submit_material(
    p_id uuid, p_answers jsonb, p_auto_score int, p_auto_total int
  ) returns void language plpgsql security definer set search_path = public as $fn$
  begin
    update material_assignments
      set answers = p_answers, auto_score = p_auto_score, auto_total = p_auto_total,
          status = 'submitted', submitted_at = now()
    where id = p_id and student_id = auth.uid() and status = 'assigned';
    if not found then raise exception 'Работа не найдена или уже сдана.'; end if;
  end $fn$;

  -- Преподаватель назначает материал своей ученице
  create or replace function public.assign_material(p_material_id uuid, p_student_id uuid)
  returns void language plpgsql security definer set search_path = public as $fn$
  begin
    if not public.material_owned_by(p_material_id, auth.uid())
      or not public.is_student_of(auth.uid(), p_student_id) then
      raise exception 'Нет прав назначить этот материал этой ученице.';
    end if;
    insert into material_assignments (material_id, student_id)
    values (p_material_id, p_student_id)
    on conflict (material_id, student_id) do nothing;
  end $fn$;

  create or replace function public.unassign_material(p_material_id uuid, p_student_id uuid)
  returns void language plpgsql security definer set search_path = public as $fn$
  begin
    if not public.material_owned_by(p_material_id, auth.uid()) then
      raise exception 'Нет прав.';
    end if;
    delete from material_assignments where material_id = p_material_id and student_id = p_student_id;
  end $fn$;

  -- Преподаватель сохраняет черновик AI-разбора
  create or replace function public.save_material_ai_review(p_id uuid, p_review jsonb)
  returns void language plpgsql security definer set search_path = public as $fn$
  begin
    if not exists (
      select 1 from material_assignments ma
      where ma.id = p_id and public.material_owned_by(ma.material_id, auth.uid())
    ) then raise exception 'Нет прав.'; end if;
    update material_assignments set ai_review = p_review where id = p_id;
  end $fn$;

  -- Преподаватель завершает проверку
  create or replace function public.finish_material_review(p_id uuid, p_review jsonb)
  returns void language plpgsql security definer set search_path = public as $fn$
  begin
    if not exists (
      select 1 from material_assignments ma
      where ma.id = p_id and public.material_owned_by(ma.material_id, auth.uid())
        and public.is_student_of(auth.uid(), ma.student_id)
    ) then raise exception 'Нет прав проверять эту работу.'; end if;
    update material_assignments
      set teacher_review = p_review, status = 'reviewed', reviewed_at = now()
    where id = p_id;
  end $fn$;

  -- Преподаватель переназначает материал (текущая работа → в историю)
  create or replace function public.reassign_material(p_id uuid, p_note text)
  returns void language plpgsql security definer set search_path = public as $fn$
  declare snap jsonb;
  begin
    if not exists (
      select 1 from material_assignments ma
      where ma.id = p_id and public.material_owned_by(ma.material_id, auth.uid())
        and public.is_student_of(auth.uid(), ma.student_id)
    ) then raise exception 'Нет прав.'; end if;
    select jsonb_build_object(
      'answers', answers, 'auto_score', auto_score, 'auto_total', auto_total,
      'teacher_review', teacher_review, 'submitted_at', submitted_at,
      'reviewed_at', reviewed_at, 'note', note
    ) into snap from material_assignments where id = p_id;
    update material_assignments
      set attempts = coalesce(attempts, '[]'::jsonb) || jsonb_build_array(snap),
          status = 'assigned', answers = null, auto_score = null, auto_total = null,
          ai_review = null, teacher_review = null, submitted_at = null,
          reviewed_at = null, note = nullif(trim(p_note), '')
    where id = p_id;
  end $fn$;

  -- ---- word_checks: запись только через функции ----
  revoke insert, update, delete on public.word_checks from authenticated;

  create or replace function public.assign_word_check(p_student_id uuid, p_card_ids jsonb)
  returns void language plpgsql security definer set search_path = public as $fn$
  begin
    if not public.is_student_of(auth.uid(), p_student_id) then
      raise exception 'Это не ваша ученица.';
    end if;
    insert into word_checks (teacher_id, student_id, card_ids)
    values (auth.uid(), p_student_id, p_card_ids);
  end $fn$;

  -- Ученица сдаёт перепроверку (идемпотентно: только если ещё не завершена)
  create or replace function public.submit_word_check(p_id uuid, p_results jsonb)
  returns boolean language plpgsql security definer set search_path = public as $fn$
  declare n int;
  begin
    update word_checks set results = p_results, completed_at = now()
    where id = p_id and student_id = auth.uid() and completed_at is null;
    get diagnostics n = row_count;  -- row_count это int, не boolean
    return n > 0; -- true = засчитано сейчас (клиент начислит again неверным словам)
  end $fn$;

  -- ---- USING-фиксы: экс-преподаватель после отвязки теряет доступ ----
  drop policy if exists "teacher manages assignments" on public.deck_assignments;
  create policy "teacher manages assignments" on public.deck_assignments
    for all using (
      public.deck_owned_by(deck_id, auth.uid())
      and public.is_student_of(auth.uid(), student_id)
    ) with check (
      public.deck_owned_by(deck_id, auth.uid())
      and public.is_student_of(auth.uid(), student_id)
    );

  drop policy if exists "teacher manages material assignments" on public.material_assignments;
  drop policy if exists "teacher reads material assignments" on public.material_assignments;
  create policy "teacher reads material assignments" on public.material_assignments
    for select using (
      public.material_owned_by(material_id, auth.uid())
      and public.is_student_of(auth.uid(), student_id)
    );

  drop policy if exists "teacher manages word checks" on public.word_checks;
  drop policy if exists "teacher reads word checks" on public.word_checks;
  create policy "teacher reads word checks" on public.word_checks
    for select using (
      auth.uid() = teacher_id and public.is_student_of(auth.uid(), student_id)
    );

  -- ============================================================================
  -- ЗАЩИТА ОТ ПОДДЕЛКИ, второй проход (2026-07-20, по итогам второго ревью).
  -- Блок idempotent — можно запускать повторно.
  -- ============================================================================

  -- ---- profiles: закрыть эскалацию роли через пересоздание строки ----
  -- RLS-политика "own profile" (for all) разрешала INSERT/DELETE своей строки, а
  -- стандартные гранты Supabase давали authenticated эти права. В связке это
  -- позволяло: DELETE своего профиля → INSERT новой строки с role='teacher' и
  -- любым invite_code. Профиль и так создаётся триггером handle_new_user
  -- (security definer) и удаляется каскадом от auth.users — клиенту INSERT/DELETE
  -- на profiles не нужны.
  revoke insert, delete on public.profiles from authenticated;

  -- ---- content_items: убрать глобальную запись ----
  -- Политика "write content" позволяла любому вошедшему вставлять строки в общую
  -- таблицу, которую читают все (потенциальный спам/вредоносный контент). Таблица
  -- в приложении пока не используется — снимаем право записи до появления фичи.
  revoke insert on public.content_items from authenticated;

  -- ---- assign_word_check: проверять принадлежность карточек ученице ----
  -- Раньше учитель мог назначить перепроверку по ЛЮБЫМ card_id (в т.ч. чужим).
  -- Теперь требуем, чтобы все карточки принадлежали колодам именно этой ученицы.
  create or replace function public.assign_word_check(p_student_id uuid, p_card_ids jsonb)
  returns void language plpgsql security definer set search_path = public as $fn$
  begin
    if not public.is_student_of(auth.uid(), p_student_id) then
      raise exception 'Это не ваша ученица.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_card_ids) cid
      where not exists (
        select 1 from cards c join decks d on d.id = c.deck_id
        where c.id = cid::uuid and d.owner_id = p_student_id
      )
    ) then
      raise exception 'Среди слов есть карточки, не принадлежащие этой ученице.';
    end if;
    insert into word_checks (teacher_id, student_id, card_ids)
    values (auth.uid(), p_student_id, p_card_ids);
  end $fn$;

  -- ---- submit_material: пересчитывать авто-балл на сервере ----
  -- Клиент присылал auto_score/auto_total — их можно было подделать. Теперь балл
  -- считается на сервере из ответов ученицы и правильных ответов материала.
  -- (Это НЕ мешает «подглядыванию»: правильные ответы всё ещё уходят на клиент
  --  в exercises. Полностью закрыть — только не отдавать ответы и проверять на
  --  сервере; это отдельная бо́льшая переделка. Пока — защита от прямой подделки.)

  -- Нормализация ответа под клиентскую (lower + trim + снятие диакритики en/es +
  -- схлопывание пробелов). Без расширения unaccent — явным translate по буквам.
  create or replace function public.norm_answer(s text)
  returns text language sql stable as $fn$
    select regexp_replace(
      lower(translate(trim(coalesce(s, '')),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '\s+', ' ', 'g')
  $fn$;

  create or replace function public.submit_material(
    p_id uuid, p_answers jsonb, p_auto_score int, p_auto_total int
  ) returns void language plpgsql security definer set search_path = public as $fn$
  declare
    m_exercises jsonb;
    ex jsonb;
    ans jsonb;
    idx int := 0;
    score int := 0;
    total int := 0;
    given_text text;
    correct_text text;
    ex_type text;
  begin
    -- упражнения берём из материала; клиентские p_auto_score/p_auto_total игнорируем
    select mat.exercises into m_exercises
      from material_assignments ma
      join materials mat on mat.id = ma.material_id
    where ma.id = p_id and ma.student_id = auth.uid() and ma.status = 'assigned';
    if m_exercises is null then
      raise exception 'Работа не найдена или уже сдана.';
    end if;

    for ex in select value from jsonb_array_elements(m_exercises) loop
      total := total + 1;
      ex_type := ex->>'type';
      select value into ans
        from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
      where (value->>'index')::int = idx
      limit 1;
      given_text := ans->>'given';
      if ex_type = 'mcq' then
        correct_text := ex->'options'->>((ex->>'answer')::int);
      elsif ex_type = 'fill' then
        correct_text := ex->>'answer';
      else
        correct_text := null;
      end if;
      if given_text is not null and correct_text is not null
        and public.norm_answer(given_text) = public.norm_answer(correct_text) then
        score := score + 1;
      end if;
      idx := idx + 1;
    end loop;

    update material_assignments
      set answers = p_answers, auto_score = score, auto_total = total,
          status = 'submitted', submitted_at = now()
    where id = p_id and student_id = auth.uid() and status = 'assigned';
    if not found then raise exception 'Работа не найдена или уже сдана.'; end if;
  end $fn$;

  -- ---- review_states: расписание только для ДОСТУПНОЙ карточки ----
  -- Раньше with check проверял только user_id — можно было создать review_state
  -- для любого чужого card_id (мусор/ломка инварианта). Теперь карточка обязана
  -- быть из своей колоды или назначенной преподавателем.
  drop policy if exists "own review states" on public.review_states;
  create policy "own review states" on public.review_states
    for all using (auth.uid() = user_id)
    with check (
      auth.uid() = user_id and exists (
        select 1 from public.cards c join public.decks d on d.id = c.deck_id
        where c.id = review_states.card_id
          and (d.owner_id = auth.uid() or public.deck_assigned_to(d.id, auth.uid()))
      )
    );

  -- ============================================================================
  -- КОНТРОЛЬ ДОСТУПА (2026-07-20): белый список email + флаг блокировки.
  -- Блок idempotent — можно запускать повторно.
  -- Подробное описание и готовые команды: docs/ACCESS-CONTROL.md
  -- ============================================================================

  -- ---- 1. Белый список приглашённых ----
  -- Регистрация в приложении остаётся открытой, но триггер handle_new_user
  -- пропускает только тех, чей email заранее внесён сюда. Гейт стоит в БД,
  -- поэтому обойти его с клиента (DevTools, прямой REST, подмена запроса)
  -- невозможно: проверка выполняется внутри транзакции создания пользователя.
  create table if not exists public.allowed_emails (
    email    text primary key,
    note     text,
    added_at timestamptz not null default now()
  );

  alter table public.allowed_emails enable row level security;

  -- Политик намеренно НЕ создаём: RLS без политик = отказ во всём. Плюс явный
  -- revoke, чтобы право не пришло из дефолтных грантов Supabase. В итоге список
  -- невидим для приложения — ни прочитать, ни узнать, есть ли в нём адрес.
  -- Управление только из SQL Editor (роль postgres) или ключом service_role.
  revoke all on public.allowed_emails from anon, authenticated;

  -- Нормализация: храним email в нижнем регистре и без пробелов по краям,
  -- чтобы 'Ivan@Mail.ru ' и 'ivan@mail.ru' были одной и той же записью.
  create or replace function public.normalize_allowed_email()
  returns trigger language plpgsql as $fn$
  begin
    new.email := lower(trim(new.email));
    return new;
  end $fn$;

  drop trigger if exists allowed_emails_normalize on public.allowed_emails;
  create trigger allowed_emails_normalize
    before insert or update on public.allowed_emails
    for each row execute function public.normalize_allowed_email();

  -- ---- 2. Флаг блокировки ----
  -- Снять блокировку с себя пользователь не может: выше по файлу выполнены
  -- `revoke update on public.profiles from authenticated` и
  -- `grant update (display_name, level, native_lang)`, то есть UPDATE разрешён
  -- ровно на три колонки, и blocked в их число не входит.
  --
  -- ВАЖНО про модель угроз: этот флаг управляет тем, что показывает приложение,
  -- и закрывает доступ к платному AI-прокси (api/gemini.ts). Он НЕ отзывает уже
  -- выданный JWT — чтение своих данных через прямой REST у заблокированного
  -- останется до истечения токена. Жёсткая блокировка — «Ban user» в
  -- Supabase (Authentication → Users), она мгновенно убивает все токены.
  alter table public.profiles add column if not exists blocked boolean not null default false;

  -- ---- 3. Гейт на регистрацию ----
  -- Триггер AFTER INSERT на auth.users: raise внутри него откатывает всю
  -- транзакцию регистрации, поэтому запись в auth.users не остаётся —
  -- «полурегистрации» без профиля возникнуть не может.
  -- Тело функции ниже полностью повторяет прежнее (профиль + две колоды),
  -- добавлена только проверка белого списка в начале.
  create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    -- Пропускаем, если в списке есть либо точный адрес, либо доменная запись
    -- вида '@example.com' (тогда проходит любой адрес на этом домене).
    -- ⚠️ НЕ вписывать публичные домены (@gmail.com и т.п.) — это открыло бы
    -- регистрацию всему миру. Доменная запись — для своей команды/тестов.
    if not exists (
      select 1 from public.allowed_emails a
      where a.email = lower(trim(new.email))
         or a.email = '@' || split_part(lower(trim(new.email)), '@', 2)
    ) then
      -- Текст ловится клиентом (src/lib/access.ts) и заменяется на понятный.
      raise exception 'RECALL_NOT_INVITED'
        using errcode = 'check_violation';
    end if;

    insert into public.profiles (id, display_name)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;

    insert into public.decks (owner_id, title, description, lang)
    values
      (new.id, 'Мои слова',    'Английские слова из чтения и добавленные вручную', 'en'),
      (new.id, 'Mis palabras', 'Испанские слова из паков, чтения и добавленные вручную', 'es');

    return new;
  end;
  $$;

  -- ---- 4. Обзор доступа (для владельца проекта) ----
  -- Показывает разом: кто приглашён, кто уже зарегистрировался, кто заблокирован.
  -- Смотреть из SQL Editor: select * from public.access_overview;
  -- Клиенту недоступно — гранты не выдаются.
  create or replace view public.access_overview as
    select
      a.email,
      a.note,
      a.added_at,
      u.id                       as user_id,
      u.created_at               as registered_at,
      u.last_sign_in_at,
      u.banned_until,
      coalesce(p.blocked, false) as blocked,
      p.display_name,
      p.role
    from public.allowed_emails a
    left join auth.users u on lower(u.email) = a.email
    left join public.profiles p on p.id = u.id
    order by a.added_at;

  revoke all on public.access_overview from anon, authenticated;

  -- ============================================================================
  -- ЛИМИТЫ НА AI (2026-07-20): защита квоты Gemini от сжигания одним аккаунтом.
  -- Блок idempotent — можно запускать повторно.
  -- ============================================================================

  -- Журнал обращений к /api/gemini. Пишется только через RPC ниже (клиенту
  -- таблица недоступна), поэтому подделать счётчик нельзя.
  create table if not exists public.ai_calls (
    id        bigserial primary key,
    user_id   uuid not null references public.profiles(id) on delete cascade,
    called_at timestamptz not null default now()
  );

  create index if not exists ai_calls_user_time
    on public.ai_calls (user_id, called_at desc);

  alter table public.ai_calls enable row level security;
  revoke all on public.ai_calls from anon, authenticated;
  revoke all on sequence public.ai_calls_id_seq from anon, authenticated;

  -- Единая проверка перед каждым обращением к Gemini: бан → блокировка → лимиты.
  -- Вызывается сервером (api/gemini.ts) с JWT пользователя, поэтому auth.uid()
  -- здесь — это именно тот, кто послал запрос, а подменить его нельзя.
  --
  -- Лимиты подобраны под живое использование одним человеком: типичное занятие
  -- (диалог + разбор пары текстов) укладывается в 10-20 обращений. Менять здесь.
  create or replace function public.consume_ai_quota()
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  declare
    max_per_hour constant int := 40;
    max_per_day  constant int := 200;
    uid uuid := auth.uid();
    n int;
  begin
    if uid is null then
      raise exception 'RECALL_NO_AUTH';
    end if;

    -- Бан в Supabase (Authentication → Users → Ban user). PostgREST сам его не
    -- проверяет: подписанный JWT остаётся валидным до истечения срока, поэтому
    -- смотрим banned_until явно — иначе забаненный ещё час жёг бы квоту.
    if exists (
      select 1 from auth.users
      where id = uid and banned_until is not null and banned_until > now()
    ) then
      raise exception 'RECALL_BLOCKED';
    end if;

    if exists (select 1 from profiles where id = uid and blocked) then
      raise exception 'RECALL_BLOCKED';
    end if;

    -- Чистим старое, чтобы таблица не росла бесконечно.
    delete from ai_calls where called_at < now() - interval '3 days';

    select count(*) into n from ai_calls
    where user_id = uid and called_at > now() - interval '1 hour';
    if n >= max_per_hour then
      raise exception 'RECALL_RATE_HOUR';
    end if;

    select count(*) into n from ai_calls
    where user_id = uid and called_at > now() - interval '24 hours';
    if n >= max_per_day then
      raise exception 'RECALL_RATE_DAY';
    end if;

    insert into ai_calls (user_id) values (uid);
  end $fn$;

  grant execute on function public.consume_ai_quota() to authenticated;

  -- Сколько уже потрачено — для владельца проекта (из SQL Editor).
  create or replace view public.ai_usage_overview as
    select
      p.display_name,
      u.email,
      count(*) filter (where c.called_at > now() - interval '1 hour')   as last_hour,
      count(*) filter (where c.called_at > now() - interval '24 hours') as last_day,
      max(c.called_at)                                                  as last_call
    from public.ai_calls c
    join public.profiles p on p.id = c.user_id
    join auth.users u on u.id = c.user_id
    group by p.display_name, u.email
    order by last_day desc;

  revoke all on public.ai_usage_overview from anon, authenticated;
