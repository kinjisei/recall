-- 0003 — журнал вызовов AI (PLAN.md Ф1.6; архитектура §7; журнал п.12)
-- ============================================================================
-- Какая модель ответила, сколько ждали, какие модели отказали по дороге. Без
-- этого не видно, что цепочка скатилась до запасной модели или что одна
-- модель стала отказывать чаще, — а при ~200 пользователях первыми кончатся
-- именно дневные квоты AI (журнал п.12).
--
-- Почему не столбцы в ai_calls. ai_calls — журнал СПИСАНИЙ: вызов без ответа
-- возвращает энергию, и refund_ai_call его строку удаляет. Отказы — ровно то,
-- что надо видеть, — из ai_calls пропадали бы. Решение владельца 28.09.2026:
-- отдельный журнал, смысл возврата не меняется.
--
--   ai_call_log       строка на вызов: задача, модель, итог, задержка и все
--                     попытки по цепочке моделей; 40 дней, как ai_calls
--   log_ai_call()     пишет СЕРВЕР (api/_usage.ts) по номеру списания — его знает
--                     только сервер. Тем же запросом возвращает энергию, если
--                     ответа не было: после работы у функции Vercel остаётся
--                     время ровно на один запрос в базу (api/_timeouts.ts)
--   admin_ai_usage()  владельцу: попытки по моделям и дням
--   admin_ai_tasks()  владельцу: вызовы по задачам и дням
--
-- Сутки в сводках — по Тихоокеанскому времени: в полночь по нему Google
-- обнуляет дневные квоты (ai.google.dev/gemini-api/docs/rate-limits).
-- ============================================================================

-- ---- журнал ---------------------------------------------------------------------
create table public.ai_call_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  called_at timestamptz not null default now(),
  -- номер списания (ai_calls.refund_token): строка на вызов, повтор — мимо
  call_token uuid not null unique,
  task text not null,
  tier text,
  -- кто ответил; null — не ответил никто
  model text,
  -- ok — ответ доставлен; failed — ответа нет; cut — поток оборвался на середине
  status text not null check (status in ('ok', 'failed', 'cut')),
  latency_ms int check (latency_ms >= 0),
  -- попытки по порядку: [{model, status, ms, first?}]; status попытки — 'ok',
  -- код отказа ('429', '503'…), 'timeout', 'network', 'empty' или 'cut';
  -- first — через сколько пришли первые слова (поток «Диалога»)
  attempts jsonb not null default '[]'::jsonb check (jsonb_typeof(attempts) = 'array')
);
create index ai_call_log_called_at on public.ai_call_log (called_at);

alter table public.ai_call_log enable row level security;
-- читать и писать напрямую не может никто: пишет log_ai_call, читают admin_*
revoke all on public.ai_call_log from anon, authenticated;
revoke all on sequence public.ai_call_log_id_seq from anon, authenticated;

-- ---- запись итога вызова ------------------------------------------------------------
create or replace function public.log_ai_call(
  p_nonce text,
  p_task text,
  p_tier text,
  p_model text,
  p_status text,
  p_latency_ms int,
  p_attempts jsonb,
  p_refund boolean default false
) returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  v_tok uuid;
  v_attempts jsonb;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  begin v_tok := nullif(p_nonce, '')::uuid; exception when others then return false; end;
  if v_tok is null then return false; end if;
  -- тот же замок, что у списания и возврата: запись с ними не разойдётся
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || uid::text));

  -- Писать может только тот, кто знает номер списания, а знает его только
  -- сервер (клиенту номер не уходит, см. refund_ai_call). Окно — как у
  -- возврата: дольше 10 минут живой вызов не идёт.
  if not exists (select 1 from ai_calls
                  where refund_token = v_tok and user_id = uid
                    and called_at > now() - interval '10 minutes') then
    return false;
  end if;

  -- Журнал — лучшее усилие: сбой записи не должен отнять у человека возврат.
  begin
    delete from ai_call_log where called_at < now() - interval '40 days';
    -- попытки собираем заново: только известные поля нужных типов, не больше
    -- 20 — сводка владельцу считает по ним и не должна падать на мусоре
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'model', left(a.e->>'model', 80),
             'status', left(a.e->>'status', 16),
             'ms', case when a.e->>'ms' ~ '^\d{1,7}$' then (a.e->>'ms')::int end,
             'first', case when a.e->>'first' ~ '^\d{1,7}$' then (a.e->>'first')::int end
           )) order by a.n), '[]'::jsonb)
      into v_attempts
      from jsonb_array_elements(case when jsonb_typeof(p_attempts) = 'array'
                                     then p_attempts else '[]'::jsonb end)
           with ordinality as a(e, n)
     where a.n <= 20 and jsonb_typeof(a.e) = 'object';

    insert into ai_call_log (user_id, call_token, task, tier, model, status, latency_ms, attempts)
    values (
      uid, v_tok,
      left(coalesce(nullif(p_task, ''), 'unknown'), 40),
      left(p_tier, 20),
      left(p_model, 80),
      case when p_status in ('ok', 'failed', 'cut') then p_status else 'failed' end,
      case when p_latency_ms is null then null else least(greatest(p_latency_ms, 0), 600000) end,
      v_attempts
    )
    on conflict (call_token) do nothing;
  exception when others then
    null;
  end;

  if p_refund then
    perform refund_ai_call(p_nonce);
  end if;
  return true;
end $fn$;

-- ---- сводки владельцу -------------------------------------------------------------
-- Попытки по моделям и дням: сколько раз модель спросили, сколько ответила,
-- сколько отказала по квоте (429) и по другим причинам, как быстро.
create or replace function public.admin_ai_usage(p_days int default 7)
returns table (
  day date, model text, requests int, ok int, refused int, failed int,
  avg_ms int, p95_ms int, avg_first_ms int
) language plpgsql security definer set search_path = public as $fn$
declare
  -- начало суток Google (полночь по Тихоокеанскому времени) p_days назад
  since timestamptz := ((now() at time zone 'America/Los_Angeles')::date
                        - (greatest(1, least(coalesce(p_days, 7), 40)) - 1))::timestamp
                       at time zone 'America/Los_Angeles';
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  return query
    select (l.called_at at time zone 'America/Los_Angeles')::date,
           a.e->>'model',
           count(*)::int,
           (count(*) filter (where a.e->>'status' = 'ok'))::int,
           (count(*) filter (where a.e->>'status' = '429'))::int,
           (count(*) filter (where a.e->>'status' not in ('ok', '429')))::int,
           (avg((a.e->>'ms')::int) filter (where a.e->>'status' = 'ok'))::int,
           (percentile_cont(0.95) within group (order by (a.e->>'ms')::int)
              filter (where a.e->>'status' = 'ok'))::int,
           (avg((a.e->>'first')::int) filter (where a.e ? 'first'))::int
      from ai_call_log l
      cross join lateral jsonb_array_elements(l.attempts) as a(e)
     where l.called_at >= since
     group by 1, 2
     order by 1 desc, 3 desc;
end $fn$;

-- Вызовы по задачам и дням: сколько доставлено, сколько без ответа (энергия
-- вернулась), сколько оборвалось, сколько ждал человек.
create or replace function public.admin_ai_tasks(p_days int default 7)
returns table (
  day date, task text, calls int, ok int, failed int, cut int, avg_ms int, p95_ms int
) language plpgsql security definer set search_path = public as $fn$
declare
  since timestamptz := ((now() at time zone 'America/Los_Angeles')::date
                        - (greatest(1, least(coalesce(p_days, 7), 40)) - 1))::timestamp
                       at time zone 'America/Los_Angeles';
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  return query
    select (l.called_at at time zone 'America/Los_Angeles')::date,
           l.task,
           count(*)::int,
           (count(*) filter (where l.status = 'ok'))::int,
           (count(*) filter (where l.status = 'failed'))::int,
           (count(*) filter (where l.status = 'cut'))::int,
           (avg(l.latency_ms) filter (where l.status = 'ok'))::int,
           (percentile_cont(0.95) within group (order by l.latency_ms)
              filter (where l.status = 'ok'))::int
      from ai_call_log l
     where l.called_at >= since
     group by 1, 2
     order by 1 desc, 3 desc;
end $fn$;

-- ---- уборка: первое поколение дневных лимитов ------------------------------------------
-- consume_ai_quota считала лимиты своими зашитыми цифрами. Сервер звал её,
-- только если в базе нет spend_energy, а при порядке «миграция, потом код»
-- (журнал п.47) такого не бывает. Живой путь — только spend_energy: у всех
-- строк ai_calls за 40 дней хранения есть номер списания, а consume_ai_quota
-- его не ставит (scripts/check-ai-quota-path.mjs --prod). Вторая копия
-- лимитов рано или поздно разошлась бы с первой молча.
drop function if exists public.consume_ai_quota(text);

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
