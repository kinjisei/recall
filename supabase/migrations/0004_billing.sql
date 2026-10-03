-- 0004 — оплата тарифа (PLAN.md Ф2.1; архитектура §9; журнал п.13, 16)
-- ============================================================================
-- Раньше оплата была переводом на Kaspi и ручным включением тарифа без
-- записи: кто, сколько и за что заплатил, нигде не оставалось. Теперь:
--
--   payments            журнал подтверждённых оплат: кто, тариф, сколько
--                       месяцев, сумма, способ, какой срок куплен, кто
--                       подтвердил. Пишет ТОЛЬКО confirm_payment
--   payment_claims      «Оплата отправлена»: заявка человека, которую
--                       владелец сверяет с Kaspi. Одна открытая на человека
--   personal_codes      личный код («MADINA7») — его пишут в сообщении к
--                       переводу, по нему владелец находит человека
--   confirm_payment()   ЕДИНСТВЕННОЕ место правила «оплата → тариф»: в одной
--                       транзакции запись оплаты → продление тарифа →
--                       закрытие заявки → крючок рефералки (Ф2.3) →
--                       уведомление человеку → событие воронки
--   report_payment_sent()      кнопка «Оплата отправлена»
--   get_pay_info()             экрану «Как оплатить»: код, тариф, открытая заявка
--   admin_payment_claims()     владельцу: заявки, ждущие подтверждения
--   admin_dismiss_payment_claim()  владельцу: деньги не пришли — убрать заявку
--   admin_recent_payments()    владельцу: последние оплаты
--   admin_find_user()          + поиск по личному коду
--
-- Правило продления (решения владельца 03.10.2026): срок считается от
-- самой поздней из дат «сейчас», «конец действующего тарифа», «конец
-- пробного периода». То есть действующий тариф продлевается от даты
-- окончания, истёкший — от сегодня, а оплата во время пробного не съедает
-- его оставшиеся дни. Новый тариф включается сразу. Месяцы считаются по
-- календарю Алматы (16 октября → 16 ноября), как дневные границы.
--
-- Способ оплаты — данные, а не код (журнал п.13): сейчас перевод на Kaspi
-- Gold, потом Kaspi Pay / карта добавятся ещё одним method без переделки.
-- ============================================================================

-- ---- журнал оплат -------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- аккаунт удалили — оплата остаётся в учёте выручки, но уже ничья
  user_id uuid references auth.users (id) on delete set null,
  plan text not null check (plan in ('premium', 'teacher_mini', 'teacher_start', 'teacher_pro')),
  months int not null check (months between 1 and 12),
  -- сумма в тенге — то, что пришло на счёт, а не цена из каталога
  amount int not null check (amount > 0),
  method text not null check (method in ('kaspi_gold', 'kaspi_pay', 'card')),
  note text check (length(note) <= 500),
  -- какой срок купила эта оплата
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  -- номер нажатия «Подтвердить»: повтор того же нажатия (ответ потерялся в
  -- сети) не продлевает тариф второй раз
  request_id uuid unique
);
create index payments_user on public.payments (user_id);
create index payments_confirmed_at on public.payments (confirmed_at desc);

alter table public.payments enable row level security;
-- читать и писать напрямую не может никто: пишет confirm_payment, читают admin_*
revoke all on public.payments from anon, authenticated;

-- ---- заявки «Оплата отправлена» --------------------------------------------------
create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('premium', 'teacher_mini', 'teacher_start', 'teacher_pro')),
  months int not null default 1 check (months between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- confirmed — оплату подтвердили; dismissed — деньги не нашлись
  outcome text check (outcome in ('confirmed', 'dismissed')),
  payment_id uuid references public.payments (id) on delete set null,
  constraint payment_claims_resolved check ((resolved_at is null) = (outcome is null))
);
-- одна открытая заявка на человека: повторное нажатие обновляет её, а не
-- присылает владельцу ещё одно уведомление
create unique index payment_claims_one_open on public.payment_claims (user_id) where resolved_at is null;

alter table public.payment_claims enable row level security;
revoke all on public.payment_claims from anon, authenticated;

-- ---- личный код ------------------------------------------------------------------
create table public.personal_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- буквы имени латиницей и цифры 2–9 (без 0/1 — их путают с O/I)
  code text not null unique check (code ~ '^[A-Z]{2,8}[2-9]{1,4}$'),
  created_at timestamptz not null default now()
);
alter table public.personal_codes enable row level security;
revoke all on public.personal_codes from anon, authenticated;

-- Буквы строки латиницей, заглавными; всё, что не буква, выпадает.
-- Таблица соответствий, а не translate(): translate молча УДАЛЯЕТ символ,
-- которому не нашлось пары, и не умеет «ж» → «ZH».
create or replace function public.latin_letters(p text)
returns text language sql immutable set search_path = public as $fn$
  select coalesce(string_agg(coalesce(m.lat, case when t.ch ~ '^[a-z]$' then upper(t.ch) else '' end), '' order by t.i), '')
    from unnest(string_to_array(lower(coalesce(p, '')), null)) with ordinality as t(ch, i)
    left join (values
      ('а', 'A'), ('б', 'B'), ('в', 'V'), ('г', 'G'), ('д', 'D'), ('е', 'E'), ('ё', 'E'),
      ('ж', 'ZH'), ('з', 'Z'), ('и', 'I'), ('й', 'Y'), ('к', 'K'), ('л', 'L'), ('м', 'M'),
      ('н', 'N'), ('о', 'O'), ('п', 'P'), ('р', 'R'), ('с', 'S'), ('т', 'T'), ('у', 'U'),
      ('ф', 'F'), ('х', 'KH'), ('ц', 'TS'), ('ч', 'CH'), ('ш', 'SH'), ('щ', 'SCH'), ('ъ', ''),
      ('ы', 'Y'), ('ь', ''), ('э', 'E'), ('ю', 'YU'), ('я', 'YA'),
      -- казахские
      ('ә', 'A'), ('ғ', 'G'), ('қ', 'Q'), ('ң', 'N'), ('ө', 'O'), ('ұ', 'U'), ('ү', 'U'),
      ('һ', 'H'), ('і', 'I')
    ) as m(cyr, lat) on m.cyr = t.ch
$fn$;
revoke execute on function public.latin_letters(text) from authenticated;

-- Личный код человека: создаётся при первом заходе на «Как оплатить» и
-- больше не меняется (имя сменил — код тот же: по нему уже платили).
-- Принимает чужой uid — закрыта от authenticated.
create or replace function public.ensure_personal_code(p_user uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_code text;
  v_base text;
  v_name text;
  v_email text;
  v_digits int;
begin
  select code into v_code from personal_codes where user_id = p_user;
  if v_code is not null then return v_code; end if;

  select p.display_name, u.email into v_name, v_email
    from auth.users u left join profiles p on p.id = u.id
   where u.id = p_user;
  if not found then raise exception 'Пользователь не найден.'; end if;

  -- первое слово имени → начало адреса почты → RECALL
  v_base := left(public.latin_letters(split_part(trim(coalesce(v_name, '')), ' ', 1)), 8);
  if length(v_base) < 2 then
    v_base := left(public.latin_letters(split_part(coalesce(v_email, ''), '@', 1)), 8);
  end if;
  if length(v_base) < 2 then v_base := 'RECALL'; end if;

  -- цифры: сначала одна (MADINA7), у частых имён — больше; 2–9, без 0 и 1
  for i in 1..60 loop
    v_digits := case when i <= 6 then 1 when i <= 20 then 2 when i <= 40 then 3 else 4 end;
    v_code := v_base || (
      select string_agg((2 + floor(random() * 8))::int::text, '') from generate_series(1, v_digits)
    );
    insert into personal_codes (user_id, code) values (p_user, v_code)
    on conflict do nothing
    returning code into v_code;
    if v_code is not null then return v_code; end if;
    -- конфликт по человеку (код создали параллельно) — вернуть тот
    select code into v_code from personal_codes where user_id = p_user;
    if v_code is not null then return v_code; end if;
  end loop;
  raise exception 'Не удалось придумать код — попробуй ещё раз.';
end $fn$;
revoke execute on function public.ensure_personal_code(uuid) from authenticated;

-- ---- экрану «Как оплатить» ----------------------------------------------------------
-- Ответы — таблицей, а не json: так типы для клиента генерируются точными
-- (архитектура §8, «as unknown as для ответов базы запрещён»).
create or replace function public.get_pay_info()
returns table (
  code text, role text, plan text, plan_expires_at timestamptz, trial_until timestamptz,
  -- открытая заявка «Оплата отправлена»; нет — null
  claim_id uuid, claim_plan text, claim_months int, claim_created_at timestamptz
)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_code text;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  v_code := public.ensure_personal_code(uid);
  return query
    select v_code, p.role, p.plan, p.plan_expires_at, p.trial_until,
           c.id, c.plan, c.months, c.created_at
      from profiles p
      left join payment_claims c on c.user_id = p.id and c.resolved_at is null
     where p.id = uid;
end $fn$;

-- ---- «Оплата отправлена» -------------------------------------------------------------
-- Сумму не принимает: заявка — только сигнал «проверь Kaspi», сумму владелец
-- вводит при подтверждении ту, что пришла на счёт.
create or replace function public.report_payment_sent(p_plan text, p_months int default 1)
returns table (id uuid, plan text, months int, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_claim payment_claims;
  v_new boolean := false;
  v_name text;
  a record;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if p_plan is null or p_plan not in ('premium', 'teacher_mini', 'teacher_start', 'teacher_pro') then
    raise exception 'RECALL_BAD_PLAN';
  end if;
  if p_months is null or p_months not between 1 and 12 then
    raise exception 'Срок — от 1 до 12 месяцев.';
  end if;

  -- открытая заявка уже есть — обновить её (выбрал другой тариф), владельцу
  -- второе уведомление не нужно: в списке заявок он увидит свежее
  update payment_claims set plan = p_plan, months = p_months, updated_at = now()
   where user_id = uid and resolved_at is null
  returning * into v_claim;
  if not found then
    insert into payment_claims (user_id, plan, months) values (uid, p_plan, p_months)
    on conflict do nothing
    returning * into v_claim;
    v_new := found;
    -- параллельное нажатие успело первым — отдать его заявку
    if not v_new then
      select * into v_claim from payment_claims where user_id = uid and resolved_at is null;
    end if;
  end if;

  if v_new then
    select coalesce(nullif(trim(display_name), ''), 'Без имени') into v_name from profiles where id = uid;
    for a in select id from profiles where is_admin loop
      perform public.notify(a.id, 'payment_reported',
        jsonb_build_object('name', v_name, 'claim_id', v_claim.id, 'href', '/admin'),
        'payment_claim:' || v_claim.id);
    end loop;
  end if;

  return query select v_claim.id, v_claim.plan, v_claim.months, v_claim.created_at;
end $fn$;

-- ---- крючок рефералки -----------------------------------------------------------------
-- Зовётся confirm_payment в той же транзакции после продления тарифа.
-- Наполняется в Ф2.3 (журнал п.16: первая оплата приглашённого → +1 месяц
-- пригласившему) — create or replace следующей миграцией, без правки
-- confirm_payment. Принимает чужую оплату — закрыт от authenticated.
create or replace function public.after_payment_confirmed(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  -- пока ничего: рефералка — PLAN.md Ф2.3
  return;
end $fn$;
revoke execute on function public.after_payment_confirmed(uuid) from authenticated;

-- ---- подтвердить оплату (только владелец) ---------------------------------------------
create or replace function public.confirm_payment(
  p_user uuid,
  p_plan text,
  p_months int,
  p_amount int,
  p_method text default 'kaspi_gold',
  p_note text default null,
  p_claim uuid default null,
  p_request uuid default null
)
returns table (id uuid, plan text, starts_at timestamptz, ends_at timestamptz, repeated boolean)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  prof record;
  v_pay payments;
  v_start timestamptz;
  v_end timestamptz;
  v_anon uuid;
begin
  if not exists (select 1 from profiles where id = me and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  if p_plan is null or p_plan not in ('premium', 'teacher_mini', 'teacher_start', 'teacher_pro') then
    raise exception 'RECALL_BAD_PLAN';
  end if;
  if p_months is null or p_months not between 1 and 12 then
    raise exception 'Срок — от 1 до 12 месяцев.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма должна быть больше нуля.';
  end if;
  if p_method is null or p_method not in ('kaspi_gold', 'kaspi_pay', 'card') then
    raise exception 'Неизвестный способ оплаты.';
  end if;

  -- строка человека под замком: два подтверждения одному человеку идут по
  -- очереди, второе видит срок, уже продлённый первым
  select plan, plan_expires_at, trial_until into prof from profiles where id = p_user for update;
  if not found then raise exception 'Пользователь не найден.'; end if;

  -- то же нажатие ещё раз (ответ потерялся) — тот же итог, без второго продления.
  -- Проверка ПОСЛЕ замка: параллельный повтор дождётся первого и увидит его
  if p_request is not null then
    select * into v_pay from payments where request_id = p_request;
    if found then
      return query select v_pay.id, v_pay.plan, v_pay.starts_at, v_pay.ends_at, true;
      return;
    end if;
  end if;

  if p_claim is not null and not exists (
    select 1 from payment_claims where id = p_claim and user_id = p_user and resolved_at is null
  ) then
    raise exception 'Эта заявка уже закрыта — обнови список.';
  end if;

  -- правило продления — в шапке файла; greatest пропускает null
  v_start := greatest(
    now(),
    case when prof.plan <> 'free' then prof.plan_expires_at end,
    prof.trial_until
  );
  v_end := ((v_start at time zone 'Asia/Almaty') + make_interval(months => p_months)) at time zone 'Asia/Almaty';

  update profiles set plan = p_plan, plan_expires_at = v_end where id = p_user;

  insert into payments (user_id, plan, months, amount, method, note, starts_at, ends_at, confirmed_by, request_id)
  values (p_user, p_plan, p_months, p_amount, p_method, nullif(trim(coalesce(p_note, '')), ''),
          v_start, v_end, me, p_request)
  returning * into v_pay;

  -- заявка человека закрыта этой оплатой (и без p_claim: перевёл, а кнопку
  -- нажал позже — заявка всё равно про эти деньги)
  update payment_claims set resolved_at = now(), outcome = 'confirmed', payment_id = v_pay.id, updated_at = now()
   where user_id = p_user and resolved_at is null;

  perform public.after_payment_confirmed(v_pay.id);

  perform public.notify(p_user, 'plan_paid',
    jsonb_build_object('plan', p_plan, 'until', v_end, 'href', '/pricing'),
    'payment:' || v_pay.id);

  -- воронка /admin: оплата — событие ПЛАТЕЛЬЩИКА (раньше его писал клиент
  -- владельца от своего имени, и все оплаты считались оплатами владельца).
  -- Первое устройство человека — чтобы оплата легла к его первому источнику
  select anon_id into v_anon from events
   where user_id = p_user and anon_id is not null order by created_at limit 1;
  insert into events (anon_id, user_id, name, props)
  values (v_anon, p_user, 'payment_activated',
          jsonb_build_object('plan', p_plan, 'months', p_months, 'amount', p_amount, 'method', p_method));

  return query select v_pay.id, v_pay.plan, v_pay.starts_at, v_pay.ends_at, false;
end $fn$;

-- ---- владельцу: заявки, ждущие подтверждения -------------------------------------------
create or replace function public.admin_payment_claims()
returns table (
  id uuid, user_id uuid, claim_plan text, months int, created_at timestamptz, updated_at timestamptz,
  email text, display_name text, code text,
  -- что у человека сейчас — для подсказки «станет: … до …»
  role text, plan text, plan_expires_at timestamptz, trial_until timestamptz, students int
)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  return query
    select c.id, c.user_id, c.plan, c.months, c.created_at, c.updated_at,
           u.email::text, p.display_name, pc.code, p.role, p.plan, p.plan_expires_at, p.trial_until,
           (select count(*)::int from teacher_students ts where ts.teacher_id = c.user_id)
      from payment_claims c
      join auth.users u on u.id = c.user_id
      join profiles p on p.id = c.user_id
      left join personal_codes pc on pc.user_id = c.user_id
     where c.resolved_at is null
     order by c.created_at;
end $fn$;

-- ---- владельцу: деньги не пришли — убрать заявку -----------------------------------------
create or replace function public.admin_dismiss_payment_claim(p_claim uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  update payment_claims set resolved_at = now(), outcome = 'dismissed', updated_at = now()
   where id = p_claim and resolved_at is null;
  if not found then raise exception 'Эта заявка уже закрыта — обнови список.'; end if;
end $fn$;

-- ---- владельцу: последние оплаты -------------------------------------------------------
create or replace function public.admin_recent_payments(p_limit int default 20)
returns table (
  id uuid, user_id uuid, email text, display_name text, plan text, months int, amount int,
  method text, note text, starts_at timestamptz, ends_at timestamptz, confirmed_at timestamptz
)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  return query
    select pm.id, pm.user_id, u.email::text, p.display_name, pm.plan, pm.months, pm.amount, pm.method,
           pm.note, pm.starts_at, pm.ends_at, pm.confirmed_at
      from payments pm
      left join auth.users u on u.id = pm.user_id
      left join profiles p on p.id = pm.user_id
     order by pm.confirmed_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 100));
end $fn$;

-- ---- поиск пользователя: + по личному коду из сообщения к переводу -----------------------
create or replace function public.admin_find_user(q text)
returns json language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  return coalesce((
    select json_agg(row_to_json(t)) from (
      select u.id, u.email, p.display_name, p.plan,
             p.plan_expires_at, p.trial_until, p.role, pc.code,
             (select count(*) from teacher_students ts where ts.teacher_id = u.id) as students,
             public.teacher_seats_effective(u.id) as seats
        from auth.users u
        join public.profiles p on p.id = u.id
        left join public.personal_codes pc on pc.user_id = u.id
       where u.email ilike '%' || trim(coalesce(q, '')) || '%'
          or pc.code = upper(trim(coalesce(q, '')))
       order by u.created_at desc
       limit 10
    ) t
  ), '[]'::json);
end $fn$;

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
