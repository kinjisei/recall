-- 0006 — рефералка «репетитор приводит репетитора» (PLAN.md Ф2.3; журнал
-- п.16, 35, 62; архитектура §9)
-- ============================================================================
-- Репетитор делится ссылкой /login?role=teacher&ref=<личный код>. Коллега,
-- который ВПЕРВЫЕ включил по ней режим репетитора, получает +7 дней пробного
-- (trial_bonus_days из 0005 — пробный пересчитывается сам: 21 день с первого
-- ученика, потолок 27). Когда владелец подтверждает первую оплату коллеги за
-- тариф репетитора, пригласившему — подарок к тарифу. Потолка по числу коллег
-- нет.
--
-- Решения владельца 03.10.2026 (журнал п.62):
--   • код в ссылке — тот же личный код, что на «Как оплатить» (MADINA7);
--   • подарок — месяц своего тарифа, но не дороже месяца, который оплатил
--     коллега: выбрал коллега тариф дешевле — дни на ту же сумму (Start за
--     Mini — 18 дней). Иначе второй аккаунт на Mini (3 900 ₸) приносил бы
--     владельцу Pro месяц Pro (14 990 ₸);
--   • у пригласившего нет тарифа репетитора — подарок ждёт (status 'paid') и
--     добавляется к его первой оплате тарифа репетитора.
--
--   referrals                   кто кого привёл и чем кончилось
--   plan_price()                цена тарифа в месяц — копия каталога клиента
--   referral_reward()           правило подарка — чистая функция
--   attach_referral()           записать приглашение (зовёт become_teacher)
--   become_teacher(p_ref)       + код из ссылки
--   apply_referral_rewards()    начислить пригласившему ждущие подарки
--   after_payment_confirmed()   крючок confirm_payment (0004): первая оплата
--                               приглашённого и ждущие подарки плательщика
--   confirm_payment()           «Оплата получена — до …» с учётом подарка
--   get_my_referral()           экрану «Пригласи коллегу»: код и счётчик
--   referral_hint(), dismiss_referral_hint()   разовая подсветка подарка
-- ============================================================================

-- ---- приглашения ----------------------------------------------------------------
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  -- пригласивший удалил аккаунт — его приглашения больше никому не нужны
  referrer_id uuid not null references auth.users (id) on delete cascade,
  -- по приглашению приходят один раз. Приглашённый удалил аккаунт — строка
  -- остаётся: подарок уже получен, и счётчик пригласившего не должен таять
  referee_id uuid unique references auth.users (id) on delete set null,
  code text not null,
  -- registered — пришёл по ссылке; paid — оплатил первый месяц, подарок ждёт
  -- тарифа пригласившего; rewarded — подарок начислен
  status text not null default 'registered' check (status in ('registered', 'paid', 'rewarded')),
  created_at timestamptz not null default now(),
  -- первая оплата приглашённого за тариф репетитора
  paid_at timestamptz,
  payment_id uuid references public.payments (id) on delete set null,
  referee_plan text check (referee_plan in ('teacher_mini', 'teacher_start', 'teacher_pro')),
  -- что получил пригласивший: месяц (1, 0) или дни (0, N)
  rewarded_at timestamptz,
  reward_plan text check (reward_plan in ('teacher_mini', 'teacher_start', 'teacher_pro')),
  reward_months int not null default 0 check (reward_months between 0 and 1),
  reward_days int not null default 0 check (reward_days between 0 and 30),
  constraint referrals_not_self check (referrer_id <> referee_id),
  constraint referrals_paid check ((status = 'registered') = (paid_at is null) and (paid_at is null) = (referee_plan is null)),
  constraint referrals_rewarded check ((status = 'rewarded') = (rewarded_at is not null) and (rewarded_at is null) = (reward_plan is null))
);
create index referrals_referrer on public.referrals (referrer_id);

alter table public.referrals enable row level security;
-- читать и писать напрямую не может никто: пишут become_teacher и
-- confirm_payment, свой счётчик человек получает из get_my_referral
revoke all on public.referrals from anon, authenticated;

-- Разовая подсветка подарка после первой оплаты тарифа (журнал п.16): когда
-- человек её закрыл. В базе, а не на устройстве: на втором телефоне она не
-- всплывает снова. ⚠️ Колоночные гранты profiles: колонка клиенту не видна —
-- только через referral_hint().
alter table public.profiles add column referral_hint_seen_at timestamptz;

-- ---- правило подарка ----------------------------------------------------------------
-- Цена тарифа в тенге за месяц. КОПИЯ каталога src/domains/billing/model.ts
-- (PLANS): меняешь цену там — меняй здесь новой миграцией. Совпадение держит
-- scripts/test-referral.mjs (в CI, читает эту функцию из миграций).
create or replace function public.plan_price(p_plan text)
returns int language sql immutable set search_path = public as $fn$
  select case p_plan
    when 'premium' then 1990
    when 'teacher_mini' then 3900
    when 'teacher_start' then 6500
    when 'teacher_pro' then 14990
  end
$fn$;
revoke execute on function public.plan_price(text) from authenticated;

-- Подарок пригласившему за одного коллегу: месяц его тарифа, если коллега
-- оплатил тариф не дешевле; иначе дни на сумму месяца коллеги, вниз до
-- целого (не дороже его оплаты): Start за Mini — 18, Pro за Mini — 7, Pro за
-- Start — 13. Копия для показа — referralReward в domains/billing/referral.ts,
-- пару сверяет check-referral.mjs.
create or replace function public.referral_reward(p_referee_plan text, p_referrer_plan text)
returns table (months int, days int) language sql immutable set search_path = public as $fn$
  select case when paid >= mine then 1 else 0 end,
         case when paid >= mine then 0 else floor(30.0 * paid / mine)::int end
    from (select public.plan_price(p_referee_plan) as paid, public.plan_price(p_referrer_plan) as mine) t
$fn$;
revoke execute on function public.referral_reward(text, text) from authenticated;

-- ---- приглашение по ссылке -------------------------------------------------------------
-- Записать, что p_uid пришёл по коду p_code, и дать ему +7 дней пробного.
-- Тихо ничего не делает, если код кривой или чужой не-репетитор, свой, или
-- человек уже приходил по приглашению. true — записано. Принимает чужой uid —
-- закрыта от authenticated; зовёт её только become_teacher.
create or replace function public.attach_referral(p_uid uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_referrer uuid;
begin
  -- формат личного кода (0004, personal_codes): буквы и цифры 2–9
  if v_code !~ '^[A-Z]{2,8}[2-9]{1,4}$' then return false; end if;
  select pc.user_id into v_referrer
    from personal_codes pc
    join profiles p on p.id = pc.user_id
   where pc.code = v_code and p.role = 'teacher' and not coalesce(p.blocked, false);
  if v_referrer is null or v_referrer = p_uid then return false; end if;

  insert into referrals (referrer_id, referee_id, code) values (v_referrer, p_uid, v_code)
  on conflict (referee_id) do nothing;
  if not found then return false; end if;

  -- +7 к обоим числам пробного; триггер 0005 пересчитает trial_until сам
  update profiles set trial_bonus_days = greatest(trial_bonus_days, 7) where id = p_uid;
  return true;
end $fn$;
revoke execute on function public.attach_referral(uuid, text) from authenticated;

-- Включение режима репетитора: тело прежнее (0000_baseline), добавлен код из
-- ссылки. Приглашение засчитывается только при ПЕРВОМ включении — пробный
-- считается от него (журнал п.61), и «выключил и включил по ссылке» бонуса не
-- даёт. Уже репетитор — ссылка ничего не меняет. Старый клиент зовёт без
-- аргумента — работает, как раньше.
drop function public.become_teacher();
create function public.become_teacher(p_ref text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  cur text;
  is_blocked boolean;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  select role, coalesce(blocked, false) into cur, is_blocked from profiles where id = uid;
  if is_blocked then raise exception 'RECALL_BLOCKED'; end if;
  if cur = 'teacher' then return; end if;

  update profiles set role = 'teacher' where id = uid;
  insert into teacher_signups (user_id) values (uid)
    on conflict (user_id) do nothing;
  if found and p_ref is not null then
    perform public.attach_referral(uid, p_ref);
  end if;
end $fn$;
grant execute on function public.become_teacher(text) to authenticated;

-- ---- начисление ------------------------------------------------------------------------
-- Начислить пригласившему все ждущие подарки (status 'paid'), если у него
-- есть тариф репетитора — действующий или истёкший: подарок продлевает его по
-- правилу confirm_payment (от самой поздней из дат «сейчас», «конец тарифа»,
-- «конец пробного»; месяцы — по Алматы). Тарифа нет или аккаунт заблокирован
-- — подарки ждут. Возвращает, сколько начислено. Принимает чужой uid —
-- закрыта от authenticated.
create or replace function public.apply_referral_rewards(p_referrer uuid)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  prof record;
  r record;
  w record;
  v_start timestamptz;
  v_end timestamptz;
  n int := 0;
begin
  -- строка пригласившего под замком: подарок и его собственная оплата
  -- продлевают по очереди, второй видит срок, уже продлённый первым
  select plan, plan_expires_at, trial_until, coalesce(blocked, false) as blocked
    into prof from profiles where id = p_referrer for update;
  if not found or prof.blocked or prof.plan not like 'teacher_%' then return 0; end if;

  for r in
    select id, referee_plan from referrals
     where referrer_id = p_referrer and status = 'paid'
     order by paid_at, id
  loop
    select * into w from public.referral_reward(r.referee_plan, prof.plan);
    v_start := greatest(now(), prof.plan_expires_at, prof.trial_until);
    v_end := ((v_start at time zone 'Asia/Almaty') + make_interval(months => w.months, days => w.days)) at time zone 'Asia/Almaty';
    update profiles set plan_expires_at = v_end where id = p_referrer;
    prof.plan_expires_at := v_end;

    update referrals
       set status = 'rewarded', rewarded_at = now(), reward_plan = prof.plan,
           reward_months = w.months, reward_days = w.days
     where id = r.id;
    perform public.notify(p_referrer, 'referral_rewarded',
      jsonb_build_object('months', w.months, 'days', w.days, 'plan', prof.plan, 'until', v_end, 'href', '/invite'),
      'referral_reward:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke execute on function public.apply_referral_rewards(uuid) from authenticated;

-- Крючок confirm_payment (0004) — в той же транзакции, после продления
-- тарифа плательщика. Рефералка — про тарифы репетитора: Premium не в счёт.
--   1. Платит приглашённый, и это его ПЕРВАЯ оплата тарифа репетитора →
--      подарок пригласившему; тарифа у того нет — подарок ждёт, а
--      пригласившему — «по твоей ссылке оплатили».
--   2. Платит пригласивший → ждавшие его подарки добавляются к этой оплате.
-- Повтор нажатия «Подтвердить» сюда не доходит (confirm_payment отдаёт
-- прежнюю оплату раньше), а строка приглашения переходит из registered один
-- раз — второй месяц за одного коллегу не начислится.
create or replace function public.after_payment_confirmed(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_pay payments;
  v_ref referrals;
begin
  select * into v_pay from payments where id = p_payment;
  if not found or v_pay.user_id is null or v_pay.plan not like 'teacher_%' then return; end if;

  update referrals
     set status = 'paid', paid_at = now(), payment_id = v_pay.id, referee_plan = v_pay.plan
   where referee_id = v_pay.user_id and status = 'registered'
  returning * into v_ref;
  if found and public.apply_referral_rewards(v_ref.referrer_id) = 0 then
    perform public.notify(v_ref.referrer_id, 'referral_paid',
      jsonb_build_object('href', '/pay'), 'referral_paid:' || v_ref.id);
  end if;

  perform public.apply_referral_rewards(v_pay.user_id);
end $fn$;
revoke execute on function public.after_payment_confirmed(uuid) from authenticated;

-- ---- подтвердить оплату: тело прежнее (0004), одно изменение -------------------------
-- «Оплата получена — тариф до …» называет ИТОГОВУЮ дату: крючок рефералки
-- мог добавить к сроку этой оплаты ждавшие подарки (пункт 2 выше). Ответ
-- функции — по-прежнему срок, купленный этой оплатой.
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
  v_until timestamptz;
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

  -- правило продления — в шапке 0004; greatest пропускает null
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

  -- срок после подарков за коллег — его и называем человеку
  select plan_expires_at into v_until from profiles where id = p_user;
  perform public.notify(p_user, 'plan_paid',
    jsonb_build_object('plan', p_plan, 'until', v_until, 'href', '/pricing'),
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

-- ---- экрану «Пригласи коллегу» -----------------------------------------------------------
-- Свой код (создаётся при первом заходе, как на «Как оплатить») и честный
-- счётчик: приглашено · оплатили · получено (месяцы и дни отдельно: месяц —
-- календарный) · ждут тарифа пригласившего. Только репетитору.
create or replace function public.get_my_referral()
returns table (code text, invited int, paid int, pending int, reward_months int, reward_days int)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_role text;
  v_code text;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  select role into v_role from profiles where id = uid;
  if v_role is distinct from 'teacher' then raise exception 'RECALL_NOT_TEACHER'; end if;
  v_code := public.ensure_personal_code(uid);
  return query
    select v_code,
           count(*)::int,
           (count(*) filter (where r.status <> 'registered'))::int,
           (count(*) filter (where r.status = 'paid'))::int,
           coalesce(sum(r.reward_months), 0)::int,
           coalesce(sum(r.reward_days), 0)::int
      from referrals r
     where r.referrer_id = uid;
end $fn$;

-- ---- разовая подсветка подарка ---------------------------------------------------------
-- Показать один раз: репетитор, у которого есть оплата тарифа репетитора и
-- который подсветку ещё не закрыл.
create or replace function public.referral_hint()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from profiles p
     where p.id = auth.uid()
       and p.role = 'teacher'
       and p.referral_hint_seen_at is null
       and exists (select 1 from payments pm where pm.user_id = p.id and pm.plan like 'teacher_%')
  )
$fn$;

create or replace function public.dismiss_referral_hint()
returns void language sql security definer set search_path = public as $fn$
  update profiles set referral_hint_seen_at = now()
   where id = auth.uid() and referral_hint_seen_at is null
$fn$;

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
