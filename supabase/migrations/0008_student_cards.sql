-- 0008 — карточки учеников (PLAN.md Ф2.5; журнал п.25, 28, 43, 64;
-- архитектура §18)
-- ============================================================================
-- Ученика можно вести без аккаунта в Recall: у репетитора — карточка (имя,
-- контакт, заметка, статус «пробный / занимается / пауза / архив»). Карточку
-- можно пригласить в приложение: у неё свой код из 6 знаков (и ссылка с ним),
-- ученик вводит его в то же поле, что и код преподавателя, и попадает ровно в
-- свою карточку — история остаётся при ней. Общий код преподавателя работает
-- как раньше: ввёл его — появляется новая карточка «занимается».
--
-- «В приложении» = есть связь teacher_students (существующий путь привязки).
-- Карточка помнит аккаунт (user_id) и после отвязки: вернулся тот же ученик —
-- вернулась его карточка.
--
-- Место в тарифе (журнал п.28, 64) занимает только ученик В ПРИЛОЖЕНИИ со
-- статусом «занимается» или «пауза». Пробный и архив места не занимают и
-- общего запаса студии не получают — живут на бесплатных лимитах; иначе
-- «вечно пробные» обходили бы лимит мест. Правило — одно: holds_seat(); на нём
-- стоят и покрытие тарифом (covering_teacher), и экран учителя
-- (get_my_student_cards), — копии «первых N» на клиенте больше нет.
--
-- Без тарифа после пробного (журнал п.41) карточки только для просмотра:
-- создание, правка и смена статуса зовут assert_teacher_can_write().
-- Приглашение и привязка — нет: общий код без тарифа работает и сейчас.
--
--   student_cards                 карточки; читать и писать — только через RPC
--   card_takes_seat(status)       какие статусы занимают место
--   seat_links(t)                 связи учителя, которые претендуют на место
--   holds_seat(t, s)              держит ли ученик место тарифа учителя
--   covering_teacher(s)           то же правило покрытия, что было, — на holds_seat
--   lock_teacher_seats(t)         один замок на всё, что двигает места
--   new_invite_code()             код без пересечений: учителя и карточки
--   join_teacher(code)            + код карточки; карточка до связи
--   create/update_student_card, set_student_card_status, student_card_invite,
--   get_my_student_cards()        экран учителя
--   set_student_seat, get_my_plan — на seat_links
--
-- Перенос: каждой нынешней связи — карточка «занимается» с именем из профиля.
-- Самопроверка в конце: карточка есть у каждой связи, покрытие каждого ученика
-- и занятые места каждого учителя — те же, что до миграции; иначе миграция
-- откатывается целиком.
-- ============================================================================

-- ---- снимок «до»: покрытие и места по прежним функциям ----------------------------
create temp table _cards_cover_before as
  select s.student_id,
         public.covering_teacher(s.student_id) as any_teacher,
         public.covering_teacher(s.student_id, true) as paid_teacher
    from (select distinct student_id from public.teacher_students) s;
create temp table _cards_seats_before as
  select teacher_id, count(*)::int as used from public.teacher_students group by teacher_id;

-- ---- данные ------------------------------------------------------------------
create table public.student_cards (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  -- аккаунт ученика; помнится и после отвязки (вернулся — та же карточка)
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  -- телефон или ник в Telegram — одной строкой, как в макете t6-3
  contact text check (char_length(contact) <= 80),
  note text check (char_length(note) <= 1000),
  status text not null default 'active'
    check (status in ('trial', 'active', 'paused', 'archived')),
  -- код приглашения карточки без приложения; гаснет при привязке
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is distinct from teacher_id)
);
-- одна карточка на пару «учитель — аккаунт»
create unique index student_cards_teacher_user on public.student_cards (teacher_id, user_id)
  where user_id is not null;
create index student_cards_teacher on public.student_cards (teacher_id, created_at);
-- Таблица закрыта всем (RLS без политик): заметки учителя ученику не видны,
-- запись — только RPC с проверкой тарифа. Учитель читает своё через
-- get_my_student_cards.
alter table public.student_cards enable row level security;
revoke all on public.student_cards from anon, authenticated;

-- ---- правило мест ------------------------------------------------------------------
create or replace function public.card_takes_seat(p_status text)
returns boolean language sql immutable set search_path = public as $fn$
  select p_status in ('active', 'paused')
$fn$;

-- Связи учителя, претендующие на место: ученик в приложении, карточка
-- «занимается» или «пауза». Все остальные места не занимают.
create or replace function public.seat_links(p_teacher uuid)
returns setof public.teacher_students language sql stable security definer set search_path = public as $fn$
  select ts.*
    from teacher_students ts
    join student_cards c on c.teacher_id = ts.teacher_id and c.user_id = ts.student_id
   where ts.teacher_id = p_teacher
     and public.card_takes_seat(c.status)
$fn$;

-- Держит ли ученик место тарифа учителя. Пока учитель выбор не трогал (ни
-- одного seat) — первые N по дате привязки; тронул — отмеченные, и ранг
-- среди отмеченных считается всегда: после понижения тарифа отмеченных
-- больше, чем мест, и лишние не покрываются. Тот же расчёт, что был в
-- covering_teacher, только кандидаты — seat_links. Принимает чужой uid —
-- закрыта от authenticated.
create or replace function public.holds_seat(p_teacher uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select case
      when exists (select 1 from public.seat_links(p_teacher) x where x.seat) then
        me.seat and (
          select count(*) from public.seat_links(p_teacher) t2
           where t2.seat
             and (coalesce(t2.created_at, 'epoch'::timestamptz), t2.id)
                 <= (coalesce(me.created_at, 'epoch'::timestamptz), me.id)
        ) <= coalesce(public.teacher_seats_effective(p_teacher), 0)
      else (
          select count(*) from public.seat_links(p_teacher) t2
           where (coalesce(t2.created_at, 'epoch'::timestamptz), t2.id)
                 <= (coalesce(me.created_at, 'epoch'::timestamptz), me.id)
        ) <= coalesce(public.teacher_seats_effective(p_teacher), 0)
    end
      from public.seat_links(p_teacher) me
     where me.student_id = p_student
  ), false)
$fn$;

-- Кто из преподавателей покрывает ученика своим тарифом; null — никто.
-- p_paid_only = true → пробный учителя не считается (для has_paid_access).
-- Условия тарифа — прежние (0000_baseline), места — holds_seat.
create or replace function public.covering_teacher(
  p_student uuid, p_paid_only boolean default false
)
returns uuid language sql stable security definer set search_path = public as $fn$
  select ts.teacher_id
    from teacher_students ts
    join profiles tp on tp.id = ts.teacher_id
   where ts.student_id = p_student
     and not coalesce(tp.blocked, false) -- блокировка учителя снимает бенефит
     and (
       (tp.plan like 'teacher_%'
        and tp.plan_expires_at is not null and tp.plan_expires_at > now())
       -- пробный учителя: plan = 'free', поэтому только по trial_until
       or (not p_paid_only and tp.role = 'teacher' and tp.trial_until > now())
     )
     and public.holds_seat(ts.teacher_id, p_student)
   -- если преподавателей несколько, оплаченный тариф важнее пробного
   order by (tp.plan_expires_at is not null and tp.plan_expires_at > now()) desc
   limit 1
$fn$;

-- Один замок на всё, что двигает места: привязку, выбор места, смену
-- статуса. Раньше join_teacher и set_student_seat брали РАЗНЫЕ замки
-- ('join_teacher:' и 'seats:'), и одновременные привязка и «дать место»
-- могли пройти мимо лимита.
create or replace function public.lock_teacher_seats(p_teacher uuid)
returns void language sql volatile set search_path = public as $fn$
  select pg_advisory_xact_lock(hashtext('seats:' || p_teacher::text))
$fn$;

-- Первое явное действие с местами при переполнении: закрепить текущий
-- расклад «первые N по дате», иначе новый претендент со старой датой
-- привязки (пробный → «занимается») молча вытеснил бы покрытого.
create or replace function public.pin_default_seats(p_teacher uuid)
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare seats int;
begin
  if exists (select 1 from public.seat_links(p_teacher) x where x.seat) then return; end if;
  seats := coalesce(public.teacher_seats_effective(p_teacher), 0);
  if seats <= 0 then return; end if;
  update teacher_students ts set seat = true
   where ts.id in (
     select x.id from public.seat_links(p_teacher) x
      order by x.created_at nulls first, x.id
      limit seats
   );
end $fn$;

-- ---- коды приглашения: учителя и карточки не пересекаются -------------------------
-- join_teacher ищет сначала код учителя, потом код карточки: совпади они —
-- карточка была бы недостижима.
create or replace function public.new_invite_code()
returns text language plpgsql volatile security definer set search_path = public as $fn$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
  i int;
  attempt int;
begin
  for attempt in 1..20 loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from profiles where invite_code = c)
       and not exists (select 1 from student_cards where invite_code = c) then
      return c;
    end if;
  end loop;
  raise exception 'Не удалось создать код. Попробуй ещё раз.';
end $fn$;

-- Код учителя — тем же генератором. Тело — прежнее (0000_baseline).
create or replace function public.ensure_invite_code()
returns text language plpgsql security definer set search_path = public as $fn$
declare existing text; new_code text; attempt int;
begin
  select invite_code into existing from profiles where id = auth.uid() and role = 'teacher';
  if existing is not null then return existing; end if;
  if not exists (select 1 from profiles where id = auth.uid() and role = 'teacher') then
    raise exception 'Код-приглашение доступен только преподавателю.';
  end if;
  for attempt in 1..6 loop
    new_code := public.new_invite_code();
    begin
      update profiles set invite_code = new_code where id = auth.uid();
      return new_code;
    exception when unique_violation then
      -- код заняли между проверкой и записью — пробуем ещё
    end;
  end loop;
  raise exception 'Не удалось создать код. Попробуй ещё раз.';
end $fn$;

-- Перевыпуск: старый код сразу перестаёт работать, привязанные остаются.
create or replace function public.regenerate_invite_code()
returns text language plpgsql security definer set search_path = public as $fn$
declare new_code text; attempt int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'teacher') then
    raise exception 'Код-приглашение доступен только преподавателю.';
  end if;
  for attempt in 1..6 loop
    new_code := public.new_invite_code();
    begin
      update profiles set invite_code = new_code where id = auth.uid();
      return new_code;
    exception when unique_violation then
      -- код заняли между проверкой и записью — пробуем ещё
    end;
  end loop;
  raise exception 'Не удалось создать код. Попробуй ещё раз.';
end $fn$;

-- ---- перенос нынешних связей ----------------------------------------------------------
-- До триггера ниже: дата карточки — дата привязки, имя — из профиля.
insert into public.student_cards (teacher_id, user_id, name, status, created_at, updated_at)
select ts.teacher_id, ts.student_id,
       left(coalesce(nullif(btrim(p.display_name), ''), 'Ученик'), 80),
       'active', coalesce(ts.created_at, now()), now()
  from public.teacher_students ts
  join public.profiles p on p.id = ts.student_id;

-- ---- у каждой связи — карточка ------------------------------------------------------------
-- Любая привязка (join_teacher, вставка смоука, SQL владельца) получает
-- карточку «занимается», если у пары её ещё нет. Карточку, привязанную по
-- своему коду, join_teacher связывает раньше вставки — тогда здесь пусто.
create or replace function public.trg_link_card()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into student_cards (teacher_id, user_id, name, status, created_at)
  select new.teacher_id, new.student_id,
         left(coalesce(nullif(btrim(p.display_name), ''), 'Ученик'), 80),
         'active', coalesce(new.created_at, now())
    from profiles p
   where p.id = new.student_id
     and not exists (
       select 1 from student_cards c
        where c.teacher_id = new.teacher_id and c.user_id = new.student_id
     );
  return new;
end $fn$;
revoke execute on function public.trg_link_card() from authenticated;
create trigger teacher_students_card after insert on public.teacher_students
  for each row execute function public.trg_link_card();

-- ---- привязка по коду ----------------------------------------------------------------------
-- Код учителя → своя карточка ученика у этого учителя (была — она же) или
-- новая «занимается». Код карточки → эта карточка; если у ученика уже есть
-- своя карточка у этого учителя — она (история важнее кода). Карточка из
-- архива возвращается «занимается». Место проверяется, только если карточка
-- его займёт: пробного пустят и при полных местах.
create or replace function public.join_teacher(code text)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(code, '')));
  t record;
  v_card uuid;
  v_card_teacher uuid;
  target record;
  v_status text;
  seats int;
  taken int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;

  select id, coalesce(display_name, 'Преподаватель') as nm into t
    from profiles where invite_code = v_code and role = 'teacher';
  if t.id is null and v_code <> '' then
    select c.id, c.teacher_id into v_card, v_card_teacher
      from student_cards c where c.invite_code = v_code;
    if v_card is not null then
      select id, coalesce(display_name, 'Преподаватель') as nm into t
        from profiles where id = v_card_teacher and role = 'teacher';
    end if;
  end if;
  if t.id is null then
    raise exception 'Код не найден. Проверь код у преподавателя.';
  end if;
  if t.id = uid then
    raise exception 'Это твой собственный код — привязаться к себе нельзя.';
  end if;

  perform public.lock_teacher_seats(t.id);

  if exists (select 1 from teacher_students where teacher_id = t.id and student_id = uid) then
    return t.nm;
  end if;

  select * into target from student_cards where teacher_id = t.id and user_id = uid for update;
  if target.id is null and v_card is not null then
    select * into target from student_cards where id = v_card for update;
  end if;
  v_status := case
    when target.id is null or target.status = 'archived' then 'active'
    else target.status
  end;

  -- null = без ограничения (учитель без тарифа и без пробного: его ученики
  -- ничего не наследуют, считать нечего)
  seats := public.teacher_seats_effective(t.id);
  if public.card_takes_seat(v_status) and seats is not null then
    select count(*) into taken from public.seat_links(t.id);
    if taken >= seats then
      -- один код на все случаи: ученику не показываем, какой у учителя тариф
      raise exception 'RECALL_SEATS_FULL';
    end if;
  end if;

  -- карточку — ДО связи: триггер увидит её и не заведёт вторую
  if target.id is not null then
    update student_cards
       set user_id = uid, status = v_status, invite_code = null, updated_at = now()
     where id = target.id;
  end if;
  insert into teacher_students (teacher_id, student_id)
  values (t.id, uid)
  on conflict (teacher_id, student_id) do nothing;

  -- Учитель уже распределял места руками и свободное осталось — занимаем его
  -- сразу, иначе новый ученик молча оказался бы «вне тарифа».
  if public.card_takes_seat(v_status)
     and exists (select 1 from public.seat_links(t.id) x where x.seat) then
    select count(*) into taken from public.seat_links(t.id) x where x.seat;
    if taken < coalesce(seats, 0) then
      update teacher_students set seat = true where teacher_id = t.id and student_id = uid;
    end if;
  end if;
  return t.nm;
end $fn$;

-- ---- выбор места руками ----------------------------------------------------------------------
-- Тело — прежнее (0000_baseline), кандидаты — seat_links, замок — общий.
-- Пробному и архиву место не дать: они его не занимают по правилу.
create or replace function public.set_student_seat(p_student uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  seats int;
  taken int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if not exists (
    select 1 from teacher_students where teacher_id = uid and student_id = p_student
  ) then
    raise exception 'RECALL_NOT_YOUR_STUDENT';
  end if;

  perform public.lock_teacher_seats(uid);

  if p_on and not exists (select 1 from public.seat_links(uid) x where x.student_id = p_student) then
    raise exception 'RECALL_CARD_NO_SEAT';
  end if;

  -- первое явное действие: закрепляем текущее умолчание (первые N по дате),
  -- иначе включение одного ученика молча сняло бы покрытие со всех остальных
  perform public.pin_default_seats(uid);

  if p_on then
    seats := public.teacher_seats_effective(uid);
    if seats is not null then
      select count(*) into taken from public.seat_links(uid) x
       where x.seat and x.student_id <> p_student;
      if taken >= seats then
        raise exception 'RECALL_SEATS_FULL';
      end if;
    end if;
  end if;

  update teacher_students set seat = p_on
   where teacher_id = uid and student_id = p_student;
end $fn$;

-- ---- карточки: создать, изменить, статус, пригласить -----------------------------------------
create or replace function public.card_text(p text, p_max int)
returns text language sql immutable set search_path = public as $fn$
  select nullif(left(btrim(p), p_max), '')
$fn$;

-- Новый ученик (макет t6-3): статус — «пробный» или «занимается».
create or replace function public.create_student_card(
  p_name text, p_contact text default null, p_note text default null, p_status text default 'trial'
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_name text := public.card_text(p_name, 80);
begin
  perform public.assert_teacher_can_write();
  if v_name is null then raise exception 'RECALL_CARD_NAME'; end if;
  if p_status is null or p_status not in ('trial', 'active') then
    raise exception 'RECALL_BAD_STATUS';
  end if;
  insert into student_cards (teacher_id, name, contact, note, status)
  values (auth.uid(), v_name, public.card_text(p_contact, 80), public.card_text(p_note, 1000), p_status)
  returning id into v_id;
  return v_id;
end $fn$;

-- «Изменить данные»: имя, контакт, заметка. Имя карточки — подпись учителя,
-- имя в аккаунте ученика не меняется.
create or replace function public.update_student_card(
  p_card uuid, p_name text, p_contact text default null, p_note text default null
)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_name text := public.card_text(p_name, 80);
begin
  perform public.assert_teacher_can_write();
  if v_name is null then raise exception 'RECALL_CARD_NAME'; end if;
  update student_cards
     set name = v_name, contact = public.card_text(p_contact, 80),
         note = public.card_text(p_note, 1000), updated_at = now()
   where id = p_card and teacher_id = auth.uid();
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
end $fn$;

-- «На паузу», «В архив», «Вернуть из архива», «пробный → занимается».
-- Ушёл с места (пробный, архив) — отметка места снимается, и в умолчании
-- место переходит к следующему по дате. Пришёл на место при полных местах —
-- текущий расклад закрепляется, новый остаётся «вне мест тарифа», как после
-- понижения тарифа: учёт учителя не блокируем, покрытие не вытесняем.
create or replace function public.set_student_card_status(p_card uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  c record;
  linked boolean;
  seats int;
  taken int;
begin
  perform public.assert_teacher_can_write();
  if p_status is null or p_status not in ('trial', 'active', 'paused', 'archived') then
    raise exception 'RECALL_BAD_STATUS';
  end if;
  perform public.lock_teacher_seats(uid);
  select * into c from student_cards where id = p_card and teacher_id = uid for update;
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
  if c.status = p_status then return; end if;

  linked := c.user_id is not null and exists (
    select 1 from teacher_students where teacher_id = uid and student_id = c.user_id
  );
  seats := public.teacher_seats_effective(uid);

  if linked and seats is not null
     and public.card_takes_seat(p_status) and not public.card_takes_seat(c.status) then
    select count(*) into taken from public.seat_links(uid);
    if taken >= seats then perform public.pin_default_seats(uid); end if;
  end if;

  -- код приглашения не трогаем: «Вернуть» после архива — настоящий откат, и
  -- уже отправленное ученику приглашение продолжает работать
  update student_cards set status = p_status, updated_at = now() where id = p_card;

  if linked then
    if not public.card_takes_seat(p_status) then
      update teacher_students set seat = false where teacher_id = uid and student_id = c.user_id;
    elsif not public.card_takes_seat(c.status)
          and exists (select 1 from public.seat_links(uid) x where x.seat and x.student_id <> c.user_id) then
      select count(*) into taken from public.seat_links(uid) x where x.seat and x.student_id <> c.user_id;
      if taken < coalesce(seats, 0) then
        update teacher_students set seat = true where teacher_id = uid and student_id = c.user_id;
      end if;
    end if;
  end if;
end $fn$;

-- «Пригласить в Recall» (макет t6-4): код карточки, создаётся при первом
-- показе. Ученику в приложении и карточке в архиве — нет. Тарифа не требует:
-- общий код без тарифа работает так же.
create or replace function public.student_card_invite(p_card uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); c record; v_code text; attempt int;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if not exists (select 1 from profiles where id = uid and role = 'teacher') then
    raise exception 'RECALL_NOT_TEACHER';
  end if;
  select * into c from student_cards where id = p_card and teacher_id = uid for update;
  if not found then raise exception 'RECALL_CARD_NOT_FOUND'; end if;
  if c.status = 'archived' then raise exception 'RECALL_CARD_ARCHIVED'; end if;
  if c.user_id is not null and exists (
    select 1 from teacher_students where teacher_id = uid and student_id = c.user_id
  ) then
    raise exception 'RECALL_CARD_IN_APP';
  end if;
  if c.invite_code is not null then return c.invite_code; end if;
  for attempt in 1..6 loop
    v_code := public.new_invite_code();
    begin
      update student_cards set invite_code = v_code where id = p_card;
      return v_code;
    exception when unique_violation then
      -- код заняли между проверкой и записью — пробуем ещё
    end;
  end loop;
  raise exception 'Не удалось создать код. Попробуй ещё раз.';
end $fn$;

-- Карточки учителя для экрана «Ученики». in_app — есть связь; holds_seat —
-- держит место тарифа по тому же правилу, что покрытие (копии «первых N» на
-- клиенте нет). user_id отдаётся только ученику в приложении.
create or replace function public.get_my_student_cards()
returns table (
  id uuid, user_id uuid, name text, contact text, note text, status text,
  created_at timestamptz, updated_at timestamptz,
  in_app boolean, linked_at timestamptz, seat boolean, holds_seat boolean
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return query
  select c.id,
         case when ts.id is not null then c.user_id end,
         c.name, c.contact, c.note, c.status, c.created_at, c.updated_at,
         ts.id is not null,
         ts.created_at,
         coalesce(ts.seat, false),
         ts.id is not null and public.holds_seat(uid, c.user_id)
    from student_cards c
    left join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = c.user_id
   where c.teacher_id = uid
   order by c.created_at, c.id;
end $fn$;

-- ---- сводка тарифа: занятые места — по правилу мест -----------------------------------------
-- Тело — из 0005, изменена одна строка: seats_used считает seat_links.
create or replace function public.get_my_plan()
  returns json language plpgsql security definer set search_path = public as $fn$
  declare
    uid uuid := auth.uid();
    p record; prem boolean; used int;
    day0 timestamptz := public.recall_day_start();
    src record; e_spent int; e_self int; g_used int;
    v_seats int; v_seats_used int;
  begin
    if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
    select plan, plan_expires_at, trial_until, is_admin, role, first_student_at, trial_bonus_days
      into p from profiles where id = uid;
    prem := public.has_premium_access(uid);
    select count(*) into used from ai_calls
      where user_id = uid and ai_calls.kind = 'heavy' and called_at > now() - interval '24 hours';
    select * into src from public.energy_source(uid);
    select coalesce(sum(cost_energy),0) into e_spent from ai_calls
      where pool_owner = src.pool_owner and called_at >= day0;
    select coalesce(sum(cost_energy),0) into e_self from ai_calls
      where user_id = uid and called_at >= day0;
    select count(*) into g_used from ai_calls
      where pool_owner = src.pool_owner and is_generation and called_at >= public.recall_month_start();
    -- seats: null = без ограничения (клиент так и покажет)
    v_seats := public.teacher_seats_effective(uid);
    -- места занимают только ученики в приложении «занимается»/«пауза» (Ф2.5)
    select count(*) into v_seats_used from public.seat_links(uid);
    return json_build_object(
      'plan', p.plan, 'plan_expires_at', p.plan_expires_at, 'trial_until', p.trial_until,
      'is_admin', p.is_admin, 'premium', prem,
      'ai_used_today', used, 'ai_day_limit', case when p.is_admin then 999999 when prem then 200 else 5 end,
      'energy_max', case when p.is_admin then 999999 else src.day_budget end,
      'energy_spent', e_spent, 'energy_self', e_self,
      'energy_subcap', case when src.in_studio and src.pool_owner <> uid then src.day_budget / 2 else null end,
      'in_studio', src.in_studio,
      'gen_limit', src.gen_limit, 'gen_used', g_used,
      -- места (A1): сколько всего и сколько занято; для не-преподавателя seats = 0
      'seats', v_seats, 'seats_used', v_seats_used,
      'free_seats', public.free_teacher_seats(),
      -- пробный репетитора (Ф2.2): пошёл ли отсчёт от первого ученика и
      -- сколько дней он длится (14 + бонус рефералки)
      'trial_started', p.first_student_at is not null,
      'trial_days', 14 + coalesce(p.trial_bonus_days, 0),
      -- можно ли менять расписание: тариф репетитора или пробный (журнал п.41)
      'can_write', public.teacher_can_write(uid)
    );
  end $fn$;

-- ---- права: служебное с чужим uid — закрыто и от вошедших -----------------------------------
revoke execute on function public.seat_links(uuid) from authenticated;
revoke execute on function public.holds_seat(uuid, uuid) from authenticated;
revoke execute on function public.covering_teacher(uuid, boolean) from authenticated;
revoke execute on function public.lock_teacher_seats(uuid) from authenticated;
revoke execute on function public.pin_default_seats(uuid) from authenticated;
revoke execute on function public.new_invite_code() from authenticated;

-- ---- самопроверка «после»: иначе миграция откатывается целиком ---------------------------
do $check$
declare
  n_links int;
  n_cards int;
  n_cover int;
  n_seats int;
begin
  select count(*) into n_links from public.teacher_students;
  select count(*) into n_cards
    from public.teacher_students ts
    join public.student_cards c on c.teacher_id = ts.teacher_id and c.user_id = ts.student_id;
  if n_links <> n_cards then
    raise exception 'student_cards: связей %, с карточкой %', n_links, n_cards;
  end if;
  select count(*) into n_cover from _cards_cover_before b
   where b.any_teacher is distinct from public.covering_teacher(b.student_id)
      or b.paid_teacher is distinct from public.covering_teacher(b.student_id, true);
  if n_cover > 0 then
    raise exception 'student_cards: покрытие тарифом изменилось у % учеников', n_cover;
  end if;
  select count(*) into n_seats from _cards_seats_before b
   where b.used <> (select count(*) from public.seat_links(b.teacher_id));
  if n_seats > 0 then
    raise exception 'student_cards: занятые места изменились у % учителей', n_seats;
  end if;
  raise notice 'student_cards: связей %, карточек %, покрытие и места сверены', n_links, n_cards;
end $check$;
drop table _cards_cover_before, _cards_seats_before;

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
