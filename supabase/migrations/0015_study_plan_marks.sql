-- ============================================================================
-- 0015 — «сделал» у пунктов программы обучения (PLAN.md Ф2.17-4г-1, журнал
-- п.76 (9); легенда макета d11-3: у сохранённой программы пройденные пункты —
-- с галочкой).
--
-- Пункт отмечает сам ученик в своей «Программе», учитель видит галочки в
-- карточке. Дата недели «пройденным» пункт не делает: неделя прошла — не
-- значит сделано.
--
-- study_plan_marks — строка на отмеченный пункт: программа, номер недели и
-- пункта (с нуля, как в weeks). Видна тому, кто видит саму программу
-- (RLS study_plans: ученик — свою, учитель — программы своих учеников).
-- Писать — только set_plan_item_done: ученик и только в своей активной
-- программе, номера — в границах weeks этой программы. Учитель отметить за
-- ученика не может. Новая программа («Изменить» → replace_study_plan) — новый
-- id, отметки прежней уходят в архив вместе с ней.
-- ============================================================================

create table public.study_plan_marks (
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  week int not null check (week between 0 and 51),
  item int not null check (item between 0 and 49),
  done_at timestamptz not null default now(),
  primary key (plan_id, week, item)
);

alter table public.study_plan_marks enable row level security;

revoke all on public.study_plan_marks from anon, authenticated;
grant select on public.study_plan_marks to authenticated;

-- видна тому, кому видна программа: подзапрос идёт под RLS study_plans
create policy "plan marks follow the plan" on public.study_plan_marks
  for select using (
    exists (select 1 from public.study_plans p where p.id = study_plan_marks.plan_id)
  );

create or replace function public.set_plan_item_done(
  p_plan_id uuid, p_week int, p_item int, p_done boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare w jsonb;
begin
  select weeks into w from study_plans
   where id = p_plan_id and student_id = auth.uid() and status = 'active';
  if w is null then raise exception 'RECALL_PLAN_NOT_FOUND'; end if;

  -- номера — только в границах ЭТОЙ программы: строк больше, чем пунктов, не будет
  if p_week is null or p_item is null
     or p_week < 0 or p_week >= jsonb_array_length(w)
     or coalesce(jsonb_typeof(w -> p_week -> 'items'), '') <> 'array'
     or p_item < 0 or p_item >= jsonb_array_length(w -> p_week -> 'items') then
    raise exception 'RECALL_BAD_PLAN_ITEM';
  end if;

  if coalesce(p_done, false) then
    insert into study_plan_marks (plan_id, week, item)
      values (p_plan_id, p_week, p_item)
      on conflict do nothing;
  else
    delete from study_plan_marks
     where plan_id = p_plan_id and week = p_week and item = p_item;
  end if;
end $fn$;

grant execute on function public.set_plan_item_done(uuid, int, int, boolean) to authenticated;

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
