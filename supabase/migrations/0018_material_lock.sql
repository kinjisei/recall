-- ============================================================================
-- 0018 — правка сохранённого материала: замок сданного, версия упражнений,
-- копия (PLAN.md Ф2.25-3б, журнал п.76 (8), (21); макет d17-4).
--
-- Замок. Материал, по которому есть сданная или проверенная работа ИЛИ
-- прошлая попытка в истории (`attempts` — после «Переназначить»), не меняет
-- ни упражнения, ни текст: правка изменила бы проверку того, что ученик уже
-- сдал (`submit_material` сверяет ответы по номеру упражнения с тем, что в
-- материале сейчас). Держит триггер `materials_guard` — на любом пути записи;
-- отказ — RECALL_MATERIAL_LOCKED. Учителю — «Сделать копию и править».
-- Правило «можно ли править» на клиенте — `domains/materials` `editLock`,
-- случаи общие — `scripts/check-material-lock.mjs`.
--
-- Версия. `exercises_version` растёт на 1 при каждой правке упражнений или
-- текста (ставит только триггер: вставка — 1, клиентское значение
-- игнорируется). Ученик сдаёт с версией, которую видел: не совпала —
-- RECALL_MATERIAL_CHANGED («Учитель обновил задание»), а не ответы на чужие
-- вопросы. Версия необязательна: приложение до пуша сдаёт без неё, как
-- раньше. Строку материала на время сдачи держит `for share`: правка ждёт
-- конца сдачи и упирается в замок, сдача ждёт конца правки и видит новую
-- версию — проскочить между проверкой и записью нельзя.
--
-- Запись. Прямой UPDATE `materials` у клиента отозван (его и не было —
-- клиент писал только insert и delete): правка — `save_material_exercises`
-- (свой материал, версия совпала — иначе RECALL_MATERIAL_STALE: правили в
-- другой вкладке), копия — `copy_material` (свой материал; тот же заголовок,
-- текст, упражнения и план, без выдач — журнал п.76 (21): «(копия)» увидели
-- бы ученики). Границы аргументов функции проверяют сами (корневой
-- CLAUDE.md, «Безопасность», 3).
-- ============================================================================

alter table public.materials add column exercises_version int not null default 1;

-- ---- замок и версия: один триггер на вставку и правку ----------------------
create or replace function public.materials_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    new.exercises_version := 1;
    return new;
  end if;

  if new.exercises is distinct from old.exercises or new.body is distinct from old.body then
    -- запрос — свежим снимком (volatile): правка, дождавшаяся конца сдачи,
    -- видит уже сданную работу
    if exists (
      select 1 from material_assignments ma
       where ma.material_id = old.id
         and (ma.status <> 'assigned'
              or (jsonb_typeof(ma.attempts) = 'array' and jsonb_array_length(ma.attempts) > 0))
    ) then
      raise exception 'RECALL_MATERIAL_LOCKED';
    end if;
    new.exercises_version := old.exercises_version + 1;
  else
    new.exercises_version := old.exercises_version;
  end if;
  return new;
end $fn$;

create trigger materials_guard
  before insert or update on public.materials
  for each row execute function public.materials_guard();

revoke update on public.materials from anon, authenticated;

-- ---- правка упражнений из библиотеки ---------------------------------------
create or replace function public.save_material_exercises(
  p_id uuid, p_exercises jsonb, p_version int
)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare v int;
begin
  if auth.uid() is null then raise exception 'RECALL_NO_AUTH'; end if;
  -- упражнения — массив из 1–100 объектов известных видов, не больше 200 КБ
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array'
     or jsonb_array_length(p_exercises) not between 1 and 100
     or octet_length(p_exercises::text) > 200000
     or exists (
       select 1 from jsonb_array_elements(p_exercises) e
        where jsonb_typeof(e) <> 'object'
           or coalesce(e->>'type', '') not in ('mcq', 'fill', 'order', 'match')
     ) then
    raise exception 'RECALL_BAD_EXERCISES';
  end if;

  select exercises_version into v
    from materials where id = p_id and teacher_id = auth.uid()
     for update;
  if v is null then raise exception 'RECALL_MATERIAL_NOT_FOUND'; end if;
  if p_version is distinct from v then raise exception 'RECALL_MATERIAL_STALE'; end if;

  -- замок и новую версию ставит триггер
  update materials set exercises = p_exercises where id = p_id
  returning exercises_version into v;
  return v;
end $fn$;

grant execute on function public.save_material_exercises(uuid, jsonb, int) to authenticated;

-- ---- «Сделать копию и править» ---------------------------------------------
create or replace function public.copy_material(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'RECALL_NO_AUTH'; end if;
  insert into materials (teacher_id, lang, level, topic, format, length_range, title, body, exercises, plan)
  select teacher_id, lang, level, topic, format, length_range, title, body, exercises, plan
    from materials
   where id = p_id and teacher_id = auth.uid()
  returning id into new_id;
  if new_id is null then raise exception 'RECALL_MATERIAL_NOT_FOUND'; end if;
  return new_id;
end $fn$;

grant execute on function public.copy_material(uuid) to authenticated;

-- ---- сдача с версией -------------------------------------------------------
-- Новый пятый аргумент — с умолчанием, а прежняя подпись из четырёх уходит:
-- две перегрузки PostgREST не различил бы. Вызов из четырёх аргументов
-- (приложение до пуша) попадает сюда же и сдаёт, как раньше. Счёт — как в
-- 0017, без изменений.
drop function public.submit_material(uuid, jsonb, int, int);

create function public.submit_material(
  p_id uuid, p_answers jsonb, p_auto_score int, p_auto_total int, p_version int default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  m_exercises jsonb;
  m_version int;
  ex jsonb;
  ans jsonb;
  idx int := 0;
  score int := 0;
  total int := 0;
  given_text text;
  correct_text text;
  ex_type text;
  is_correct boolean;
  pair_hits int;
begin
  -- упражнения берём из материала; клиентские p_auto_score/p_auto_total игнорируем.
  -- for share: правка материала ждёт конца сдачи (и упрётся в замок), а сдача,
  -- начатая во время правки, дождётся её и увидит новую версию
  select mat.exercises, mat.exercises_version into m_exercises, m_version
    from material_assignments ma
    join materials mat on mat.id = ma.material_id
  where ma.id = p_id and ma.student_id = auth.uid() and ma.status = 'assigned'
    for share of mat;
  if m_exercises is null then
    raise exception 'Работа не найдена или уже сдана.';
  end if;
  if p_version is not null and p_version <> m_version then
    raise exception 'RECALL_MATERIAL_CHANGED';
  end if;

  for ex in select value from jsonb_array_elements(m_exercises) loop
    ex_type := ex->>'type';
    -- ответ на это упражнение (по index); нет строки — ans = null
    select value into ans
      from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
    where (value->>'index')::int = idx
    limit 1;

    if ex_type = 'match' then
      -- балл за каждую пару: столько баллов, сколько пар в материале
      if jsonb_typeof(ex->'pairs') = 'array' then
        total := total + jsonb_array_length(ex->'pairs');
        if jsonb_typeof(ans->'pairs') = 'array' then
          select count(*) into pair_hits
            from jsonb_array_elements(ex->'pairs') with ordinality as p(pair, n)
           where coalesce(ans->'pairs'->>((p.n - 1)::int), '') <> ''
             and public.norm_answer(ans->'pairs'->>((p.n - 1)::int))
               = public.norm_answer(p.pair->>'right');
          score := score + pair_hits;
        end if;
      end if;
    else
      total := total + 1;
      given_text := ans->>'given';
      is_correct := false;
      if given_text is not null then
        if ex_type = 'mcq' then
          -- выбор из готовых вариантов: строгая нормализация
          correct_text := ex->'options'->>((ex->>'answer')::int);
          is_correct := correct_text is not null
            and public.norm_answer(given_text) = public.norm_answer(correct_text);
        elsif ex_type = 'fill' then
          -- варианты через «/»: верен любой из них
          select bool_or(public.norm_typed(v) = public.norm_typed(given_text))
            into is_correct
            from unnest(string_to_array(ex->>'answer', '/')) as v;
          is_correct := coalesce(is_correct, false);
        elsif ex_type = 'order' then
          select string_agg(value#>>'{}', ' ' order by ordinality) into correct_text
            from jsonb_array_elements(ex->'answer') with ordinality;
          is_correct := correct_text is not null
            and public.norm_typed(given_text) = public.norm_typed(correct_text);
        end if;
      end if;
      if is_correct then
        score := score + 1;
      end if;
    end if;
    idx := idx + 1;
  end loop;

  update material_assignments
    set answers = p_answers, auto_score = score, auto_total = total,
        status = 'submitted', submitted_at = now()
  where id = p_id and student_id = auth.uid() and status = 'assigned';
  if not found then raise exception 'Работа не найдена или уже сдана.'; end if;
end $fn$;

grant execute on function public.submit_material(uuid, jsonb, int, int, int) to authenticated;

-- триггерную функцию зовёт только база
revoke execute on function public.materials_guard() from authenticated;

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
