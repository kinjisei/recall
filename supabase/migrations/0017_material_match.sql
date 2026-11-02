-- ============================================================================
-- 0017 — «Соедини пары» в работе по материалу: балл за каждую пару (PLAN.md
-- Ф2.25-1а, журнал п.76 (8); макет u5-2: «3 из 4 пар — 3 балла»).
--
-- Упражнение `match` в materials.exercises: { type: 'match', format,
-- prompt, pairs: [{ left, right }…], extra? }. Ученик присылает в ответе
-- `pairs` — что он соединил с каждым словом, по порядку pairs материала.
-- Пара верна, если norm_answer выбранного = norm_answer правой половины
-- (выбор из готового списка — строгая сверка, как у mcq); пустое — неверно.
--
-- Счёт работы — в БАЛЛАХ: у пар — по числу пар, у остальных упражнений — 1;
-- auto_total — сумма баллов, а не число упражнений. Клиент считает так же
-- (src/lib/assignmentScore.ts workScore, сверка — lib/text.ts
-- normalizeChoice = norm_answer); случаи у них общие (scripts/_match-cases.mjs:
-- test-match-score — клиент, check-material-match — эта функция).
--
-- «Верно / Неверно / Не сказано» и «Выбери правильную форму» — это mcq с
-- полем format: ветка mcq считает их по тексту выбранного варианта, правка
-- не нужна. Остальное в функции — как в 0000 (подпись та же, права остаются).
-- ============================================================================

create or replace function public.submit_material(
  p_id uuid, p_answers jsonb, p_auto_score int, p_auto_total int
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  m_exercises jsonb;
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
  -- упражнения берём из материала; клиентские p_auto_score/p_auto_total игнорируем
  select mat.exercises into m_exercises
    from material_assignments ma
    join materials mat on mat.id = ma.material_id
  where ma.id = p_id and ma.student_id = auth.uid() and ma.status = 'assigned';
  if m_exercises is null then
    raise exception 'Работа не найдена или уже сдана.';
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

grant execute on function public.submit_material(uuid, jsonb, int, int) to authenticated;

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
