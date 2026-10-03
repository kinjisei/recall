-- 0005 — пробный период репетитора и запись без тарифа (PLAN.md Ф2.2;
-- журнал п.14, 40, 41, 61; архитектура §9)
-- ============================================================================
-- Пробный период РЕПЕТИТОРА теперь считается от первого ученика в приложении:
--
--   конец = min(первый ученик + 14 дней, включение режима репетитора + 20 дней)
--
-- По реферальной ссылке (Ф2.3) — 21 и 27: к обоим числам прибавляется
-- trial_bonus_days. «Включение режима» — первое включение роли (дата уже
-- лежит в teacher_signups и не обнуляется при выключении и повторном
-- включении — решение владельца 03.10.2026, журнал п.61). Карточки учеников
-- без аккаунта (Ф2.5) отсчёт не запускают: считается только teacher_students,
-- то есть ученики с аккаунтом.
--
-- Пробный период УЧЕНИКА не меняется (журнал п.14): 14 дней с регистрации.
--
-- Где живёт правило: колонка profiles.trial_until по-прежнему «конец
-- пробного» — её читают места, пул энергии, генерации, премиум-доступ,
-- confirm_payment. Её пересчитывает база в трёх событиях: включение роли
-- (teacher_signups), первый ученик (teacher_students), смена бонуса
-- (trial_bonus_days). Клиент только показывает.
--
--   teacher_trial_end()        правило — чистая функция дат
--   recompute_teacher_trial()  пересчитать trial_until одному репетитору
--   teacher_can_write(uid)     можно ли менять расписание: оплачен тариф
--                              репетитора или идёт пробный (журнал п.41)
--   assert_teacher_can_write() отказ с понятным кодом — для RPC расписания (Ф2.6)
--   get_my_plan()              + trial_started, trial_days, can_write
-- ============================================================================

-- ---- данные ------------------------------------------------------------------
-- Когда к репетитору впервые привязался ученик с аккаунтом. Ставится один
-- раз и не сбрасывается: отвязал и привязал снова — пробный не начинается
-- заново.
alter table public.profiles add column first_student_at timestamptz;
-- Прибавка к пробному: рефералка (Ф2.3) — 7 дней. Меняется — пробный
-- пересчитывается сам (триггер ниже).
alter table public.profiles add column trial_bonus_days int not null default 0
  check (trial_bonus_days between 0 and 60);
-- ⚠️ Колоночные гранты profiles (корневой CLAUDE.md, «Безопасность», правило 2):
-- новые колонки в грант authenticated не входят — клиент их не видит и не
-- пишет. Наружу они выходят только через get_my_plan.

-- ---- правило -----------------------------------------------------------------
create or replace function public.teacher_trial_end(p_since timestamptz, p_first timestamptz, p_bonus int)
returns timestamptz language sql immutable set search_path = public as $fn$
  select case
    when p_first is null then p_since + make_interval(days => 20 + coalesce(p_bonus, 0))
    else least(p_first + make_interval(days => 14 + coalesce(p_bonus, 0)),
               p_since + make_interval(days => 20 + coalesce(p_bonus, 0)))
  end
$fn$;
revoke execute on function public.teacher_trial_end(timestamptz, timestamptz, int) from authenticated;

-- Пересчитать конец пробного одному репетитору. Ученику — ничего (его
-- пробный — 14 дней с регистрации, не меняется). Принимает чужой uid —
-- закрыта от authenticated.
create or replace function public.recompute_teacher_trial(p_uid uuid)
returns timestamptz language plpgsql security definer set search_path = public as $fn$
declare
  p record;
  v_since timestamptz;
  v_end timestamptz;
begin
  select role, created_at, first_student_at, trial_bonus_days into p from profiles where id = p_uid;
  if not found or p.role is distinct from 'teacher' then return null; end if;
  select created_at into v_since from teacher_signups where user_id = p_uid;
  -- роль, выданная до teacher_signups (SQL-ом владельца), — от регистрации
  v_end := public.teacher_trial_end(coalesce(v_since, p.created_at, now()), p.first_student_at, p.trial_bonus_days);
  update profiles set trial_until = v_end where id = p_uid;
  return v_end;
end $fn$;
revoke execute on function public.recompute_teacher_trial(uuid) from authenticated;

-- ---- три события -----------------------------------------------------------------
-- 1. Включение роли. become_teacher ставит role = 'teacher' ДО вставки в
--    teacher_signups, поэтому пересчёт видит уже репетитора. Повторное
--    включение строку не вставляет — пробный не обновляется.
create or replace function public.trg_teacher_signup_trial()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.recompute_teacher_trial(new.user_id);
  return new;
end $fn$;
revoke execute on function public.trg_teacher_signup_trial() from authenticated;
create trigger teacher_signups_trial after insert on public.teacher_signups
  for each row execute function public.trg_teacher_signup_trial();

-- 2. Первый ученик с аккаунтом. Привязку делает join_teacher (ученик вводит
--    код); триггер ловит и её, и любую другую вставку.
create or replace function public.trg_first_student_trial()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  update profiles set first_student_at = coalesce(new.created_at, now())
   where id = new.teacher_id and first_student_at is null;
  if found then perform public.recompute_teacher_trial(new.teacher_id); end if;
  return new;
end $fn$;
revoke execute on function public.trg_first_student_trial() from authenticated;
create trigger teacher_students_first_trial after insert on public.teacher_students
  for each row execute function public.trg_first_student_trial();

-- 3. Смена бонуса. Пересчёт пишет только trial_until — триггер «of
--    trial_bonus_days» от него не срабатывает.
create or replace function public.trg_trial_bonus()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.recompute_teacher_trial(new.id);
  return new;
end $fn$;
revoke execute on function public.trg_trial_bonus() from authenticated;
create trigger profiles_trial_bonus after update of trial_bonus_days on public.profiles
  for each row when (old.trial_bonus_days is distinct from new.trial_bonus_days)
  execute function public.trg_trial_bonus();

-- ---- уже существующие репетиторы ----------------------------------------------------
update public.profiles p
   set first_student_at = s.first
  from (select teacher_id, min(created_at) as first from public.teacher_students group by teacher_id) s
 where s.teacher_id = p.id and p.first_student_at is null;

-- Новое правило — всем репетиторам, но уже идущий пробный не укорачивается
-- (решение 03.10.2026): только продлевается, если по новому правилу дольше.
update public.profiles p
   set trial_until = greatest(p.trial_until, public.teacher_trial_end(
         coalesce((select ts.created_at from public.teacher_signups ts where ts.user_id = p.id), p.created_at, now()),
         p.first_student_at, p.trial_bonus_days))
 where p.role = 'teacher';

-- ---- можно ли менять расписание (журнал п.41) -------------------------------------
-- Оплачен тариф репетитора или идёт пробный. Premium не в счёт. Без этого —
-- расписание только для просмотра; проверка на сервере, не скрытием кнопок.
-- Принимает чужой uid (выдал бы, есть ли у человека тариф) — закрыта от
-- authenticated; свой ответ клиент получает из get_my_plan (can_write).
create or replace function public.teacher_can_write(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from profiles p
     where p.id = p_uid
       and p.role = 'teacher'
       and not coalesce(p.blocked, false)
       and ((p.plan like 'teacher_%' and p.plan_expires_at > now()) or p.trial_until > now())
  )
$fn$;
revoke execute on function public.teacher_can_write(uuid) from authenticated;

-- Первой строкой в каждой RPC, которая пишет в расписание (Ф2.6). Коды
-- переводит клиент (shared/api/errors.ts): RECALL_PLAN_REQUIRED — «продли
-- тариф», RECALL_NOT_TEACHER — «это в режиме преподавателя».
create or replace function public.assert_teacher_can_write()
returns void language plpgsql stable security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  p record;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  select role, coalesce(blocked, false) as blocked into p from profiles where id = uid;
  if p.blocked then raise exception 'RECALL_BLOCKED'; end if;
  if p.role is distinct from 'teacher' then raise exception 'RECALL_NOT_TEACHER'; end if;
  if not public.teacher_can_write(uid) then raise exception 'RECALL_PLAN_REQUIRED'; end if;
end $fn$;

-- ---- сводка тарифа клиенту: + пробный репетитора и «можно писать» ---------------------
-- Тело — прежнее (0000_baseline), добавлены последние три поля.
create or replace function public.get_my_plan()
  returns json language plpgsql security definer set search_path = public as $fn$
  declare
    uid uuid := auth.uid();
    p record; prem boolean; used int;
    day0 timestamptz := public.recall_day_start();
    src record; e_spent int; e_self int; g_used int;
    v_seats int; v_seats_used int;
  begin
    if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
    select plan, plan_expires_at, trial_until, is_admin, role, first_student_at, trial_bonus_days
      into p from profiles where id = uid;
    prem := public.has_premium_access(uid);
    select count(*) into used from ai_calls
      where user_id = uid and ai_calls.kind = 'heavy' and called_at > now() - interval '24 hours';
    select * into src from public.energy_source(uid);
    select coalesce(sum(cost_energy),0) into e_spent from ai_calls
      where pool_owner = src.pool_owner and called_at >= day0;
    select coalesce(sum(cost_energy),0) into e_self from ai_calls
      where user_id = uid and called_at >= day0;
    select count(*) into g_used from ai_calls
      where pool_owner = src.pool_owner and is_generation and called_at >= public.recall_month_start();
    -- seats: null = без ограничения (клиент так и покажет)
    v_seats := public.teacher_seats_effective(uid);
    select count(*) into v_seats_used from teacher_students where teacher_id = uid;
    return json_build_object(
      'plan', p.plan, 'plan_expires_at', p.plan_expires_at, 'trial_until', p.trial_until,
      'is_admin', p.is_admin, 'premium', prem,
      'ai_used_today', used, 'ai_day_limit', case when p.is_admin then 999999 when prem then 200 else 5 end,
      'energy_max', case when p.is_admin then 999999 else src.day_budget end,
      'energy_spent', e_spent, 'energy_self', e_self,
      'energy_subcap', case when src.in_studio and src.pool_owner <> uid then src.day_budget / 2 else null end,
      'in_studio', src.in_studio,
      'gen_limit', src.gen_limit, 'gen_used', g_used,
      -- места (A1): сколько всего и сколько занято; для не-преподавателя seats = 0
      'seats', v_seats, 'seats_used', v_seats_used,
      'free_seats', public.free_teacher_seats(),
      -- пробный репетитора (Ф2.2): пошёл ли отсчёт от первого ученика и
      -- сколько дней он длится (14 + бонус рефералки)
      'trial_started', p.first_student_at is not null,
      'trial_days', 14 + coalesce(p.trial_bonus_days, 0),
      -- можно ли менять расписание: тариф репетитора или пробный (журнал п.41)
      'can_write', public.teacher_can_write(uid)
    );
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
