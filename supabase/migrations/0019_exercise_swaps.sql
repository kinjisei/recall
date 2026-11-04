-- ============================================================================
-- 0019 — замена упражнения через AI: 25 в сутки на учителя, из них сильных
-- до 5 (PLAN.md Ф2.25-4а, журнал п.76 (8), (22), (24)).
--
-- «↻ Заменить» и «+ Упражнение → Составит AI» генерацию материала не тратят,
-- но лимит у них есть — его держит база, а не экран. Сервер ходит в базу под
-- токеном учителя (корневой CLAUDE.md, правило 3), значит функцию зовут и из
-- браузера: она сама проверяет границы и права, а прямой вызов просто
-- тратит свою же замену.
--
--   spend_exercise_swap(p_nonce, p_strong)  одна замена: учитель с действующим
--       тарифом или пробным (teacher_can_write), тот же часовой потолок, что
--       у spend_energy; в сутки (календарный день по Алматы,
--       recall_day_start) — не больше 25, сильных (p_strong) — не больше 5.
--       Строка в ai_calls без энергии и генерации, помеченная swap
--       ('light' | 'strong'); возврат при сбое модели (refund_ai_call по
--       номеру) удаляет её — замена возвращается сама. Ответ — сколько
--       осталось: swaps_left, strong_left.
--   my_exercise_swaps()  то же «сколько осталось» без списания — счётчик на
--       экране до первой замены (кадры d17-1, d17-3в).
--
-- Какие виды сильные и какие модели у ступеней — api/_swap.ts (одно место);
-- ответ модели обязан быть одним упражнением — api/_exerciseShape.ts.
-- ============================================================================

alter table public.ai_calls add column if not exists swap text
  check (swap is null or swap in ('light', 'strong'));

create index if not exists ai_calls_swap_day on public.ai_calls (user_id, called_at) where swap is not null;

create or replace function public.spend_exercise_swap(p_nonce text, p_strong boolean)
returns table (swaps_left int, strong_left int)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_tok uuid;
  day0 timestamptz := public.recall_day_start();
  n int;
  n_all int;
  n_strong int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if p_strong is null then raise exception 'RECALL_BAD_SWAP'; end if;
  begin v_tok := nullif(p_nonce, '')::uuid; exception when others then v_tok := null; end;
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || uid::text));

  if exists (select 1 from auth.users where id = uid and banned_until is not null and banned_until > now())
    then raise exception 'RECALL_BLOCKED'; end if;
  if exists (select 1 from profiles where id = uid and blocked) then raise exception 'RECALL_BLOCKED'; end if;
  if not exists (select 1 from profiles where id = uid and role = 'teacher') then raise exception 'RECALL_NOT_TEACHER'; end if;
  if not public.teacher_can_write(uid) then raise exception 'RECALL_PLAN_REQUIRED'; end if;

  -- тот же часовой предохранитель от скриптов, что в spend_energy
  select count(*) into n from ai_calls where user_id = uid and called_at > now() - interval '1 hour';
  if n >= (case when public.has_paid_access(uid) then 200 when public.has_premium_access(uid) then 90 else 40 end)
    then raise exception 'RECALL_RATE_HOUR'; end if;

  select count(*), count(*) filter (where swap = 'strong') into n_all, n_strong
    from ai_calls where user_id = uid and swap is not null and called_at >= day0;
  if n_all >= 25 then raise exception 'RECALL_SWAP_LIMIT'; end if;
  if p_strong and n_strong >= 5 then raise exception 'RECALL_SWAP_STRONG_LIMIT'; end if;

  insert into ai_calls (user_id, kind, cost_energy, is_generation, refund_token, swap)
    values (uid, 'heavy', 0, false, v_tok, case when p_strong then 'strong' else 'light' end);

  -- сильных не больше, чем замен вообще: 24 замены сделаны — сильная осталась одна
  n_all := n_all + 1;
  if p_strong then n_strong := n_strong + 1; end if;
  return query select 25 - n_all, greatest(0, least(5 - n_strong, 25 - n_all));
end $fn$;

create or replace function public.my_exercise_swaps()
returns table (swaps_left int, strong_left int)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid(); n_all int; n_strong int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  select count(*), count(*) filter (where swap = 'strong') into n_all, n_strong
    from ai_calls where user_id = uid and swap is not null and called_at >= public.recall_day_start();
  return query select greatest(0, 25 - n_all), greatest(0, least(5 - n_strong, 25 - n_all));
end $fn$;

grant execute on function public.spend_exercise_swap(text, boolean) to authenticated;
grant execute on function public.my_exercise_swaps() to authenticated;

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
