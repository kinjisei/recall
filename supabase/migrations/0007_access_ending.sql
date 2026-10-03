-- 0007 — напоминание о конце тарифа и пробного (PLAN.md Ф2.4; журнал п.36;
-- архитектура §17)
-- ============================================================================
-- Доступ кончался молча и выглядел как поломка. Теперь за день до конца —
-- ОДНО уведомление в ленту («Тариф закончится завтра» / «Пробный период
-- закончится завтра»), а после конца клиент показывает плашку «Тариф
-- закончился — продлить» (features/billing). Тариф и пробный — одно правило:
--
--   репетитор   — доступ до конца тарифа репетитора или пробного, что позже
--                 (то же, что пускает менять расписание, журнал п.41);
--   самоучка    — до конца своего оплаченного тарифа (Premium). Пробный
--                 ученика не в счёт; ученику, которого сейчас покрывает
--                 тариф репетитора, — ничего: свой Premium ему не нужен, его
--                 держит студия (решение владельца 03.10.2026).
--
-- «Одно на цикл» держит база: ключ — дата окончания по Алматы
-- (access_end:2026-10-16). Повторный прогон и сдвиг конца в пределах того же
-- дня ничего не создают; продлили — новая дата, новый цикл.
-- Будим не ночью: правило срабатывает с 10:00 по Алматы накануне.
--
--   access_end()              до какого момента доступ и чем он держится
--   teacher_can_write()       то же правило вместо своей копии условия
--   notify_access_ending(t)   найти, у кого конец завтра, и написать ему
--   rule_access_ending()      правило будильника: notify_access_ending(now())
-- ============================================================================

-- ---- правило: до какого момента доступ ------------------------------------------
-- source: 'plan' — оплаченный тариф, 'trial' — пробный репетитора; null —
-- доступа нет и не было. Копия для показа — accessEnd (domains/billing/model.ts),
-- пару сверяет check-access-ending.mjs.
create or replace function public.access_end(p_role text, p_plan text, p_expires timestamptz, p_trial timestamptz)
returns table (ends_at timestamptz, source text) language sql immutable set search_path = public as $fn$
  select s.e, case when s.e is null then null when s.e = s.paid then 'plan' else 'trial' end
    from (
      select x.paid, case when p_role = 'teacher' then greatest(x.paid, p_trial) else x.paid end as e
        from (
          select case
            -- репетитору считается только тариф репетитора: Premium его
            -- расписание не открывает (журнал п.41)
            when p_role = 'teacher' then case when p_plan like 'teacher_%' then p_expires end
            when coalesce(p_plan, 'free') <> 'free' then p_expires
          end as paid
        ) x
    ) s
$fn$;
revoke execute on function public.access_end(text, text, timestamptz, timestamptz) from authenticated;

-- ---- можно ли менять расписание — по тому же правилу ------------------------------
-- Было (0005): тариф репетитора действует ИЛИ идёт пробный. greatest двух
-- концов позже «сейчас» ровно тогда же — правило то же, но живёт в одном месте
-- с напоминанием: плашка «закончился» и запрет записи наступают в один момент.
create or replace function public.teacher_can_write(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from profiles p
     cross join lateral public.access_end(p.role, p.plan, p.plan_expires_at, p.trial_until) a
     where p.id = p_uid
       and p.role = 'teacher'
       and not coalesce(p.blocked, false)
       and a.ends_at > now()
  )
$fn$;
revoke execute on function public.teacher_can_write(uuid) from authenticated;

-- ---- напоминание: конец завтра -------------------------------------------------------
-- p_now — параметром, чтобы проверка могла прогнать «вечер накануне» без
-- ожидания (check-access-ending.mjs); будильник зовёт с now(). Пишет данные,
-- а не текст: текст — renderNotification (domains/notifications).
create or replace function public.notify_access_ending(p_now timestamptz)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  v_tomorrow date := (p_now at time zone 'Asia/Almaty')::date + 1;
  r record;
  n int := 0;
begin
  -- ночью не будим: накануне конца — с 10:00 по Алматы
  if (p_now at time zone 'Asia/Almaty')::time < time '10:00' then return 0; end if;
  for r in
    select p.id, p.plan, a.ends_at, a.source
      from profiles p
     cross join lateral public.access_end(p.role, p.plan, p.plan_expires_at, p.trial_until) a
     where (p.role = 'teacher' or coalesce(p.plan, 'free') <> 'free')
       and not coalesce(p.blocked, false)
       and a.ends_at > p_now
       and (a.ends_at at time zone 'Asia/Almaty')::date = v_tomorrow
       -- ученика, которого покрывает тариф репетитора, не зовём продлевать свой
       and (p.role = 'teacher' or public.covering_teacher(p.id) is null)
  loop
    if public.notify(
      r.id,
      case r.source when 'plan' then 'plan_ending' else 'trial_ending' end,
      case r.source
        when 'plan' then jsonb_build_object('plan', r.plan, 'until', r.ends_at, 'href', '/pay')
        else jsonb_build_object('until', r.ends_at, 'href', '/pay')
      end,
      -- одно на дату окончания: продлили — новая дата, новый цикл
      'access_end:' || to_char(r.ends_at at time zone 'Asia/Almaty', 'YYYY-MM-DD')
    ) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $fn$;
revoke execute on function public.notify_access_ending(timestamptz) from authenticated;

create or replace function public.rule_access_ending()
returns int language sql security definer set search_path = public as $fn$
  select public.notify_access_ending(now())
$fn$;
revoke execute on function public.rule_access_ending() from authenticated;

insert into public.notification_rules (name, fn, about)
values ('access_ending', 'public.rule_access_ending',
        'Тариф или пробный кончается завтра — одно уведомление на дату окончания (PLAN.md Ф2.4, журнал п.36)')
on conflict (name) do update set fn = excluded.fn, about = excluded.about;

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
