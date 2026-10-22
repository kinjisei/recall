-- ============================================================================
-- 0016 — раздел «Данные» в Настройках (PLAN.md Ф2.17-4г-2б, журнал п.76 (12);
-- макеты d14, u4): «Выгрузить мои данные» и «Удалить аккаунт».
--
-- export_my_data() — всё «своё» одним jsonb: профиль и строки каждой таблицы,
-- где человек — владелец (ученик — слова, повторения, занятия, диалоги,
-- домашка, программа…; репетитор — ещё и студия: карточки учеников, уроки,
-- серии, журнал оплат уроков, материалы, задания). Чужие строки, которые
-- человеку видны по RLS (учителю — занятия учеников), сюда не попадают:
-- отбор строго по его id. Функцией, а не чтением таблиц из браузера: студия,
-- оплаты и приглашения напрямую не читаются (только через RPC). Не входят
-- технические журналы (ai_calls, events, ошибки) и ключи push-устройств.
--
-- «Удалить аккаунт» — решение владельца 22.10.2026: сразу, после ввода
-- пароля; репетитора с учениками — предупредить и удалить.
--
-- delete_my_account() удаляет строку auth.users вызывающего — дальше работает
-- каскад, который схема держит с самого начала: профиль, слова, повторения,
-- занятия, диалоги, домашка, студия репетитора (карточки, уроки, серии,
-- материалы) уходят вместе с ним. Остаются без владельца: оплаты (учёт
-- выручки, payments.user_id → null), карточка ученика у репетитора (имя,
-- контакт, уроки и остаток — данные репетитора, student_cards.user_id → null),
-- приглашение коллеги (счётчик пригласившего не тает), события аналитики.
--
-- Пароль проверяет вход: клиент входит паролем заново, и вход создаёт новую
-- сессию. Функция требует, чтобы сессия, из которой её зовут, была моложе
-- 10 минут: чужой открытый ноутбук или украденный токен (обновление токена
-- сессию не пересоздаёт) аккаунт не удалят. Аккаунт владельца (is_admin)
-- так не удаляется — только в панели Supabase: случайное нажатие не должно
-- оставить продукт без админки.
-- ============================================================================

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from profiles p where p.id = uid),
    -- учёба
    'activity_log', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day), '[]') from activity_log x where x.user_id = uid),
    'decks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from decks x where x.owner_id = uid),
    'cards', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from cards x where x.deck_id in (select id from decks where owner_id = uid)),
    'review_states', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from review_states x where x.user_id = uid),
    'deck_assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from deck_assignments x where x.student_id = uid),
    'conversations', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from conversations x where x.user_id = uid),
    'messages', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from messages x
                  where x.conversation_id in (select id from conversations where user_id = uid)),
    'grammar_mistakes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from grammar_mistakes x where x.user_id = uid),
    'writing_submissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from writing_submissions x where x.user_id = uid),
    'writing_task_assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from writing_task_assignments x where x.student_id = uid),
    'material_assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from material_assignments x where x.student_id = uid),
    'material_replans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from material_replans x where x.user_id = uid),
    'placement_requests', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from placement_requests x where uid in (x.student_id, x.teacher_id)),
    -- от преподавателя и для учеников: у ученика — что получил, у репетитора — что выдал
    'grammar_quests', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from grammar_quests x where uid in (x.student_id, x.teacher_id)),
    'homework', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from homework x where uid in (x.student_id, x.teacher_id)),
    'homework_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from homework_items x
                        where x.homework_id in (select id from homework where uid in (student_id, teacher_id))),
    'study_plans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from study_plans x where uid in (x.student_id, x.teacher_id)),
    'study_plan_marks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from study_plan_marks x
                          where x.plan_id in (select id from study_plans where uid in (student_id, teacher_id))),
    'word_checks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from word_checks x where uid in (x.student_id, x.teacher_id)),
    'teacher_students', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from teacher_students x where uid in (x.student_id, x.teacher_id)),
    -- студия репетитора
    'student_cards', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from student_cards x where x.teacher_id = uid),
    'lessons', (select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at), '[]') from lessons x where x.teacher_id = uid),
    'lesson_participants', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from lesson_participants x where x.teacher_id = uid),
    'lesson_series', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from lesson_series x where x.teacher_id = uid),
    'series_participants', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from series_participants x where x.teacher_id = uid),
    'paid_lessons', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from paid_lessons x where x.teacher_id = uid),
    'schedule_settings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from schedule_settings x where x.teacher_id = uid),
    'materials', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from materials x where x.teacher_id = uid),
    'writing_tasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from writing_tasks x where x.teacher_id = uid),
    'teacher_signups', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from teacher_signups x where x.user_id = uid),
    -- оплаты и приглашения: кого пригласил — без id чужого аккаунта
    'payments', (select coalesce(jsonb_agg(to_jsonb(x) - 'confirmed_by' order by x.confirmed_at), '[]') from payments x where x.user_id = uid),
    'payment_claims', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from payment_claims x where x.user_id = uid),
    'personal_codes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from personal_codes x where x.user_id = uid),
    'referrals', (select coalesce(jsonb_agg(to_jsonb(x) - 'referee_id'), '[]') from referrals x where x.referrer_id = uid),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from notifications x where x.user_id = uid),
    'notification_prefs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from notification_prefs x where x.user_id = uid)
  );
end $fn$;

grant execute on function public.export_my_data() to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then raise exception 'RECALL_NO_AUTH'; end if;

  -- пароль введён только что: сессия этого запроса создана входом < 10 мин назад
  begin
    sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when others then
    sid := null;
  end;
  if sid is null or not exists (
    select 1 from auth.sessions s
     where s.id = sid and s.user_id = uid and s.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'RECALL_REAUTH_NEEDED';
  end if;

  if exists (select 1 from profiles where id = uid and is_admin) then
    raise exception 'RECALL_ADMIN_KEEP';
  end if;

  -- чей дневной пул энергии тратили ученики — id без ссылки, каскад его не видит
  update ai_calls set pool_owner = null where pool_owner = uid;

  delete from auth.users where id = uid;
end $fn$;

grant execute on function public.delete_my_account() to authenticated;

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
