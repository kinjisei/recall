-- 0009 — расписание: модель и сервер (PLAN.md Ф2.6; журнал п.26–33, 39, 41, 43,
-- 65; архитектура §17–18)
-- ============================================================================
-- Уроки репетитора и учёт оплаченных уроков. Ученик в уроке — карточка
-- (student_cards, 0008): вести можно и того, кого нет в приложении.
--
--   lesson_series        повтор по неделям: дни, время, длительность, шаг 1–2
--                        недели, начало и конец; состав — series_participants
--   lessons              урок: время, тип (индивидуальный / групповой /
--                        пробный), статус (запланирован / проведён / отменён),
--                        «перенесён с», версия (растёт при изменении — для
--                        уведомления ученику, Ф2.9)
--   lesson_participants  участие карточки: был ли, списан ли
--                        («списан / не списан / поздняя отмена»)
--   paid_lessons         журнал оплат «+N»: только дописывается, исправление —
--                        записью с минусом
--   schedule_settings    ссылка на урок по умолчанию (журнал п.43)
--
-- Остаток уроков — ОДНА функция из фактов, card_lesson_balance(card) =
-- сумма paid_lessons − списанные участия (включая позднюю отмену). Хранимой
-- колонки «остаток» нет: исправление задним числом пересчитывает его само.
--
-- Уроки серии создаются заранее, на 12 недель вперёд (schedule_horizon_days);
-- будильник schedule_tick (pg_cron, раз в 5 минут) двигает это окно и
-- списывает закончившиеся уроки, если учитель не отметил иначе (журнал п.27).
--
-- Решения владельца 04.10.2026 (журнал п.65):
--   1. пауза и архив: уроки ученика сами уходят из будущего (не создаются и
--      не списываются); вернулся в «занимается» — уроки серии появляются снова;
--   2. без тарифа (п.41) автосписание стоит; уроки, закончившиеся без тарифа,
--      остаются «не отмечен» и после оплаты — учитель отмечает их сам;
--   3. «этот и все следующие» приводит к новому расписанию и уроки, перенесённые
--      отдельно (как в Google Календаре; экран предупредит заранее);
--   4. ученик со статусом «пробный» в момент урока не списывается в любом
--      уроке, как и урок с типом «пробный» (п.30).
--
-- Доступ: все таблицы закрыты — только RPC. Учитель видит и меняет своё;
-- запись — первой строкой assert_teacher_can_write() (без тарифа —
-- RECALL_PLAN_REQUIRED, журнал п.41). Ученик — только свои уроки через
-- get_my_lessons (название группы и время, без других участников, п.43) и
-- остаток одним числом без минуса (п.33) — без журнала оплат.
-- ============================================================================

-- ---- данные --------------------------------------------------------------------
-- Участник урока и оплата ссылаются на карточку ТОГО ЖЕ учителя: составной
-- внешний ключ (card, teacher), чужую карточку не вписать даже ошибкой RPC.
alter table public.student_cards add constraint student_cards_id_teacher unique (id, teacher_id);

create table public.schedule_settings (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  default_link text check (char_length(default_link) <= 500 and default_link ~* '^https?://'),
  updated_at timestamptz not null default now()
);

create table public.lesson_series (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('individual', 'group')),
  -- название группы; у индивидуальной серии — подпись по желанию
  title text check (char_length(title) between 1 and 80),
  -- дни недели ISO: 1 — понедельник … 7 — воскресенье
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'),
  -- время начала по Алматы
  start_time time not null,
  minutes int not null check (minutes between 15 and 480),
  every_weeks smallint not null default 1 check (every_weeks in (1, 2)),
  starts_on date not null,
  ends_on date check (ends_on >= starts_on),
  -- ссылка серии; null — ссылка учителя по умолчанию
  link text check (char_length(link) <= 500 and link ~* '^https?://'),
  -- «этот и все следующие» делит серию: новая помнит, от какой отделилась
  split_from uuid references public.lesson_series(id) on delete set null,
  -- до какой даты уроки уже созданы (окно двигает schedule_tick)
  generated_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'group' or title is not null),
  unique (id, teacher_id)
);
create index lesson_series_teacher on public.lesson_series (teacher_id);
create index lesson_series_split_from on public.lesson_series (split_from) where split_from is not null;

create table public.series_participants (
  series_id uuid not null,
  card_id uuid not null,
  teacher_id uuid not null,
  primary key (series_id, card_id),
  foreign key (series_id, teacher_id) references public.lesson_series(id, teacher_id) on delete cascade,
  foreign key (card_id, teacher_id) references public.student_cards(id, teacher_id) on delete cascade
);
create index series_participants_card on public.series_participants (card_id);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  series_id uuid,
  -- день урока по правилу серии; перенос его не меняет — так перенос не рвёт
  -- серию, а окно не создаёт на этот день второй урок
  series_date date,
  kind text not null check (kind in ('individual', 'group', 'trial')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  -- свои у урока; null — как у серии (ссылка — как у серии или у учителя)
  title text check (char_length(title) between 1 and 80),
  link text check (char_length(link) <= 500 and link ~* '^https?://'),
  -- время до первого переноса; вернули на место — null
  moved_from timestamptz,
  -- растёт при переносе, отмене, возврате, смене ссылки или названия (триггер)
  version int not null default 1,
  -- будильник обработал: списал («проведён») или пропустил (без тарифа)
  settled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  check ((series_id is null) = (series_date is null)),
  unique (id, teacher_id),
  foreign key (series_id, teacher_id) references public.lesson_series(id, teacher_id)
);
create index lessons_teacher_starts on public.lessons (teacher_id, starts_at);
create unique index lessons_series_slot on public.lessons (series_id, series_date) where series_id is not null;
-- будильнику: закончившиеся и ещё не обработанные
create index lessons_to_settle on public.lessons (ends_at) where status = 'planned' and settled_at is null;

create table public.lesson_participants (
  lesson_id uuid not null,
  card_id uuid not null,
  teacher_id uuid not null,
  -- пробное участие: урок «пробный» или карточка «пробный» к началу урока
  -- (решение 4); до начала урока следует за статусом карточки
  trial boolean not null default false,
  -- null — ещё не отмечено (урок не закончился или без тарифа)
  attended boolean,
  charge text check (charge in ('charged', 'not_charged', 'late_cancel')),
  -- списал будильник, а не учитель
  charge_auto boolean not null default false,
  marked_at timestamptz,
  primary key (lesson_id, card_id),
  foreign key (lesson_id, teacher_id) references public.lessons(id, teacher_id) on delete cascade,
  foreign key (card_id, teacher_id) references public.student_cards(id, teacher_id) on delete cascade,
  check ((charge is null) = (attended is null)),
  check (charge is distinct from 'late_cancel' or attended = false),
  -- пробный не списывается никогда (журнал п.30) — правило самой базы
  check (not (trial and charge in ('charged', 'late_cancel')))
);
create index lesson_participants_card on public.lesson_participants (card_id);

create table public.paid_lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  card_id uuid not null,
  -- «+8»; исправление — записью с минусом
  n int not null check (n <> 0 and n between -100 and 100),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  foreign key (card_id, teacher_id) references public.student_cards(id, teacher_id) on delete cascade
);
create index paid_lessons_card on public.paid_lessons (card_id, created_at);
create index paid_lessons_created_by on public.paid_lessons (created_by);

-- Все таблицы закрыты (RLS без политик): только RPC ниже.
alter table public.schedule_settings enable row level security;
alter table public.lesson_series enable row level security;
alter table public.series_participants enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_participants enable row level security;
alter table public.paid_lessons enable row level security;
revoke all on public.schedule_settings, public.lesson_series, public.series_participants,
  public.lessons, public.lesson_participants, public.paid_lessons from anon, authenticated;

-- ---- инварианты в самой базе -----------------------------------------------------
-- Версия растёт при любом изменении, которое касается ученика: время, отмена и
-- возврат, ссылка, название. Отметки посещения и «проведён» — не изменение
-- договорённости, версию не трогают.
create or replace function public.trg_lesson_version()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if (new.starts_at, new.ends_at, new.link, new.title) is distinct from (old.starts_at, old.ends_at, old.link, old.title)
     or (new.status is distinct from old.status and 'cancelled' in (new.status, old.status)) then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $fn$;
create trigger lessons_version before update on public.lessons
  for each row execute function public.trg_lesson_version();

create or replace function public.trg_paid_lessons_append_only()
returns trigger language plpgsql set search_path = public as $fn$
begin
  raise exception 'paid_lessons только дописывается: исправление — записью с минусом';
end $fn$;
create trigger paid_lessons_append_only before update on public.paid_lessons
  for each row execute function public.trg_paid_lessons_append_only();

-- ---- правила без данных ------------------------------------------------------------
-- На сколько дней вперёд создаются уроки серии. Копия — HORIZON_DAYS
-- (domains/schedule/model.ts), пару сверяет test-schedule.mjs.
create or replace function public.schedule_horizon_days()
returns int language sql immutable set search_path = public as $fn$ select 84 $fn$;

-- День и время по Алматы → момент. Часовой пояс расписания — фиксированный
-- (архитектура §18), как у дневных границ.
create or replace function public.almaty_ts(p_day date, p_time time)
returns timestamptz language sql stable set search_path = public as $fn$
  select (p_day + p_time) at time zone 'Asia/Almaty'
$fn$;

-- Есть ли урок серии в этот день: день недели из списка, неделя «своя» при
-- шаге 2 (счёт от понедельника недели начала), в пределах начала и конца.
-- Копия — isSeriesSlot (model.ts); check-schedule сверяет их на сотнях дней.
create or replace function public.series_slot(p_weekdays smallint[], p_every smallint, p_starts date, p_ends date, p_day date)
returns boolean language sql immutable set search_path = public as $fn$
  select p_day >= p_starts
     and (p_ends is null or p_day <= p_ends)
     and extract(isodow from p_day)::smallint = any (p_weekdays)
     and ((p_day - (p_starts - (extract(isodow from p_starts)::int - 1))) / 7) % p_every = 0
$fn$;

-- Дни недели серии: без повторов, по порядку, 1–7.
create or replace function public.series_days(p_weekdays int[])
returns smallint[] language plpgsql immutable set search_path = public as $fn$
declare v smallint[];
begin
  select array_agg(distinct d::smallint order by d::smallint) into v
    from unnest(coalesce(p_weekdays, '{}'::int[])) d where d is not null;
  if v is null or exists (select 1 from unnest(v) d where d not between 1 and 7) then
    raise exception 'RECALL_BAD_REPEAT';
  end if;
  return v;
end $fn$;

-- Ссылка на урок: только http(s) — её откроет ученик. «meet.google.com/…» без
-- https:// дополняется.
create or replace function public.lesson_link_clean(p_link text)
returns text language plpgsql immutable set search_path = public as $fn$
declare v text := nullif(btrim(coalesce(p_link, '')), '');
begin
  if v is null then return null; end if;
  if v !~* '^https?://' and v ~* '^[a-z0-9-]+(\.[a-z0-9-]+)+(/|$)' then v := 'https://' || v; end if;
  if char_length(v) > 500 or v !~* '^https?://[^\s<>"]+$' then raise exception 'RECALL_BAD_LINK'; end if;
  return v;
end $fn$;

-- Разовый урок: длительность 15 мин – 8 ч; задним числом — до 60 дней (записать
-- прошедший урок), вперёд — до 400 дней.
create or replace function public.lesson_check_time(p_starts_at timestamptz, p_minutes int)
returns void language plpgsql stable set search_path = public as $fn$
begin
  if p_starts_at is null or p_minutes is null or p_minutes not between 15 and 480
     or p_starts_at < now() - interval '60 days' or p_starts_at > now() + interval '400 days' then
    raise exception 'RECALL_BAD_TIME';
  end if;
end $fn$;

-- Потолки строк одного учителя (PLAN.md Ф2.15, А3): живой репетитор до них не
-- дойдёт, а пробный аккаунт не раздует базу. Состав урока — до 30 (schedule_cards).
create or replace function public.schedule_limit(p_what text)
returns int language sql immutable set search_path = public as $fn$
  select case p_what
    when 'active_series' then 60     -- действующих серий
    when 'one_off_lessons' then 500  -- будущих разовых уроков
    when 'paid_rows' then 500        -- записей журнала оплат на карточку
  end
$fn$;

-- ---- служебное: состав и создание уроков --------------------------------------------
-- Ученики урока: свои карточки, не в архиве и не на паузе; в индивидуальном и
-- пробном — один, в группе — 1–30. Принимает чужой uid — закрыта.
create or replace function public.schedule_cards(p_teacher uuid, p_kind text, p_cards uuid[])
returns uuid[] language plpgsql stable security definer set search_path = public as $fn$
declare v uuid[]; n int; v_bad text;
begin
  select coalesce(array_agg(distinct x), '{}'::uuid[]) into v
    from unnest(coalesce(p_cards, '{}'::uuid[])) x where x is not null;
  n := cardinality(v);
  if (p_kind in ('individual', 'trial') and n <> 1) or (p_kind = 'group' and n not between 1 and 30) then
    raise exception 'RECALL_LESSON_CARDS';
  end if;
  if (select count(*) from student_cards c where c.id = any (v) and c.teacher_id = p_teacher) <> n then
    raise exception 'RECALL_CARD_NOT_FOUND';
  end if;
  select c.status into v_bad from student_cards c
   where c.id = any (v) and c.status in ('paused', 'archived')
   order by c.status = 'archived' desc limit 1;
  if v_bad = 'archived' then raise exception 'RECALL_CARD_ARCHIVED'; end if;
  if v_bad = 'paused' then raise exception 'RECALL_CARD_PAUSED'; end if;
  return v;
end $fn$;

-- Вписать карточки в урок; пробное участие — по типу урока и статусу карточки.
create or replace function public.lesson_join_cards(p_lesson uuid, p_cards uuid[])
returns void language sql volatile security definer set search_path = public as $fn$
  insert into lesson_participants (lesson_id, teacher_id, card_id, trial)
  select l.id, l.teacher_id, c.id, l.kind = 'trial' or c.status = 'trial'
    from lessons l
    join student_cards c on c.id = any (p_cards) and c.teacher_id = l.teacher_id
   where l.id = p_lesson
  on conflict (lesson_id, card_id) do nothing
$fn$;

-- Создать недостающие уроки серии на будущие дни окна (с p_from; null — с
-- сегодня). Существующие не трогает; день без учеников, которые занимаются
-- (все на паузе), пропускает — вернутся, урок появится (решение 1). Замок на
-- серии: разделение серии и будильник не создадут урок дважды.
create or replace function public.series_fill(p_series uuid, p_from date, p_now timestamptz)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  s record;
  v_today date := (p_now at time zone 'Asia/Almaty')::date;
  v_from date;
  v_to date;
  v_cards uuid[];
  v_at timestamptz;
  v_id uuid;
  d date;
  i int;
  n int := 0;
begin
  select * into s from lesson_series where id = p_series for update;
  if not found then return 0; end if;
  -- до окна или до уже созданного (вернулся с паузы — уроки возвращаются все)
  v_to := greatest(v_today + public.schedule_horizon_days(), s.generated_until);
  if s.ends_on is not null and s.ends_on < v_to then v_to := s.ends_on; end if;
  v_from := greatest(s.starts_on, v_today, coalesce(p_from, v_today));
  select coalesce(array_agg(sp.card_id), '{}'::uuid[]) into v_cards
    from series_participants sp
    join student_cards c on c.id = sp.card_id
   where sp.series_id = p_series and c.status in ('trial', 'active');
  if cardinality(v_cards) > 0 then
    for i in 0 .. (v_to - v_from) loop
      d := v_from + i;
      continue when not public.series_slot(s.weekdays, s.every_weeks, s.starts_on, s.ends_on, d);
      v_at := public.almaty_ts(d, s.start_time);
      continue when v_at <= p_now;
      v_id := null;
      insert into lessons (teacher_id, series_id, series_date, kind, starts_at, ends_at)
      values (s.teacher_id, s.id, d, s.kind, v_at, v_at + make_interval(mins => s.minutes))
      on conflict (series_id, series_date) where series_id is not null do nothing
      returning id into v_id;
      if v_id is not null then
        perform public.lesson_join_cards(v_id, v_cards);
        n := n + 1;
      end if;
    end loop;
  end if;
  update lesson_series set generated_until = greatest(generated_until, v_to) where id = p_series;
  return n;
end $fn$;

-- Крючок для уведомлений ученикам «перенесён / отменён» (Ф2.9, журнал п.42):
-- зовётся ОДИН раз на действие учителя — отмена серии одним сообщением.
-- p_change: kind ('lesson_updated' | 'lesson_cancelled' | 'lesson_restored' |
-- 'series_changed' | 'series_cancelled') и что изменилось. Пока пуст.
create or replace function public.after_lessons_changed(p_teacher uuid, p_change jsonb)
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  return;
end $fn$;

-- ---- остаток: одна функция из фактов -----------------------------------------------
-- Оплачено (сумма журнала) − списано (участия «списан» и «поздняя отмена»).
-- Ей пользуются экран учителя, тихая строка ученика (без минуса) и правило
-- «остался 1» (Ф2.8). Принимает любую карточку — закрыта.
create or replace function public.card_lesson_balance(p_card uuid)
returns table (paid int, charged int, balance int)
language sql stable security definer set search_path = public as $fn$
  select p.paid, c.charged, p.paid - c.charged
    from (select coalesce(sum(n), 0)::int as paid from paid_lessons where card_id = p_card) p,
         (select count(*)::int as charged from lesson_participants
           where card_id = p_card and charge in ('charged', 'late_cancel')) c
$fn$;

-- ---- статус карточки двигает её будущие уроки (решения 1 и 4) -------------------------
-- Пауза и архив: карточка уходит из будущих запланированных уроков (кроме уже
-- отмеченной поздней отмены — это факт); урок, где больше никого нет,
-- удаляется. Вернулась: снова в будущих уроках своих серий, недостающие уроки
-- создаются (если тариф позволяет). «Пробный» ↔ другой: пробное участие в
-- будущих уроках следует за статусом.
create or replace function public.trg_card_lessons()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare s record; v_lessons uuid[];
begin
  if new.status in ('paused', 'archived') and old.status in ('trial', 'active') then
    -- двумя командами: удаление в CTE не видно соседнему запросу той же команды
    with gone as (
      delete from lesson_participants lp
       using lessons l
       where lp.card_id = new.id and l.id = lp.lesson_id
         and l.status = 'planned' and l.starts_at > now()
         and lp.charge is distinct from 'late_cancel'
      returning lp.lesson_id
    )
    select coalesce(array_agg(lesson_id), '{}'::uuid[]) into v_lessons from gone;
    delete from lessons l
     where l.id = any (v_lessons)
       and not exists (select 1 from lesson_participants x where x.lesson_id = l.id);
  elsif new.status in ('trial', 'active') and old.status in ('paused', 'archived') then
    for s in
      select ls.id from series_participants sp join lesson_series ls on ls.id = sp.series_id
       where sp.card_id = new.id
         and (ls.ends_on is null or ls.ends_on >= (now() at time zone 'Asia/Almaty')::date)
    loop
      insert into lesson_participants (lesson_id, teacher_id, card_id, trial)
      select l.id, l.teacher_id, new.id, l.kind = 'trial' or new.status = 'trial'
        from lessons l
       where l.series_id = s.id and l.status = 'planned' and l.starts_at > now()
      on conflict (lesson_id, card_id) do nothing;
      if public.teacher_can_write(new.teacher_id) then
        perform public.series_fill(s.id, null, now());
      end if;
    end loop;
  end if;
  if (new.status = 'trial') <> (old.status = 'trial') then
    update lesson_participants lp
       set trial = l.kind = 'trial' or new.status = 'trial'
      from lessons l
     where lp.card_id = new.id and l.id = lp.lesson_id
       and l.starts_at > now() and lp.charge is null;
  end if;
  return new;
end $fn$;
create trigger student_cards_lessons after update of status on public.student_cards
  for each row when (old.status is distinct from new.status)
  execute function public.trg_card_lessons();

-- ---- запись: настройка и создание --------------------------------------------------
create or replace function public.set_default_lesson_link(p_link text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v text := public.lesson_link_clean(p_link);
begin
  perform public.assert_teacher_can_write();
  insert into schedule_settings (teacher_id, default_link, updated_at)
  values (auth.uid(), v, now())
  on conflict (teacher_id) do update set default_link = excluded.default_link, updated_at = now();
end $fn$;

-- Разовый урок (в том числе пробный). Прошедший — можно: будильник отметит его
-- «проведён» и спишет, как обычный.
create or replace function public.create_lesson(
  p_kind text, p_starts_at timestamptz, p_minutes int, p_cards uuid[],
  p_title text default null, p_link text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  v_cards uuid[];
  v_title text := public.card_text(p_title, 80);
  v_link text := public.lesson_link_clean(p_link);
  v_id uuid;
begin
  perform public.assert_teacher_can_write();
  if p_kind is null or p_kind not in ('individual', 'group', 'trial') then raise exception 'RECALL_BAD_KIND'; end if;
  perform public.lesson_check_time(p_starts_at, p_minutes);
  if (select count(*) from lessons where teacher_id = uid and series_id is null and starts_at > now())
     >= public.schedule_limit('one_off_lessons') then
    raise exception 'RECALL_SCHEDULE_LIMIT';
  end if;
  v_cards := public.schedule_cards(uid, p_kind, p_cards);
  if p_kind = 'group' and v_title is null then raise exception 'RECALL_GROUP_TITLE'; end if;
  -- ссылку, равную ссылке по умолчанию, не копируем: сменит её учитель — урок следом
  if v_link is not distinct from (select default_link from schedule_settings where teacher_id = uid) then
    v_link := null;
  end if;
  insert into lessons (teacher_id, kind, starts_at, ends_at, title, link)
  values (uid, p_kind, p_starts_at, p_starts_at + make_interval(mins => p_minutes), v_title, v_link)
  returning id into v_id;
  perform public.lesson_join_cards(v_id, v_cards);
  return v_id;
end $fn$;

-- Серия «каждый вт и чт в 19:00» (журнал п.31). Уроки — сразу на 12 недель
-- вперёд, дальше их создаёт будильник. Прошедшие дни не создаются.
create or replace function public.create_series(
  p_kind text, p_weekdays int[], p_time time, p_minutes int, p_every_weeks int,
  p_starts_on date, p_cards uuid[],
  p_ends_on date default null, p_title text default null, p_link text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Almaty')::date;
  v_days smallint[];
  v_cards uuid[];
  v_title text := public.card_text(p_title, 80);
  v_link text := public.lesson_link_clean(p_link);
  v_id uuid;
begin
  perform public.assert_teacher_can_write();
  if p_kind is null or p_kind not in ('individual', 'group') then raise exception 'RECALL_BAD_KIND'; end if;
  v_days := public.series_days(p_weekdays);
  if p_time is null or p_minutes is null or p_minutes not between 15 and 480 then raise exception 'RECALL_BAD_TIME'; end if;
  if p_every_weeks is null or p_every_weeks not in (1, 2)
     or p_starts_on is null or p_starts_on not between v_today - 366 and v_today + 366
     or (p_ends_on is not null and (p_ends_on < p_starts_on or p_ends_on > p_starts_on + 366 * 2))
     -- хотя бы один урок: первые две недели серии
     or not exists (
       select 1 from generate_series(0, 13) g
        where public.series_slot(v_days, p_every_weeks::smallint, p_starts_on, p_ends_on, p_starts_on + g)
     ) then
    raise exception 'RECALL_BAD_REPEAT';
  end if;
  if (select count(*) from lesson_series where teacher_id = uid and (ends_on is null or ends_on >= v_today))
     >= public.schedule_limit('active_series') then
    raise exception 'RECALL_SCHEDULE_LIMIT';
  end if;
  v_cards := public.schedule_cards(uid, p_kind, p_cards);
  if p_kind = 'group' and v_title is null then raise exception 'RECALL_GROUP_TITLE'; end if;
  if v_link is not distinct from (select default_link from schedule_settings where teacher_id = uid) then
    v_link := null;
  end if;
  insert into lesson_series (teacher_id, kind, title, weekdays, start_time, minutes, every_weeks, starts_on, ends_on, link)
  values (uid, p_kind, v_title, v_days, p_time, p_minutes, p_every_weeks, p_starts_on, p_ends_on, v_link)
  returning id into v_id;
  insert into series_participants (series_id, teacher_id, card_id)
  select v_id, uid, unnest(v_cards);
  perform public.series_fill(v_id, null, now());
  return v_id;
end $fn$;

-- ---- запись: «только этот» -----------------------------------------------------------
-- Перенос и правка одного урока: время, длительность, тип, состав, название,
-- ссылка. Урок остаётся в серии (день серии не меняется) — перенос серию не
-- рвёт. Название и ссылка, равные унаследованным, не копируются.
create or replace function public.update_lesson(
  p_lesson uuid, p_kind text, p_starts_at timestamptz, p_minutes int, p_cards uuid[],
  p_title text default null, p_link text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  s record;
  v_cards uuid[];
  v_title text := public.card_text(p_title, 80);
  v_link text := public.lesson_link_clean(p_link);
  v_version int;
begin
  perform public.assert_teacher_can_write();
  select * into l from lessons where id = p_lesson and teacher_id = uid for update;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.status = 'cancelled' then raise exception 'RECALL_LESSON_CANCELLED'; end if;
  if l.status = 'done' then raise exception 'RECALL_LESSON_CLOSED'; end if;
  if p_kind is null or p_kind not in ('individual', 'group', 'trial') then raise exception 'RECALL_BAD_KIND'; end if;
  -- тип начавшегося урока не меняем: пробное участие уже зафиксировано
  if p_kind <> l.kind and l.starts_at <= now() then raise exception 'RECALL_LESSON_PAST'; end if;
  if p_kind = 'trial' and exists (
    select 1 from lesson_participants where lesson_id = l.id and charge = 'late_cancel'
  ) then
    raise exception 'RECALL_TRIAL_FREE';
  end if;
  perform public.lesson_check_time(p_starts_at, p_minutes);
  v_cards := public.schedule_cards(uid, p_kind, p_cards);
  select * into s from lesson_series where id = l.series_id;
  if p_kind = 'group' and coalesce(v_title, s.title) is null then raise exception 'RECALL_GROUP_TITLE'; end if;
  if v_title is not distinct from s.title then v_title := null; end if;
  if v_link is not distinct from coalesce(s.link, (select default_link from schedule_settings where teacher_id = uid)) then
    v_link := null;
  end if;

  update lessons
     set kind = p_kind,
         starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => p_minutes),
         title = v_title,
         link = v_link,
         moved_from = case
           when p_starts_at = l.starts_at then l.moved_from
           when p_starts_at = l.moved_from then null
           else coalesce(l.moved_from, l.starts_at)
         end,
         -- перенесли пропущенный (без тарифа) урок в будущее — будильник
         -- обработает его заново
         settled_at = case
           when p_starts_at + make_interval(mins => p_minutes) > now() then null
           else l.settled_at
         end
   where id = l.id
  returning version into v_version;

  delete from lesson_participants where lesson_id = l.id and card_id <> all (v_cards);
  perform public.lesson_join_cards(l.id, v_cards);
  if p_starts_at > now() then
    update lesson_participants lp
       set trial = p_kind = 'trial' or c.status = 'trial'
      from student_cards c
     where lp.lesson_id = l.id and c.id = lp.card_id and lp.charge is null;
  end if;

  if v_version > l.version then
    perform public.after_lessons_changed(uid, jsonb_build_object(
      'kind', 'lesson_updated', 'lesson', l.id, 'version', v_version,
      'from', l.starts_at, 'to', p_starts_at));
  end if;
end $fn$;

-- Отмена одного урока (журнал п.27): «не списывать» или «списать — поздняя
-- отмена». Можно и задним числом — исправить проведённый. Пробное участие не
-- списывается и при поздней отмене.
create or replace function public.lesson_cancel(p_lesson uuid, p_charge boolean)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare v_version int;
begin
  update lessons
     set status = 'cancelled', cancelled_at = now(), settled_at = coalesce(settled_at, now())
   where id = p_lesson
  returning version into v_version;
  update lesson_participants
     set attended = false,
         charge = case when coalesce(p_charge, false) and not trial then 'late_cancel' else 'not_charged' end,
         charge_auto = false, marked_at = now()
   where lesson_id = p_lesson;
  return v_version;
end $fn$;

create or replace function public.cancel_lesson(p_lesson uuid, p_charge boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); l record; v_version int;
begin
  perform public.assert_teacher_can_write();
  select * into l from lessons where id = p_lesson and teacher_id = uid for update;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.status = 'cancelled' then return; end if;
  v_version := public.lesson_cancel(l.id, p_charge);
  perform public.after_lessons_changed(uid, jsonb_build_object(
    'kind', 'lesson_cancelled', 'lesson', l.id, 'version', v_version, 'at', l.starts_at));
end $fn$;

-- Вернуть отменённый урок. Отметки сбрасываются; закончившийся будильник
-- спишет заново по общему правилу.
create or replace function public.restore_lesson(p_lesson uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); l record; v_version int;
begin
  perform public.assert_teacher_can_write();
  select * into l from lessons where id = p_lesson and teacher_id = uid for update;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.status <> 'cancelled' then return; end if;
  update lessons set status = 'planned', cancelled_at = null, settled_at = null
   where id = l.id
  returning version into v_version;
  update lesson_participants
     set attended = null, charge = null, charge_auto = false, marked_at = null
   where lesson_id = l.id;
  if l.starts_at > now() then
    update lesson_participants lp
       set trial = l.kind = 'trial' or c.status = 'trial'
      from student_cards c
     where lp.lesson_id = l.id and c.id = lp.card_id;
  end if;
  perform public.after_lessons_changed(uid, jsonb_build_object(
    'kind', 'lesson_restored', 'lesson', l.id, 'version', v_version, 'at', l.starts_at));
end $fn$;

-- Отметка одного участника (журнал п.27, 43): «был» (списан; пробный — нет),
-- «был, не списывать», «не был» (не списан), «поздняя отмена» (списан).
-- До начала урока — только «не был» и «поздняя отмена». Исправление задним
-- числом — та же функция: остаток пересчитается сам.
create or replace function public.mark_lesson_participant(p_lesson uuid, p_card uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  v_trial boolean;
begin
  perform public.assert_teacher_can_write();
  if p_outcome is null or p_outcome not in ('present', 'present_free', 'absent', 'late_cancel') then
    raise exception 'RECALL_BAD_OUTCOME';
  end if;
  select * into l from lessons where id = p_lesson and teacher_id = uid for update;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.status = 'cancelled' then raise exception 'RECALL_LESSON_CANCELLED'; end if;
  if p_outcome in ('present', 'present_free') and l.starts_at > now() then
    raise exception 'RECALL_LESSON_NOT_STARTED';
  end if;
  select lp.trial into v_trial from lesson_participants lp where lp.lesson_id = l.id and lp.card_id = p_card;
  if not found then raise exception 'RECALL_NOT_IN_LESSON'; end if;
  -- до начала пробное участие следует за статусом карточки (решение 4)
  if l.starts_at > now() then
    select l.kind = 'trial' or c.status = 'trial' into v_trial from student_cards c where c.id = p_card;
  end if;
  if p_outcome = 'late_cancel' and v_trial then raise exception 'RECALL_TRIAL_FREE'; end if;

  update lesson_participants
     set trial = v_trial,
         attended = p_outcome in ('present', 'present_free'),
         charge = case
           when p_outcome = 'present' and not v_trial then 'charged'
           when p_outcome = 'late_cancel' then 'late_cancel'
           else 'not_charged'
         end,
         charge_auto = false,
         marked_at = now()
   where lesson_id = l.id and card_id = p_card;

  -- закончившийся урок, где отмечены все, — «проведён»
  if l.status = 'planned' and l.ends_at <= now() and not exists (
    select 1 from lesson_participants where lesson_id = l.id and charge is null
  ) then
    update lessons set status = 'done', settled_at = coalesce(settled_at, now()) where id = l.id;
  end if;
end $fn$;

-- ---- запись: «этот и все следующие» ----------------------------------------------------
-- Делит серию на дне выбранного урока: старая кончается накануне, новая — с
-- новыми днями, временем, составом. Уроки старой серии с этого дня (решение 3):
--   * факты (начался или отмечено списание) — остаются отдельными уроками;
--   * отменённые — становятся уроками новой серии, если их день в ней есть
--     (отменённый праздник не воскреснет), иначе удаляются;
--   * остальные, в том числе перенесённые отдельно, — создаются заново.
create or replace function public.update_series_from(
  p_lesson uuid, p_kind text, p_weekdays int[], p_time time, p_minutes int, p_every_weeks int,
  p_cards uuid[], p_ends_on date default null, p_title text default null, p_link text default null
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  s record;
  v_from date;
  v_days smallint[];
  v_cards uuid[];
  v_title text := public.card_text(p_title, 80);
  v_link text := public.lesson_link_clean(p_link);
  v_new uuid;
begin
  perform public.assert_teacher_can_write();
  select * into l from lessons where id = p_lesson and teacher_id = uid;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.series_id is null then raise exception 'RECALL_NOT_SERIES'; end if;
  select * into s from lesson_series where id = l.series_id for update;
  if l.starts_at <= now() then raise exception 'RECALL_LESSON_PAST'; end if;
  v_from := l.series_date;

  if p_kind is null or p_kind not in ('individual', 'group') then raise exception 'RECALL_BAD_KIND'; end if;
  v_days := public.series_days(p_weekdays);
  if p_time is null or p_minutes is null or p_minutes not between 15 and 480 then raise exception 'RECALL_BAD_TIME'; end if;
  if p_every_weeks is null or p_every_weeks not in (1, 2)
     or (p_ends_on is not null and (p_ends_on < v_from or p_ends_on > v_from + 366 * 2))
     or not exists (
       select 1 from generate_series(0, 13) g
        where public.series_slot(v_days, p_every_weeks::smallint, v_from, p_ends_on, v_from + g)
     ) then
    raise exception 'RECALL_BAD_REPEAT';
  end if;
  v_cards := public.schedule_cards(uid, p_kind, p_cards);
  if p_kind = 'group' and v_title is null then raise exception 'RECALL_GROUP_TITLE'; end if;
  if v_link is not distinct from (select default_link from schedule_settings where teacher_id = uid) then
    v_link := null;
  end if;

  insert into lesson_series (teacher_id, kind, title, weekdays, start_time, minutes, every_weeks, starts_on, ends_on, link, split_from)
  values (uid, p_kind, v_title, v_days, p_time, p_minutes, p_every_weeks, v_from, p_ends_on, v_link, s.id)
  returning id into v_new;
  insert into series_participants (series_id, teacher_id, card_id)
  select v_new, uid, unnest(v_cards);

  -- факты — отдельными уроками
  update lessons x set series_id = null, series_date = null
   where x.series_id = s.id and x.series_date >= v_from
     and (x.starts_at <= now() or exists (
       select 1 from lesson_participants lp where lp.lesson_id = x.id and lp.charge in ('charged', 'late_cancel')));
  -- отменённые — в новую серию, если их день в ней есть
  update lessons x set series_id = v_new
   where x.series_id = s.id and x.series_date >= v_from and x.status = 'cancelled'
     and public.series_slot(v_days, p_every_weeks::smallint, v_from, p_ends_on, x.series_date);
  -- остальное — заново по новому расписанию
  delete from lessons x where x.series_id = s.id and x.series_date >= v_from;

  if exists (select 1 from lessons where series_id = s.id) then
    update lesson_series set ends_on = v_from - 1, updated_at = now() where id = s.id;
  else
    -- делили с первого урока: от старой серии ничего не осталось
    update lesson_series set split_from = s.split_from where id = v_new;
    delete from lesson_series where id = s.id;
  end if;
  perform public.series_fill(v_new, null, now());

  perform public.after_lessons_changed(uid, jsonb_build_object(
    'kind', 'series_changed', 'series', s.id, 'new_series', v_new, 'since', v_from));
  return v_new;
end $fn$;

-- Отмена серии с этого урока: он сам — отменён (с выбором списания), серия
-- кончается в его день, будущие уроки после него удаляются; факты (начался или
-- отмечено списание) остаются отдельными уроками.
create or replace function public.cancel_series_from(p_lesson uuid, p_charge boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  l record;
  s record;
begin
  perform public.assert_teacher_can_write();
  select * into l from lessons where id = p_lesson and teacher_id = uid for update;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.series_id is null then raise exception 'RECALL_NOT_SERIES'; end if;
  select * into s from lesson_series where id = l.series_id for update;
  if l.starts_at <= now() then raise exception 'RECALL_LESSON_PAST'; end if;

  if l.status <> 'cancelled' then perform public.lesson_cancel(l.id, p_charge); end if;
  update lessons x set series_id = null, series_date = null
   where x.series_id = s.id and x.series_date > l.series_date
     and (x.starts_at <= now() or exists (
       select 1 from lesson_participants lp where lp.lesson_id = x.id and lp.charge in ('charged', 'late_cancel')));
  delete from lessons x where x.series_id = s.id and x.series_date > l.series_date;
  update lesson_series set ends_on = l.series_date, updated_at = now() where id = s.id;

  perform public.after_lessons_changed(uid, jsonb_build_object(
    'kind', 'series_cancelled', 'series', s.id, 'since', l.series_date, 'lesson', l.id));
end $fn$;

-- ---- запись: оплата «+N» -------------------------------------------------------------------
-- Учитель отмечает оплату числом уроков, без суммы (журнал п.29). Минус —
-- исправление, но не больше уже отмеченного.
create or replace function public.add_paid_lessons(p_card uuid, p_count int, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); v_id uuid; v_paid int;
begin
  perform public.assert_teacher_can_write();
  perform 1 from student_cards where id = p_card and teacher_id = uid for update;
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
  if p_count is null or p_count = 0 or p_count not between -100 and 100 then raise exception 'RECALL_BAD_COUNT'; end if;
  if (select count(*) from paid_lessons where card_id = p_card) >= public.schedule_limit('paid_rows') then
    raise exception 'RECALL_SCHEDULE_LIMIT';
  end if;
  if p_count < 0 then
    select coalesce(sum(n), 0) into v_paid from paid_lessons where card_id = p_card;
    if v_paid + p_count < 0 then raise exception 'RECALL_BAD_COUNT'; end if;
  end if;
  insert into paid_lessons (teacher_id, card_id, n, note, created_by)
  values (uid, p_card, p_count, public.card_text(p_note, 200), uid)
  returning id into v_id;
  return v_id;
end $fn$;

-- ---- будильник -----------------------------------------------------------------------------
-- 1. Закончившиеся уроки: тариф есть — «проведён», неотмеченным «был, списан»
--    (пробному — «не списан»); тарифа нет — урок помечается обработанным и
--    остаётся «не отмечен» навсегда, после оплаты задним числом не списывается
--    (решение 2).
-- 2. Окно уроков серий — на 12 недель вперёд; без тарифа не растёт.
-- p_now — параметром: проверка прогоняет «после урока», не дожидаясь его.
create or replace function public.schedule_tick(p_now timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  l record;
  s record;
  v_today date := (p_now at time zone 'Asia/Almaty')::date;
  v_settled int := 0;
  v_skipped int := 0;
  v_created int := 0;
begin
  for l in
    select x.id, x.teacher_id from lessons x
     where x.status = 'planned' and x.settled_at is null and x.ends_at <= p_now
     order by x.ends_at
     limit 2000
     for update skip locked
  loop
    if public.teacher_can_write(l.teacher_id) then
      update lesson_participants
         set attended = true,
             charge = case when trial then 'not_charged' else 'charged' end,
             charge_auto = true, marked_at = p_now
       where lesson_id = l.id and charge is null;
      update lessons set status = 'done', settled_at = p_now where id = l.id;
      v_settled := v_settled + 1;
    else
      update lessons set settled_at = p_now where id = l.id;
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  for s in
    select x.id, x.generated_until from lesson_series x
     where (x.generated_until is null
            or x.generated_until < least(coalesce(x.ends_on, 'infinity'::date), v_today + public.schedule_horizon_days()))
       and public.teacher_can_write(x.teacher_id)
  loop
    v_created := v_created + public.series_fill(s.id, s.generated_until + 1, p_now);
  end loop;

  return jsonb_build_object('settled', v_settled, 'skipped', v_skipped, 'created', v_created);
end $fn$;

select cron.schedule('recall-schedule', '*/5 * * * *', $cron$select public.schedule_tick(now())$cron$);

-- ---- чтение: учитель ---------------------------------------------------------------------
-- Уроки за период — строка на участника (урок без участников — одна строка с
-- пустым участником). Работает и без тарифа: расписание видно (п.41).
create or replace function public.get_schedule(p_from timestamptz, p_to timestamptz)
returns table (
  lesson_id uuid, series_id uuid, series_date date, kind text, status text,
  starts_at timestamptz, ends_at timestamptz, title text, link text,
  moved_from timestamptz, version int, settled boolean,
  card_id uuid, card_name text, card_status text,
  trial boolean, attended boolean, charge text, charge_auto boolean
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '100 days' then
    raise exception 'RECALL_BAD_RANGE';
  end if;
  return query
  select l.id, l.series_id, l.series_date, l.kind, l.status, l.starts_at, l.ends_at,
         coalesce(l.title, s.title),
         coalesce(l.link, s.link, ss.default_link),
         l.moved_from, l.version, l.settled_at is not null,
         c.id, c.name, c.status,
         lp.trial, lp.attended, lp.charge, coalesce(lp.charge_auto, false)
    from lessons l
    left join lesson_series s on s.id = l.series_id
    left join schedule_settings ss on ss.teacher_id = l.teacher_id
    left join lesson_participants lp on lp.lesson_id = l.id
    left join student_cards c on c.id = lp.card_id
   where l.teacher_id = uid and l.starts_at >= p_from and l.starts_at < p_to
   order by l.starts_at, l.id, c.name, c.id;
end $fn$;

-- Действующие серии учителя: для формы «этот и все следующие».
create or replace function public.get_my_series()
returns table (
  id uuid, kind text, title text, weekdays smallint[], start_time time, minutes int,
  every_weeks smallint, starts_on date, ends_on date, link text, card_ids uuid[], split_from uuid
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return query
  select s.id, s.kind, s.title, s.weekdays, s.start_time, s.minutes, s.every_weeks,
         s.starts_on, s.ends_on, coalesce(s.link, ss.default_link),
         coalesce((select array_agg(sp.card_id order by sp.card_id) from series_participants sp where sp.series_id = s.id), '{}'::uuid[]),
         s.split_from
    from lesson_series s
    left join schedule_settings ss on ss.teacher_id = s.teacher_id
   where s.teacher_id = uid
     and (s.ends_on is null or s.ends_on >= (now() at time zone 'Asia/Almaty')::date)
   order by s.starts_on, s.id;
end $fn$;

-- Остатки по всем карточкам учителя — той же card_lesson_balance. Минус
-- видит только учитель (журнал п.29).
create or replace function public.get_lesson_balances()
returns table (card_id uuid, paid int, charged int, balance int)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return query
  select c.id, b.paid, b.charged, b.balance
    from student_cards c
   cross join lateral public.card_lesson_balance(c.id) b
   where c.teacher_id = uid
   order by c.created_at, c.id;
end $fn$;

create or replace function public.get_schedule_settings()
returns table (default_link text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return query
  select (select ss.default_link from schedule_settings ss where ss.teacher_id = uid);
end $fn$;

-- ---- чтение: ученик ----------------------------------------------------------------------
-- «Мои уроки» (журнал п.32, 43): только уроки, где есть его карточка, пока он
-- привязан к учителю. Название группы и время — да; другие участники, отметки
-- и списания — нет.
create or replace function public.get_my_lessons(p_from timestamptz, p_to timestamptz)
returns table (
  lesson_id uuid, teacher_id uuid, teacher_name text, kind text, status text,
  starts_at timestamptz, ends_at timestamptz, title text, link text,
  moved_from timestamptz, version int
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '100 days' then
    raise exception 'RECALL_BAD_RANGE';
  end if;
  return query
  select l.id, l.teacher_id, coalesce(nullif(btrim(tp.display_name), ''), 'Преподаватель'),
         l.kind, l.status, l.starts_at, l.ends_at,
         coalesce(l.title, s.title),
         coalesce(l.link, s.link, ss.default_link),
         l.moved_from, l.version
    from student_cards c
    join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = uid
    join lesson_participants lp on lp.card_id = c.id
    join lessons l on l.id = lp.lesson_id
    join profiles tp on tp.id = l.teacher_id
    left join lesson_series s on s.id = l.series_id
    left join schedule_settings ss on ss.teacher_id = l.teacher_id
   where c.user_id = uid and l.starts_at >= p_from and l.starts_at < p_to
   order by l.starts_at, l.id;
end $fn$;

-- Остаток ученику — одним числом и без минуса (журнал п.33): ноль и минус —
-- «0». tracked — ведёт ли учитель учёт оплат этой карточки вообще: без него
-- «оплаченные уроки закончились» показывать нельзя.
create or replace function public.get_my_lesson_balances()
returns table (teacher_id uuid, teacher_name text, tracked boolean, lessons_left int)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return query
  select c.teacher_id, coalesce(nullif(btrim(tp.display_name), ''), 'Преподаватель'),
         exists (select 1 from paid_lessons pl where pl.card_id = c.id),
         greatest(b.balance, 0)
    from student_cards c
    join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = uid
    join profiles tp on tp.id = c.teacher_id
   cross join lateral public.card_lesson_balance(c.id) b
   where c.user_id = uid
   order by c.created_at, c.id;
end $fn$;

-- ---- права: служебное — закрыто и от вошедших -------------------------------------------
revoke execute on function public.card_lesson_balance(uuid) from authenticated;
revoke execute on function public.schedule_cards(uuid, text, uuid[]) from authenticated;
revoke execute on function public.lesson_join_cards(uuid, uuid[]) from authenticated;
revoke execute on function public.series_fill(uuid, date, timestamptz) from authenticated;
revoke execute on function public.lesson_cancel(uuid, boolean) from authenticated;
revoke execute on function public.after_lessons_changed(uuid, jsonb) from authenticated;
revoke execute on function public.schedule_tick(timestamptz) from authenticated;
revoke execute on function public.trg_card_lessons() from authenticated;
revoke execute on function public.trg_lesson_version() from authenticated;
revoke execute on function public.trg_paid_lessons_append_only() from authenticated;

-- ---- блок-страховка: последним в каждой миграции ----
do $harden$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.proname <> 'track_event'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $harden$;

grant execute on function public.track_event(text, jsonb, uuid, text) to anon, authenticated;
