-- ============================================================================
-- 0014 — бесплатный «Пересоставить план» материала (PLAN.md Ф2.17-4в-2б,
-- журнал п.76 (7)).
--
-- План материала стоит одну генерацию (spend_energy, p_generation). Макет d8-3
-- обещает «Пересоставить план — бесплатно»: к каждому оплаченному плану — 3
-- бесплатных повтора. Сервер ходит в базу под токеном человека (корневой
-- CLAUDE.md, правило 3), значит обе функции зовут и из браузера — и подделать
-- «право на повторы» нельзя:
--
--   grant_material_replans(p_nonce)  право на 3 повтора за ОПЛАЧЕННЫЙ вызов:
--                                    находит в ai_calls свою строку-генерацию
--                                    по номеру списания (refund_token) не старше
--                                    10 минут. Номер рождается на сервере и
--                                    клиенту не уходит (api/_auth.ts), поэтому
--                                    право без оплаты не завести. Повторный
--                                    вызов с тем же номером — то же право.
--   spend_replan(p_replan, p_nonce)  один бесплатный повтор: своё право не
--                                    старше 2 дней, повторов по нему меньше 3 —
--                                    строка в ai_calls без генерации и энергии
--                                    (часовой предохранитель её считает),
--                                    помеченная replan_of. Возврат при сбое AI
--                                    (refund_ai_call по номеру) удаляет строку —
--                                    повтор возвращается сам. Ответ — сколько
--                                    повторов осталось. Нет права —
--                                    RECALL_REPLAN_NONE, кончились —
--                                    RECALL_REPLAN_LIMIT.
--
-- Текст запроса собирает клиент, поэтому повтором можно попросить и не план;
-- сервер проверяет, что ответ — план по форме (api/_planShape.ts), и
-- неплан повтор не возвращает.
-- ============================================================================

alter table public.ai_calls add column if not exists replan_of uuid;

create table if not exists public.material_replans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  call_token uuid not null unique,
  created_at timestamptz not null default now()
);
alter table public.material_replans enable row level security;
revoke all on public.material_replans from anon, authenticated;

create index if not exists ai_calls_replan_of on public.ai_calls (replan_of) where replan_of is not null;

create or replace function public.grant_material_replans(p_nonce text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); v_tok uuid; v_id uuid;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  begin v_tok := nullif(p_nonce, '')::uuid; exception when others then return null; end;
  if v_tok is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || uid::text));
  delete from material_replans where created_at < now() - interval '2 days';
  if not exists (
    select 1 from ai_calls
     where refund_token = v_tok and user_id = uid and is_generation
       and called_at > now() - interval '10 minutes'
  ) then return null; end if;
  insert into material_replans (user_id, call_token) values (uid, v_tok)
    on conflict (call_token) do nothing;
  select id into v_id from material_replans where call_token = v_tok and user_id = uid;
  return v_id;
end $fn$;

create or replace function public.spend_replan(p_replan uuid, p_nonce text default null)
returns int language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); v_tok uuid; n int; used int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  begin v_tok := nullif(p_nonce, '')::uuid; exception when others then v_tok := null; end;
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || uid::text));

  if exists (select 1 from auth.users where id=uid and banned_until is not null and banned_until>now())
    then raise exception 'RECALL_BLOCKED'; end if;
  if exists (select 1 from profiles where id=uid and blocked) then raise exception 'RECALL_BLOCKED'; end if;

  -- тот же часовой предохранитель от скриптов, что в spend_energy
  select count(*) into n from ai_calls where user_id=uid and called_at > now() - interval '1 hour';
  if n >= (case when public.has_paid_access(uid) then 200 when public.has_premium_access(uid) then 90 else 40 end)
    then raise exception 'RECALL_RATE_HOUR'; end if;

  if p_replan is null or not exists (
    select 1 from material_replans
     where id = p_replan and user_id = uid and created_at > now() - interval '2 days'
  ) then raise exception 'RECALL_REPLAN_NONE'; end if;

  select count(*) into used from ai_calls where replan_of = p_replan;
  if used >= 3 then raise exception 'RECALL_REPLAN_LIMIT'; end if;

  insert into ai_calls (user_id, kind, cost_energy, is_generation, refund_token, replan_of)
    values (uid, 'heavy', 0, false, v_tok, p_replan);
  return 3 - used - 1;
end $fn$;

grant execute on function public.grant_material_replans(text) to authenticated;
grant execute on function public.spend_replan(uuid, text) to authenticated;

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
