-- 0012 — цена списания энергии в границах (PLAN.md Ф2.23; находка 3-01 Ф2.21)
-- ============================================================================
-- spend_energy открыта каждому вошедшему: сервер ходит в базу под токеном
-- человека, значит её зовут и из браузера (корневой CLAUDE.md, правило 3).
-- Цену p_cost функция брала от того, кто зовёт, и не проверяла: вызов с
-- ценой −1000 писал «отрицательное списание», дневной запас уходил в плюс,
-- и AI работал почти без лимита (держал только часовой счётчик). Один
-- человек так сжигал общие бесплатные квоты Gemini у всех учеников, ученик
-- студии «пополнял» пул учителя.
--
--   spend_energy                 первая проверка после входа: p_cost — целое
--                                от 0 до самой дорогой задачи сервера
--                                (api/_tasks.ts: письмо и разбор — 2 ⚡),
--                                иначе RECALL_BAD_COST. Остальное — как в
--                                0000_baseline. Подняли цену задачи — новая
--                                миграция: расхождение ловит
--                                check-energy-cost.mjs
--   ai_calls_cost_energy_nonneg  строка с минусом не вставится и в обход
--                                функции. Если такие строки уже есть,
--                                миграция останавливается целиком — сначала
--                                решение владельца по ним (Ф2.23, шаг 3)
-- ============================================================================

-- ---- строки с минусом: сначала решение, потом ограничение -------------------------
do $$ begin
  if exists (select 1 from public.ai_calls where cost_energy < 0) then
    raise exception '0012: в ai_calls есть строки с отрицательной ценой — сначала решение владельца по ним (PLAN.md Ф2.23, шаг 3)';
  end if;
end $$;

alter table public.ai_calls
  add constraint ai_calls_cost_energy_nonneg check (cost_energy >= 0);

-- ---- spend_energy: граница цены ---------------------------------------------------
create or replace function public.spend_energy(
  p_kind text default 'heavy', p_cost int default 1, p_generation boolean default false,
  p_nonce text default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_kind text := case when p_kind in ('light','speech') then p_kind else 'heavy' end;
  -- пустую строку (старый клиент/сервер) трактуем как «токена нет»
  v_tok uuid;
  uid uuid := auth.uid();
  day0 timestamptz := public.recall_day_start();
  src record;
  n int; pool_spent int; self_spent int; gen_used int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  -- Цену шлёт тот, кто зовёт, — и из браузера тоже. Минус «пополнял» запас,
  -- лишнее сверх самой дорогой задачи сервер не шлёт никогда.
  if p_cost is null or p_cost < 0 or p_cost > 2 then raise exception 'RECALL_BAD_COST'; end if;
  begin v_tok := nullif(p_nonce, '')::uuid; exception when others then v_tok := null; end;
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || uid::text));

  if exists (select 1 from auth.users where id=uid and banned_until is not null and banned_until>now())
    then raise exception 'RECALL_BLOCKED'; end if;
  if exists (select 1 from profiles where id=uid and blocked) then raise exception 'RECALL_BLOCKED'; end if;
  delete from ai_calls where called_at < now() - interval '40 days';  -- держим месяц генераций

  -- админ (владелец) — без лимитов, но пишем строку для статистики
  if exists (select 1 from profiles where id=uid and is_admin) then
    insert into ai_calls (user_id, kind, cost_energy, is_generation, refund_token)
      values (uid, v_kind, 0, p_generation, v_tok);
    return;
  end if;

  -- часовой предохранитель от скриптов (по классу доступа)
  select count(*) into n from ai_calls where user_id=uid and called_at > now() - interval '1 hour';
  if n >= (case when public.has_paid_access(uid) then 200 when public.has_premium_access(uid) then 90 else 40 end)
    then raise exception 'RECALL_RATE_HOUR'; end if;

  -- ГЕНЕРАЦИЯ: месячный лимит по пулу учителя
  if p_generation then
    select * into src from public.energy_source(uid);
    select count(*) into gen_used from ai_calls
      where pool_owner = src.pool_owner and is_generation and called_at >= public.recall_month_start();
    if gen_used >= src.gen_limit then raise exception 'RECALL_GEN_LIMIT'; end if;
    insert into ai_calls (user_id, kind, cost_energy, pool_owner, is_generation, refund_token)
      values (uid, 'heavy', 0, src.pool_owner, true, v_tok);
    return;
  end if;

  -- LIGHT/SPEECH (0 энергии): только суточный анти-абьюз-кэп по классу
  if v_kind in ('light','speech') then
    select count(*) into n from ai_calls
      where user_id=uid and ai_calls.kind=v_kind and called_at >= day0;
    if n >= (case v_kind
        when 'light' then case when public.has_paid_access(uid) then 900 when public.has_premium_access(uid) then 150 else 100 end
        else case when public.has_paid_access(uid) then 400 when public.has_premium_access(uid) then 150 else 50 end end) then
      if v_kind='light' then raise exception 'RECALL_LIGHT_LIMIT'; else raise exception 'RECALL_SPEECH_LIMIT'; end if;
    end if;
    insert into ai_calls (user_id, kind, cost_energy, refund_token)
      values (uid, v_kind, 0, v_tok);
    return;
  end if;

  -- ЭНЕРГИЯ (heavy): дневной пул + под-кап на аккаунт в студии
  select * into src from public.energy_source(uid);
  select coalesce(sum(cost_energy),0) into pool_spent from ai_calls
    where pool_owner = src.pool_owner and called_at >= day0;
  if pool_spent + p_cost > src.day_budget then
    if src.in_studio then raise exception 'RECALL_ENERGY_POOL';
    elsif public.has_premium_access(uid) then raise exception 'RECALL_ENERGY_DAY';
    else raise exception 'RECALL_FREE_LIMIT'; end if;
  end if;
  if src.in_studio and src.pool_owner <> uid then
    select coalesce(sum(cost_energy),0) into self_spent from ai_calls
      where user_id = uid and called_at >= day0;
    if self_spent + p_cost > (src.day_budget / 2) then raise exception 'RECALL_ENERGY_SUBCAP'; end if;
  end if;
  insert into ai_calls (user_id, kind, cost_energy, pool_owner, refund_token)
    values (uid, 'heavy', p_cost, src.pool_owner, v_tok);
end $fn$;

-- create or replace сохраняет права, но вернём явно: сервер зовёт функцию
-- под токеном пользователя
grant execute on function public.spend_energy(text, int, boolean, text) to authenticated;

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
