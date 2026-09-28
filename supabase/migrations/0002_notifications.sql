-- 0002 — ядро уведомлений (PLAN.md Ф1.5; архитектура §17; журнал п.23, 29,
-- 36, 38, 42)
-- ============================================================================
-- Один модуль на все «напомнить»: «остался 1 урок», «тариф кончается»,
-- «урок через час», «урок перенесён». Правила — функции базы (придут в Ф2),
-- здесь — всё, на чём они стоят:
--
--   notifications        лента человека. ОДНО уведомление на ключ:
--                        unique (user_id, dedupe_key) — «одно на цикл» держит
--                        база, а не аккуратность правила
--   notification_prefs   настройки человека (пока одна — напоминать о скором
--                        уроке, журнал п.38)
--   notification_rules   реестр правил: какие функции будит будильник; правило
--                        выключается строкой, без выкатки
--   notify()             единственный способ создать уведомление
--   run_notification_rules()   будильник: все включённые правила, затем отправка
--   dispatch_notifications()   новые уведомления → сервер доставки (pg_net)
--   mark_notifications_read()  «прочитано» — только свои
--   pg_cron              будильник раз в 5 минут
--
-- ⚠️ notify, run_notification_rules и dispatch_notifications закрыты и от
-- authenticated: права по умолчанию (0001) открывают вошедшим каждую новую
-- функцию, а через notify любой вошедший писал бы уведомления кому угодно.
--
-- Доставка — осознанное исключение из «сервер ходит в базу под токеном
-- пользователя» (архитектура §17): здесь база сама будит сервер доставки.
-- Адрес и секрет — в Vault (notify_url, notify_secret), в git их нет. Пока их
-- нет, доставка спит: лента работает, каналы (push — Ф2.9, Telegram — Ф4.3)
-- не зовутся.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---- лента --------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- вид: по нему клиент и сервер доставки собирают текст (domains/notifications)
  kind text not null check (kind ~ '^[a-z][a-z0-9_]*$'),
  data jsonb not null default '{}'::jsonb,
  -- ключ цикла: «карточка + последняя оплата», «пользователь + дата
  -- окончания»… Второе уведомление с тем же ключом не создаётся
  dedupe_key text not null check (length(dedupe_key) between 1 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- отдано серверу доставки (pg_net); лента от этого не зависит
  sent_at timestamptz,
  constraint notifications_one_per_key unique (user_id, dedupe_key)
);
create index notifications_user_created on public.notifications (user_id, created_at desc);
create index notifications_unsent on public.notifications (created_at) where sent_at is null;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
-- писать напрямую не может никто: создаёт notify(), «прочитано» — RPC
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- ---- настройки ----------------------------------------------------------------
create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- напоминание о скором уроке выключается; перенос и отмена — нет (п.38, 42)
  lesson_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy notification_prefs_select_own on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());
create policy notification_prefs_insert_own on public.notification_prefs
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_prefs_update_own on public.notification_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant insert (user_id, lesson_reminders) on public.notification_prefs to authenticated;
grant update (lesson_reminders, updated_at) on public.notification_prefs to authenticated;

-- ---- реестр правил --------------------------------------------------------------
-- Правило — функция без аргументов, возвращает, сколько уведомлений создала
-- (через notify). Новое правило = функция + строка здесь в той же миграции.
create table public.notification_rules (
  name text primary key check (name ~ '^[a-z][a-z0-9_]*$'),
  fn text not null,
  enabled boolean not null default true,
  about text not null,
  last_run_at timestamptz,
  last_created int,
  last_error text
);
alter table public.notification_rules enable row level security;
revoke all on public.notification_rules from anon, authenticated;

-- ---- создать уведомление ----------------------------------------------------------
create or replace function public.notify(p_user_id uuid, p_kind text, p_data jsonb, p_dedupe_key text)
returns boolean language plpgsql security definer set search_path = public as $fn$
begin
  insert into notifications (user_id, kind, data, dedupe_key)
  values (p_user_id, p_kind, coalesce(p_data, '{}'::jsonb), p_dedupe_key)
  on conflict (user_id, dedupe_key) do nothing;
  -- true — создано; false — с этим ключом уже было (повтор цикла)
  return found;
end $fn$;
revoke execute on function public.notify(uuid, text, jsonb, text) from authenticated;

-- ---- отдать новые уведомления серверу доставки ------------------------------------
create or replace function public.dispatch_notifications()
returns int language plpgsql security definer set search_path = public as $fn$
declare
  v_url text;
  v_secret text;
  v_ids uuid[];
  v_items jsonb;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  -- доставка не настроена — спим: лента работает и без неё
  if v_url is null or v_secret is null then return 0; end if;

  -- за раз — до 100; старше суток не доставляем: «урок через час» вчерашний
  -- уже не нужен, а лента его всё равно покажет
  select array_agg(s.id),
         jsonb_agg(jsonb_build_object('id', s.id, 'user_id', s.user_id, 'kind', s.kind,
                                      'data', s.data, 'created_at', s.created_at) order by s.created_at)
    into v_ids, v_items
    from (select * from notifications
           where sent_at is null and created_at > now() - interval '1 day'
           order by created_at limit 100
           for update skip locked) s;
  if v_ids is null then return 0; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notifications', v_items),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );
  update notifications set sent_at = now() where id = any (v_ids);
  return array_length(v_ids, 1);
end $fn$;
revoke execute on function public.dispatch_notifications() from authenticated;

-- ---- будильник: все включённые правила, затем отправка ----------------------------
create or replace function public.run_notification_rules()
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  n int;
  report jsonb := '{}'::jsonb;
begin
  for r in select * from notification_rules where enabled order by name loop
    -- правило — в своей подтранзакции: упавшее откатывает только свои строки
    -- и не мешает остальным
    begin
      execute format('select %s()', r.fn::regproc) into n;
      update notification_rules
         set last_run_at = now(), last_created = coalesce(n, 0), last_error = null
       where name = r.name;
      report := report || jsonb_build_object(r.name, coalesce(n, 0));
    exception when others then
      update notification_rules set last_run_at = now(), last_error = sqlerrm where name = r.name;
      report := report || jsonb_build_object(r.name, 'error: ' || sqlerrm);
    end;
  end loop;
  return report || jsonb_build_object('_sent', dispatch_notifications());
end $fn$;
revoke execute on function public.run_notification_rules() from authenticated;

-- ---- «прочитано» ------------------------------------------------------------------
-- p_ids = null — всё своё непрочитанное
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $fn$
declare n int;
begin
  if auth.uid() is null then raise exception 'RECALL_NO_AUTH'; end if;
  update notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $fn$;

-- ---- будильник: раз в 5 минут ---------------------------------------------------------
-- 5 минут хватает самому точному правилу — «урок через час» (журнал п.38).
-- Повторный schedule с тем же именем задачу обновляет, а не дублирует.
select cron.schedule('recall-notifications', '*/5 * * * *', $cron$select public.run_notification_rules()$cron$);

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
