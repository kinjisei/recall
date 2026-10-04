-- 0011 — уведомления ученику об уроках и канал push (PLAN.md Ф2.9; журнал п.32,
-- 33, 38, 42, 68; архитектура §17–18)
-- ============================================================================
-- Ученик в приложении вовремя узнаёт об уроке и о его изменении — и не
-- получает лишнего. Ученику без приложения Recall не пишет никогда: учитель
-- пересылает сам («Сообщи ученику», features/schedule).
--
--   push_subscriptions      устройства, где человек включил уведомления;
--                           сами подписки видит только сервер доставки
--   save/delete_push_subscription   включить / забыть это устройство
--   set_lesson_reminders    «Напоминать о скором уроке» (п.38: выключается)
--   get_students_push       учителю: у кого из учеников включены уведомления —
--                           остальным «напиши сам» (журнал п.68)
--   notify_lessons_soon     правило «урок через час»: одно на урок и время
--                           урока; без тарифа учителя — молчит (журнал п.68)
--   after_lessons_changed   крючок 0009 наполнен: «перенесён», «отменён»,
--                           «вернули», новое расписание серии, отмена серии —
--                           одно сообщение на действие учителя (п.42, не
--                           выключается). Изменение, о котором ученику ещё не
--                           отправили, склеивается со следующим: «Отменить» →
--                           «Вернуть» не оставляет ничего
--   dispatch_notifications  + подписки push в теле запроса (сервер в базу не
--                           ходит); сообщения об изменениях — не раньше чем
--                           через минуту (успеть «Вернуть»)
--   settle_dispatches       ответы сервера доставки (net._http_response):
--                           мёртвые подписки — удалить, не дошедшее по сбою —
--                           ещё раз, до 3 попыток (отложено в Ф1.5 до push)
--
-- Push ученику — только об уроках (push_kinds): экран разрешения обещает
-- «Больше ничего присылать не будем» (макет u3-3). Остальное — лента.
-- ============================================================================

-- ---- окружение: доставка читает ответы pg_net ------------------------------------
-- Без этого права повтор и уборка подписок молча не работали бы — пусть лучше
-- не накатится миграция.
do $env$
begin
  if not has_table_privilege('net._http_response', 'select') then
    raise exception '0011: нет права читать net._http_response — доставка не узнает ответов сервера';
  end if;
end $env$;

-- ---- подписки push -----------------------------------------------------------------
-- Адрес службы push браузера (Google, Apple, Mozilla, Microsoft…): только https
-- и только доменное имя — не IP и не localhost: по этому адресу ходит наш
-- сервер. Список служб не зашит: у браузеров без сервисов Google своя служба.
create or replace function public.push_endpoint_ok(p_endpoint text)
returns boolean language sql immutable set search_path = public as $fn$
  select p_endpoint is not null
     and char_length(p_endpoint) <= 1000
     and p_endpoint ~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:443)?/[^\s]*$'
     and p_endpoint !~* '^https://(localhost|[^/]*\.local|[^/]*\.internal)(:|/)'
$fn$;

create table public.push_subscriptions (
  endpoint text primary key check (public.push_endpoint_ok(endpoint)),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ключи шифрования браузера (RFC 8291), base64url: p256dh — 65 байт, auth — 16
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}={0,2}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{21,24}={0,2}$'),
  created_at timestamptz not null default now(),
  -- когда устройство в последний раз подтвердило подписку (приложение открывали)
  seen_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id, seen_at desc);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Включить уведомления на этом устройстве (или подтвердить при открытии
-- приложения). Тот же адрес у другого аккаунта — устройство сменило владельца:
-- уведомления прежнего сюда больше не идут. Больше 10 устройств — старые
-- забываются.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  if not coalesce(public.push_endpoint_ok(p_endpoint), false)
     or coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{86,88}={0,2}$'
     or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{21,24}={0,2}$' then
    raise exception 'RECALL_BAD_PUSH';
  end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, uid, p_p256dh, p_auth)
  on conflict (endpoint) do update
     set user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         seen_at = now(),
         created_at = case when push_subscriptions.user_id = excluded.user_id
                           then push_subscriptions.created_at else now() end;
  delete from push_subscriptions
   where endpoint in (select endpoint from push_subscriptions where user_id = uid
                       order by seen_at desc offset 10);
end $fn$;

-- Забыть это устройство: человек выключил уведомления или выходит из аккаунта.
create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'RECALL_NO_AUTH'; end if;
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $fn$;

-- «Напоминать о скором уроке» (журнал п.38). Через RPC, а не upsert таблицы:
-- upsert переписал бы и user_id, а права на его правку у клиента нет.
create or replace function public.set_lesson_reminders(p_on boolean)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'RECALL_NO_AUTH'; end if;
  if p_on is null then raise exception 'RECALL_BAD_PUSH'; end if;
  insert into notification_prefs (user_id, lesson_reminders, updated_at)
  values (auth.uid(), p_on, now())
  on conflict (user_id) do update set lesson_reminders = excluded.lesson_reminders, updated_at = now();
end $fn$;

-- Учителю для «Сообщи ученику» (журнал п.68): включены ли у ученика в
-- приложении уведомления хотя бы на одном устройстве. Только свои карточки
-- привязанных учеников; сами устройства учитель не видит.
create or replace function public.get_students_push()
returns table (card_id uuid, push boolean)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return query
  select c.id, exists (select 1 from push_subscriptions ps where ps.user_id = c.user_id)
    from student_cards c
    join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = c.user_id
   where c.teacher_id = uid
   order by c.created_at, c.id;
end $fn$;

-- ---- кому пишет Recall --------------------------------------------------------------
-- Ученик в приложении, привязанный к учителю, с карточкой «пробный» или
-- «занимается» (пауза и архив уже убрали его из будущих уроков). Те же
-- условия, что у get_my_lessons. Принимают любой урок и серию — закрыты.
create or replace function public.lesson_app_students(p_lesson uuid)
returns table (user_id uuid, card_id uuid)
language sql stable security definer set search_path = public as $fn$
  select c.user_id, c.id
    from lesson_participants lp
    join student_cards c on c.id = lp.card_id
    join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = c.user_id
   where lp.lesson_id = p_lesson and c.status in ('trial', 'active')
$fn$;

create or replace function public.series_app_students(p_series uuid)
returns table (user_id uuid, card_id uuid)
language sql stable security definer set search_path = public as $fn$
  select c.user_id, c.id
    from series_participants sp
    join student_cards c on c.id = sp.card_id
    join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = c.user_id
   where sp.series_id = p_series and c.status in ('trial', 'active')
$fn$;

create or replace function public.teacher_public_name(p_teacher uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select coalesce((select nullif(btrim(display_name), '') from profiles where id = p_teacher), 'Преподаватель')
$fn$;

-- ---- правило «урок через час» (журнал п.38) ---------------------------------------------
-- Будильник раз в 5 минут: уроки, которые начнутся в ближайший час. Одно
-- уведомление на урок, участника и ВРЕМЯ урока: перенесли на завтра — завтра
-- придёт новое, а не «уже было». Не пишем, если ученик выключил напоминания,
-- если учитель заранее отметил его отсутствие, и без тарифа учителя (журнал
-- п.68: расписание заморожено и может звать на уже перенесённый урок).
-- p_now — параметром: проверка прогоняет «за час до урока» без ожидания.
create or replace function public.notify_lessons_soon(p_now timestamptz)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  n int := 0;
begin
  for r in
    select l.id as lesson_id, l.starts_at, l.ends_at, l.teacher_id, c.user_id,
           coalesce(l.title, s.title) as title,
           coalesce(l.link, s.link, ss.default_link) is not null as has_link
      from lessons l
      join lesson_participants lp on lp.lesson_id = l.id and lp.charge is null
      join student_cards c on c.id = lp.card_id and c.status in ('trial', 'active')
      join teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = c.user_id
      left join lesson_series s on s.id = l.series_id
      left join schedule_settings ss on ss.teacher_id = l.teacher_id
      left join notification_prefs np on np.user_id = c.user_id
     where l.status = 'planned'
       and l.starts_at > p_now and l.starts_at <= p_now + interval '60 minutes'
       and coalesce(np.lesson_reminders, true)
       and public.teacher_can_write(l.teacher_id)
  loop
    if public.notify(
      r.user_id, 'lesson_soon',
      jsonb_build_object('lesson', r.lesson_id, 'at', r.starts_at, 'until', r.ends_at,
                         'teacher_name', public.teacher_public_name(r.teacher_id),
                         'title', r.title, 'link', r.has_link,
                         'href', '/lessons?lesson=' || r.lesson_id),
      'lesson_soon:' || r.lesson_id || ':' || extract(epoch from r.starts_at)::bigint
    ) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $fn$;

create or replace function public.rule_lessons_soon()
returns int language sql security definer set search_path = public as $fn$
  select public.notify_lessons_soon(now())
$fn$;

-- будильнику — запланированные уроки по времени начала
create index lessons_planned_starts on public.lessons (starts_at) where status = 'planned';

insert into public.notification_rules (name, fn, about)
values ('lessons_soon', 'public.rule_lessons_soon',
        'Урок через час — ученику в приложении, одно на урок и время; выключается в настройках (PLAN.md Ф2.9, журнал п.38)')
on conflict (name) do update set fn = excluded.fn, about = excluded.about;

-- ---- перенос, отмена, возврат одного урока (журнал п.42) ----------------------------------
-- Сообщает ученикам урока, чем он стал для них. «Было» — то, что ученик знает:
-- время и статус до изменения. Если о прошлом изменении этого урока ему ещё не
-- отправили и он его не открыл, «было» — то, что до того: прошлое сообщение
-- заменяется одним новым, а если всё вернулось как было («Отменить» →
-- «Вернуть», перенос туда и обратно) — исчезает. Исправление уже прошедшего
-- урока — не новость для ученика.
create or replace function public.notify_lesson_change(
  p_teacher uuid, p_lesson uuid, p_version int, p_was_status text, p_was_at timestamptz
)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  l record;
  r record;
  o record;
  v_was_status text;
  v_was_at timestamptz;
  v_kind text;
  v_data jsonb;
  n int := 0;
begin
  select x.id, x.status, x.starts_at, coalesce(x.title, s.title) as title
    into l
    from lessons x left join lesson_series s on s.id = x.series_id
   where x.id = p_lesson;
  if not found then return 0; end if;

  for r in select * from public.lesson_app_students(p_lesson) loop
    v_was_status := p_was_status;
    v_was_at := p_was_at;
    select id, kind, data into o from notifications
     where user_id = r.user_id and sent_at is null and read_at is null
       and kind in ('lesson_moved', 'lesson_cancelled', 'lesson_restored')
       and data->>'lesson' = p_lesson::text
     order by created_at
     limit 1;
    if found then
      v_was_status := case o.kind when 'lesson_restored' then 'cancelled' else 'planned' end;
      v_was_at := (case o.kind when 'lesson_moved' then o.data->>'from' else o.data->>'at' end)::timestamptz;
      delete from notifications where id = o.id;
    end if;

    continue when greatest(v_was_at, l.starts_at) <= now();
    v_kind := case
      when v_was_status <> 'cancelled' and l.status = 'cancelled' then 'lesson_cancelled'
      when v_was_status = 'cancelled' and l.status <> 'cancelled' then 'lesson_restored'
      when l.status <> 'cancelled' and v_was_at is distinct from l.starts_at then 'lesson_moved'
    end;
    continue when v_kind is null;

    v_data := jsonb_build_object('lesson', p_lesson, 'teacher_name', public.teacher_public_name(p_teacher),
                                 'title', l.title, 'href', '/lessons?lesson=' || p_lesson)
           || case v_kind
                when 'lesson_moved' then jsonb_build_object('from', v_was_at, 'to', l.starts_at)
                when 'lesson_cancelled' then jsonb_build_object('at', v_was_at)
                else jsonb_build_object('at', l.starts_at)
              end;
    if public.notify(r.user_id, v_kind, v_data, 'lesson:' || p_lesson || ':v' || p_version) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $fn$;

-- Неотправленные и непрочитанные сообщения об уроках серии, которых больше нет
-- или которые отменены вместе с серией: их перекрывает одно сообщение о серии.
create or replace function public.drop_stale_lesson_notices(p_user uuid, p_series uuid)
returns void language sql volatile security definer set search_path = public as $fn$
  delete from notifications n
   where n.user_id = p_user and n.sent_at is null and n.read_at is null
     and n.kind in ('lesson_moved', 'lesson_cancelled', 'lesson_restored')
     and not exists (
       select 1 from lessons l
        where l.id::text = n.data->>'lesson'
          and not (l.series_id is not distinct from p_series and l.status = 'cancelled')
     )
$fn$;

-- ---- серия: новое расписание и отмена — одно сообщение (журнал п.42) -----------------------
-- «Этот и все следующие» (update_series_from). Старая серия к этому моменту
-- кончается накануне — или удалена, если делили с первого урока: тогда
-- прежнее расписание неизвестно и сообщение описывает новое целиком.
-- Ученику, чьё время, дни и длительность не изменились (сменили ссылку или
-- название), — ничего; убранному из серии — «уроки отменены». Добавленному —
-- ничего: это новые уроки, а не изменение договорённости (как и create_series).
create or replace function public.notify_series_change(p_teacher uuid, p_old uuid, p_new uuid, p_since date)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  s record;
  o record;
  r record;
  v_has_old boolean;
  v_same boolean;
  n int := 0;
begin
  select * into s from lesson_series where id = p_new;
  if not found then return 0; end if;
  select * into o from lesson_series where id = p_old;
  v_has_old := found;
  v_same := v_has_old and (o.weekdays, o.start_time, o.minutes, o.every_weeks)
                       = (s.weekdays, s.start_time, s.minutes, s.every_weeks);

  if not v_same then
    for r in select * from public.series_app_students(p_new) loop
      perform public.drop_stale_lesson_notices(r.user_id, p_old);
      if public.notify(
        r.user_id, 'lessons_rescheduled',
        jsonb_build_object(
          'series', p_new, 'since', p_since, 'weekdays', s.weekdays,
          'time', to_char(s.start_time, 'HH24:MI'), 'minutes', s.minutes,
          'every_weeks', s.every_weeks, 'until', s.ends_on,
          'old', case when v_has_old then jsonb_build_object(
                   'weekdays', o.weekdays, 'time', to_char(o.start_time, 'HH24:MI'),
                   'minutes', o.minutes, 'every_weeks', o.every_weeks) end,
          'teacher_name', public.teacher_public_name(p_teacher), 'title', s.title, 'href', '/lessons'),
        'series:' || p_new
      ) then
        n := n + 1;
      end if;
    end loop;
  end if;

  if v_has_old then
    for r in
      select x.* from public.series_app_students(p_old) x
       where x.user_id not in (select y.user_id from public.series_app_students(p_new) y)
    loop
      perform public.drop_stale_lesson_notices(r.user_id, p_old);
      if public.notify(
        r.user_id, 'lessons_cancelled',
        jsonb_build_object('series', p_old, 'since', p_since, 'weekdays', o.weekdays,
                           'teacher_name', public.teacher_public_name(p_teacher), 'title', o.title, 'href', '/lessons'),
        'series-cancel:' || p_old || ':' || p_since
      ) then
        n := n + 1;
      end if;
    end loop;
  end if;
  return n;
end $fn$;

-- Отмена серии с урока (cancel_series_from): одно сообщение на всю серию.
create or replace function public.notify_series_cancel(p_teacher uuid, p_series uuid, p_since date)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  s record;
  r record;
  n int := 0;
begin
  select * into s from lesson_series where id = p_series;
  if not found then return 0; end if;
  for r in select * from public.series_app_students(p_series) loop
    perform public.drop_stale_lesson_notices(r.user_id, p_series);
    if public.notify(
      r.user_id, 'lessons_cancelled',
      jsonb_build_object('series', p_series, 'since', p_since, 'weekdays', s.weekdays,
                         'teacher_name', public.teacher_public_name(p_teacher), 'title', s.title, 'href', '/lessons'),
      'series-cancel:' || p_series || ':' || p_since
    ) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $fn$;

-- ---- крючок 0009: один вызов на действие учителя ---------------------------------------------
-- Сбой уведомлений не должен мешать учителю перенести урок — и не должен
-- теряться молча: ошибка пишется туда же, где ошибки с прода (/admin,
-- admin_recent_errors), а действие учителя проходит.
create or replace function public.after_lessons_changed(p_teacher uuid, p_change jsonb)
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_kind text := p_change->>'kind';
begin
  begin
    case v_kind
      when 'lesson_updated' then
        perform public.notify_lesson_change(p_teacher, (p_change->>'lesson')::uuid, (p_change->>'version')::int,
                                            'planned', (p_change->>'from')::timestamptz);
      when 'lesson_cancelled' then
        perform public.notify_lesson_change(p_teacher, (p_change->>'lesson')::uuid, (p_change->>'version')::int,
                                            'planned', (p_change->>'at')::timestamptz);
      when 'lesson_restored' then
        perform public.notify_lesson_change(p_teacher, (p_change->>'lesson')::uuid, (p_change->>'version')::int,
                                            'cancelled', (p_change->>'at')::timestamptz);
      when 'series_changed' then
        perform public.notify_series_change(p_teacher, (p_change->>'series')::uuid,
                                            (p_change->>'new_series')::uuid, (p_change->>'since')::date);
      when 'series_cancelled' then
        perform public.notify_series_cancel(p_teacher, (p_change->>'series')::uuid, (p_change->>'since')::date);
      else
        null;
    end case;
  exception when others then
    insert into events (user_id, name, props)
    values (p_teacher, 'client_error', jsonb_build_object(
      'where', 'база · уведомления об уроках',
      'message', left(sqlerrm, 300),
      'path', 'after_lessons_changed:' || coalesce(v_kind, '?')));
  end;
end $fn$;

-- ---- доставка: push в теле запроса, повтор при сбое ----------------------------------------
-- Какие виды идут в push. Копия — PUSH_KINDS (domains/notifications/model.ts),
-- пару сверяет test-notifications.mjs.
create or replace function public.push_kinds()
returns text[] language sql immutable set search_path = public as $fn$
  select array['lesson_soon', 'lesson_moved', 'lesson_cancelled', 'lesson_restored',
               'lessons_rescheduled', 'lessons_cancelled']
$fn$;

alter table public.notifications add column attempts smallint not null default 0;

-- Отправки, ответ на которые ещё не разобран (pg_net отвечает асинхронно).
create table public.notification_dispatches (
  request_id bigint primary key,
  ids uuid[] not null,
  created_at timestamptz not null default now()
);
alter table public.notification_dispatches enable row level security;
revoke all on public.notification_dispatches from anon, authenticated;

-- Ответы сервера доставки на прошлые отправки. 200 — в теле gone (подписки,
-- которых больше нет: удалить) и retry (не дошло по сбою службы push); не 200,
-- таймаут или ответа нет 15 минут — вся отправка не дошла. Не дошедшее
-- возвращается в очередь, всего не больше 3 попыток.
create or replace function public.settle_dispatches()
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  d record;
  v jsonb;
  v_retry uuid[];
  n int := 0;
begin
  for d in
    select nd.request_id, nd.ids, nd.created_at, r.id is not null as answered, r.status_code, r.content
      from notification_dispatches nd
      left join net._http_response r on r.id = nd.request_id
     order by nd.created_at
     for update of nd skip locked
  loop
    v_retry := d.ids;
    if not d.answered then
      continue when d.created_at > now() - interval '15 minutes';
    elsif d.status_code = 200 then
      begin
        v := d.content::jsonb;
      exception when others then
        v := null;
      end;
      if jsonb_typeof(v) = 'object' then
        if jsonb_typeof(v->'gone') = 'array' then
          delete from push_subscriptions
           where endpoint in (select jsonb_array_elements_text(v->'gone'));
        end if;
        v_retry := '{}';
        if jsonb_typeof(v->'retry') = 'array' then
          -- case, а не and: порядок условий в where Postgres не обещает,
          -- и приведение мусора к uuid уронило бы весь разбор
          select coalesce(array_agg(x::uuid), '{}') into v_retry
            from jsonb_array_elements_text(v->'retry') x
           where case when x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then x::uuid = any (d.ids) else false end;
        end if;
      end if;
    end if;
    update notifications set sent_at = null where id = any (v_retry) and attempts < 3;
    delete from notification_dispatches where request_id = d.request_id;
    n := n + 1;
  end loop;
  return n;
end $fn$;

-- Тело запроса к серверу доставки: уведомления и, для видов push_kinds,
-- подписки человека (сервер в базу не ходит — всё нужное здесь). Отдельной
-- функцией — чтобы проверка видела, что уходит, без гонки с pg_net.
create or replace function public.dispatch_payload(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object('notifications', coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'user_id', n.user_id, 'kind', n.kind, 'data', n.data, 'created_at', n.created_at,
           'push', case when n.kind = any (public.push_kinds()) then coalesce((
                     select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)
                                      order by ps.seen_at desc)
                       from push_subscriptions ps where ps.user_id = n.user_id), '[]'::jsonb)
                   else '[]'::jsonb end)
         order by n.created_at), '[]'::jsonb))
    from notifications n
   where n.id = any (p_ids)
$fn$;

-- Новые уведомления → сервер доставки. Тело — из 0002; добавлено: разбор
-- прошлых ответов, подписки push для видов push_kinds, учёт попыток, минута
-- на «Вернуть» для сообщений об изменениях, срок ответа 25 с.
create or replace function public.dispatch_notifications()
returns int language plpgsql security definer set search_path = public as $fn$
declare
  v_url text;
  v_secret text;
  v_ids uuid[];
  v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  -- доставка не настроена — спим: лента работает и без неё
  if v_url is null or v_secret is null then return 0; end if;

  perform public.settle_dispatches();

  -- за раз — до 100; старше суток не доставляем: «урок через час» вчерашний
  -- уже не нужен, а лента его всё равно покажет
  select array_agg(x.id order by x.created_at) into v_ids
    from (select id, created_at from notifications
           where sent_at is null and created_at > now() - interval '1 day'
             and (kind not in ('lesson_moved', 'lesson_cancelled', 'lesson_restored',
                               'lessons_rescheduled', 'lessons_cancelled')
                  or created_at <= now() - interval '1 minute')
           order by created_at
           limit 100
           for update skip locked) x;
  if v_ids is null then return 0; end if;

  v_req := net.http_post(
    url := v_url,
    body := public.dispatch_payload(v_ids),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 25000
  );
  insert into notification_dispatches (request_id, ids) values (v_req, v_ids);
  update notifications set sent_at = now(), attempts = attempts + 1 where id = any (v_ids);
  return array_length(v_ids, 1);
end $fn$;

-- ---- права: служебное — закрыто и от вошедших -------------------------------------------
revoke execute on function public.lesson_app_students(uuid) from authenticated;
revoke execute on function public.series_app_students(uuid) from authenticated;
revoke execute on function public.teacher_public_name(uuid) from authenticated;
revoke execute on function public.notify_lessons_soon(timestamptz) from authenticated;
revoke execute on function public.rule_lessons_soon() from authenticated;
revoke execute on function public.notify_lesson_change(uuid, uuid, int, text, timestamptz) from authenticated;
revoke execute on function public.drop_stale_lesson_notices(uuid, uuid) from authenticated;
revoke execute on function public.notify_series_change(uuid, uuid, uuid, date) from authenticated;
revoke execute on function public.notify_series_cancel(uuid, uuid, date) from authenticated;
revoke execute on function public.after_lessons_changed(uuid, jsonb) from authenticated;
revoke execute on function public.settle_dispatches() from authenticated;
revoke execute on function public.dispatch_payload(uuid[]) from authenticated;
revoke execute on function public.dispatch_notifications() from authenticated;

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
