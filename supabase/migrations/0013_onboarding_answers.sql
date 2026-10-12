-- ============================================================================
-- 0013 — ответы онбординга в /admin (PLAN.md Ф2.11б-4, журнал п.73).
--
-- Онбординг спрашивает «Откуда ты о нас знаешь?» (событие how_heard) и у
-- репетитора — «Сколько у тебя учеников?» (событие teacher_students, Ф2.11б-4).
-- До этой миграции ответы ложились в events и нигде не показывались:
-- «Источники» воронки берут ПЕРВЫЙ заход человека (метку ссылки или
-- реферер), а не его ответ.
--
-- admin_onboarding_answers(p_days) — сводка за N дней, только владельцу:
-- строка на (вопрос, ответ) — сколько ответили так репетиторов и остальных
-- (роль — нынешняя, из profiles). Вопрос: students — «Сколько учеников»,
-- heard — «Как узнал».
-- Считаются ЛЮДИ, а не события, как в admin_funnel: передумал и выбрал другое
-- — засчитан один раз, последним ответом. Ответ пишет клиент (track_event
-- открыт и анониму), значит значение — любая строка: в сводку идёт не длиннее
-- 40 знаков, React экранирует её при показе.
-- ============================================================================

create or replace function public.admin_onboarding_answers(p_days int default 30)
returns table (question text, value text, teachers int, others int)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare d timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'RECALL_NOT_ADMIN';
  end if;
  return query
    select l.question,
           l.value,
           (count(*) filter (where l.teacher))::int,
           (count(*) filter (where not l.teacher))::int
      from (
        -- последний ответ каждого человека на каждый вопрос
        select distinct on (e.name, coalesce(e.user_id, e.anon_id))
               case e.name when 'teacher_students' then 'students' else 'heard' end as question,
               left(coalesce(e.props->>'value', ''), 40)                          as value,
               coalesce(p.role = 'teacher', false)                                as teacher
          from events e
          left join profiles p on p.id = e.user_id
         where e.name in ('teacher_students', 'how_heard')
           and e.created_at >= d
           and coalesce(e.user_id, e.anon_id) is not null
         order by e.name, coalesce(e.user_id, e.anon_id), e.created_at desc, e.id desc
      ) l
     where l.value <> ''
     group by l.question, l.value
     order by l.question, count(*) desc, l.value;
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
