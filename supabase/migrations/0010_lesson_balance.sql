-- 0010 — учёт уроков и «остался 1» (PLAN.md Ф2.8; журнал п.29, 33, 67;
-- архитектура §17–18)
-- ============================================================================
-- Учитель вовремя вспоминает напомнить об оплате — не назойливо ни для него,
-- ни для ученика. Деньги Recall не касаются: только число уроков (п.29).
--
--   paid_lessons.paid_on   дата оплаты (макет t7-1; решение владельца
--                          04.10.2026): по умолчанию сегодня, можно раньше
--   add_paid_lessons       + p_paid_on; старая подпись снята
--   get_card_history       история карточки: оплаты и уроки (макет t7-2),
--                          страницами, только своему учителю
--   notify_lessons_low     правило «остался 1»: остаток впервые в цикле стал
--                          1 или меньше → одно уведомление учителю (решение
--                          владельца 04.10.2026: «1 или меньше» — будильник
--                          мог списать два урока разом, исправление минусом
--                          тоже прыгает через 1). Цикл — последняя ПОЛОЖИТЕЛЬНАЯ
--                          оплата: исправление минусом нового цикла не
--                          открывает. Без тарифа правило молчит (п.41), без
--                          отмеченных оплат — тоже (учёт не ведётся)
--   send_card_message      «Напомнить → В приложении» (макет t7-3): сообщение
--                          ученику от учителя по его нажатию. Правила «об
--                          оплате ученику» нет вовсе (п.29) — это не правило,
--                          а ручное сообщение, как WhatsApp
--   В23                    удаление аккаунта обнуляет paid_lessons.created_by —
--                          единственная правка журнала, которую пропускает
--                          триггер «только дописывается» (PLAN.md Ф2.15)
-- ============================================================================

-- ---- дата оплаты --------------------------------------------------------------------
alter table public.paid_lessons add column paid_on date;
-- прежние записи: день отметки по Алматы. Журнал правок не принимает —
-- триггер на время переноса снят
alter table public.paid_lessons disable trigger paid_lessons_append_only;
update public.paid_lessons set paid_on = (created_at at time zone 'Asia/Almaty')::date where paid_on is null;
alter table public.paid_lessons enable trigger paid_lessons_append_only;
alter table public.paid_lessons
  alter column paid_on set default ((now() at time zone 'Asia/Almaty')::date),
  alter column paid_on set not null;

-- ---- В23: журнал только дописывается, но аккаунт удаляется ---------------------------
-- created_by … on delete set null — правка строки при удалении аккаунта. Её
-- одну и пропускаем: всё прочее в строке обязано остаться как было.
create or replace function public.trg_paid_lessons_append_only()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if old.created_by is not null and new.created_by is null
     and (new.id, new.teacher_id, new.card_id, new.n, new.note, new.created_at, new.paid_on)
         is not distinct from (old.id, old.teacher_id, old.card_id, old.n, old.note, old.created_at, old.paid_on) then
    return new;
  end if;
  raise exception 'paid_lessons только дописывается: исправление — записью с минусом';
end $fn$;

-- ---- оплата «+N» с датой --------------------------------------------------------------
drop function public.add_paid_lessons(uuid, int, text);
create or replace function public.add_paid_lessons(p_card uuid, p_count int, p_note text default null, p_paid_on date default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Almaty')::date;
  v_on date := coalesce(p_paid_on, v_today);
  v_id uuid;
  v_paid int;
begin
  perform public.assert_teacher_can_write();
  perform 1 from student_cards where id = p_card and teacher_id = uid for update;
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
  if p_count is null or p_count = 0 or p_count not between -100 and 100 then raise exception 'RECALL_BAD_COUNT'; end if;
  -- оплата — не в будущем и не старше года
  if v_on > v_today or v_on < v_today - 366 then raise exception 'RECALL_BAD_PAID_ON'; end if;
  if (select count(*) from paid_lessons where card_id = p_card) >= public.schedule_limit('paid_rows') then
    raise exception 'RECALL_SCHEDULE_LIMIT';
  end if;
  if p_count < 0 then
    select coalesce(sum(n), 0) into v_paid from paid_lessons where card_id = p_card;
    if v_paid + p_count < 0 then raise exception 'RECALL_BAD_COUNT'; end if;
  end if;
  insert into paid_lessons (teacher_id, card_id, n, note, created_by, paid_on)
  values (uid, p_card, p_count, public.card_text(p_note, 200), uid, v_on)
  returning id into v_id;
  return v_id;
end $fn$;

-- ---- история карточки (макет t7-2) ------------------------------------------------------
-- Оплаты и уроки одной лентой, новые сверху; at < p_before — следующая
-- страница. Урок — каждое участие карточки, которое уже случилось или
-- отмечено: прошедшие, отменённые, отмеченные заранее. Будущие запланированные
-- без отметки — не история.
create or replace function public.get_card_history(p_card uuid, p_before timestamptz default null, p_limit int default 50)
returns table (
  item text, id uuid, at timestamptz,
  n int, note text, paid_on date,
  lesson_kind text, lesson_status text, title text, starts_at timestamptz, ends_at timestamptz,
  trial boolean, attended boolean, charge text, charge_auto boolean
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  perform 1 from student_cards where id = p_card and teacher_id = uid;
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
  return query
  select * from (
    -- оплата встаёт в свой день: отмечена в тот же день — по времени
    -- отметки, задним числом — в полдень того дня
    select 'payment'::text, p.id,
           case when (p.created_at at time zone 'Asia/Almaty')::date = p.paid_on then p.created_at
                else (p.paid_on + time '12:00') at time zone 'Asia/Almaty' end,
           p.n, p.note, p.paid_on,
           null::text, null::text, null::text, null::timestamptz, null::timestamptz,
           null::boolean, null::boolean, null::text, null::boolean
      from paid_lessons p
     where p.card_id = p_card
    union all
    select 'lesson'::text, l.id, l.starts_at,
           null::int, null::text, null::date,
           l.kind, l.status, coalesce(l.title, s.title), l.starts_at, l.ends_at,
           lp.trial, lp.attended, lp.charge, lp.charge_auto
      from lesson_participants lp
      join lessons l on l.id = lp.lesson_id
      left join lesson_series s on s.id = l.series_id
     where lp.card_id = p_card
       and (l.starts_at <= now() or l.status = 'cancelled' or lp.charge is not null)
  ) h (item, id, at, n, note, paid_on, lesson_kind, lesson_status, title, starts_at, ends_at, trial, attended, charge, charge_auto)
   where p_before is null or h.at < p_before
   order by h.at desc, h.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $fn$;

-- ---- исправить списание отменённого урока (макет t7-2) ----------------------------------
-- «Поздняя отмена · списан» → «не списывать» и обратно задним числом.
-- mark_lesson_participant отметки отменённого урока не меняет (урок не
-- проходил, «был» быть не может) — это отдельное исправление. Пробному
-- списание не ставится никогда (п.30).
create or replace function public.set_cancel_charge(p_lesson uuid, p_card uuid, p_charge boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); l record; v_trial boolean;
begin
  perform public.assert_teacher_can_write();
  select * into l from lessons where id = p_lesson and teacher_id = uid for update;
  if not found then raise exception 'RECALL_LESSON_NOT_FOUND'; end if;
  if l.status <> 'cancelled' then raise exception 'RECALL_NOT_CANCELLED'; end if;
  select lp.trial into v_trial from lesson_participants lp where lp.lesson_id = l.id and lp.card_id = p_card;
  if not found then raise exception 'RECALL_NOT_IN_LESSON'; end if;
  if coalesce(p_charge, false) and v_trial then raise exception 'RECALL_TRIAL_FREE'; end if;
  update lesson_participants
     set attended = false,
         charge = case when coalesce(p_charge, false) then 'late_cancel' else 'not_charged' end,
         charge_auto = false,
         marked_at = now()
   where lesson_id = l.id and card_id = p_card;
end $fn$;

-- ---- правило «остался 1» ----------------------------------------------------------------
-- Одно уведомление на цикл (ключ — последняя положительная оплата), когда
-- остаток стал 1 или меньше. Зовут триггеры: списание участия и исправление
-- оплаты минусом. Повтор — только после новой оплаты (п.29). Принимает любую
-- карточку — закрыта.
create or replace function public.notify_lessons_low(p_card uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $fn$
declare
  c record;
  v_cycle uuid;
  v_left int;
  v_next timestamptz;
begin
  select id, teacher_id, name, user_id into c from student_cards where id = p_card;
  if not found then return false; end if;
  -- без тарифа «остался 1» на паузе, как и автосписание (п.41)
  if not public.teacher_can_write(c.teacher_id) then return false; end if;
  select id into v_cycle from paid_lessons
   where card_id = p_card and n > 0
   order by created_at desc, id desc limit 1;
  -- оплат не отмечено — учёт не ведётся, напоминать не о чем
  if v_cycle is null then return false; end if;
  select balance into v_left from public.card_lesson_balance(p_card);
  if v_left > 1 then return false; end if;
  select min(l.starts_at) into v_next
    from lesson_participants lp join lessons l on l.id = lp.lesson_id
   where lp.card_id = p_card and l.status = 'planned' and l.starts_at > now();
  return public.notify(c.teacher_id, 'lessons_low',
    jsonb_build_object('card', c.id, 'name', c.name, 'left', v_left, 'next', v_next, 'in_app', c.user_id is not null),
    'lessons-low:' || v_cycle::text);
end $fn$;

-- списание участия (будильник, отметка учителя, поздняя отмена)
create or replace function public.trg_participant_charged()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.charge in ('charged', 'late_cancel')
     and (tg_op = 'INSERT' or old.charge is null or old.charge not in ('charged', 'late_cancel')) then
    perform public.notify_lessons_low(new.card_id);
  end if;
  return null;
end $fn$;
create trigger lesson_participants_charged after insert or update of charge on public.lesson_participants
  for each row execute function public.trg_participant_charged();

-- исправление оплаты минусом тоже может опустить остаток до 1 и ниже
create or replace function public.trg_paid_correction()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.n < 0 then perform public.notify_lessons_low(new.card_id); end if;
  return null;
end $fn$;
create trigger paid_lessons_correction after insert on public.paid_lessons
  for each row execute function public.trg_paid_correction();

-- ---- «Напомнить → В приложении» (макет t7-3) ------------------------------------------------
-- Сообщение ученику от его учителя — только по нажатию учителя и только
-- ученику в приложении, привязанному к нему. До 10 сообщений одному ученику
-- в день: ручная кнопка не должна стать рассылкой.
create or replace function public.send_card_message(p_card uuid, p_text text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  c record;
  v_text text := public.card_text(p_text, 500);
  v_today date := (now() at time zone 'Asia/Almaty')::date;
  v_key text := 'teacher-message:' || gen_random_uuid()::text;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  select id, user_id into c from student_cards where id = p_card and teacher_id = uid;
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
  if c.user_id is null or not exists (
    select 1 from teacher_students where teacher_id = uid and student_id = c.user_id
  ) then
    raise exception 'RECALL_NOT_IN_APP';
  end if;
  if v_text is null then raise exception 'RECALL_BAD_MESSAGE'; end if;
  if (select count(*) from notifications
       where user_id = c.user_id and kind = 'teacher_message' and data->>'teacher' = uid::text
         and (created_at at time zone 'Asia/Almaty')::date = v_today) >= 10 then
    raise exception 'RECALL_MESSAGE_LIMIT';
  end if;
  perform public.notify(c.user_id, 'teacher_message',
    jsonb_build_object('teacher', uid, 'teacher_name', (select display_name from profiles where id = uid), 'text', v_text),
    v_key);
  return (select id from notifications where user_id = c.user_id and dedupe_key = v_key);
end $fn$;

-- ---- права: служебное — закрыто и от вошедших -------------------------------------------
revoke execute on function public.notify_lessons_low(uuid) from authenticated;
revoke execute on function public.trg_participant_charged() from authenticated;
revoke execute on function public.trg_paid_correction() from authenticated;
revoke execute on function public.trg_paid_lessons_append_only() from authenticated;

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
