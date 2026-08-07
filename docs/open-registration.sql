-- ============================================================================
-- ОТКРЫТАЯ РЕГИСТРАЦИЯ — ВЫНЕСЕНО ИЗ schema.sql НАМЕРЕННО.
-- Пока этот файл НЕ выполнен, зарегистрироваться могут только адреса из
-- allowed_emails (закрытый тест). Выполнять в день публичного запуска.
--
-- ПЕРЕД ВЫПОЛНЕНИЕМ ПРОВЕРИТЬ (иначе открываем дыру, а не продукт):
--   1) Подтверждение почты включено в Supabase Auth. Проверять не глазами:
--        curl "$SUPABASE_URL/auth/v1/settings" -H "apikey: $ANON_KEY"
--      В ответе должно быть "mailer_autoconfirm": false.
--      Без него аккаунт заводится без доступа к почте, и триал фармится
--      скриптом.
--   2) docs/schema.sql залит целиком и свежий (в нём живут квоты, энергия и
--      места). Проверка: node scripts/validate-schema-dryrun.mjs
--
-- ЧТО ПОЛУЧИТ КАЖДЫЙ НОВЫЙ АККАУНТ (посчитано по коду на 2026-08-06):
--   • триал 14 дней — это дефолт колонки profiles.trial_until;
--   • на триале 30 ⚡ в день (energy_source: сольный premium/триал → 30),
--     то есть до 420 «тяжёлых» действий за две недели;
--   • переводы слов 300/сутки, распознавание речи 150/сутки.
-- Если это слишком щедро для открытого мира — резать надо ДО открытия, в
-- schema.sql (energy_source и кэпы light/speech), а не после.
--
-- Откат: чтобы снова закрыть регистрацию, перезалей docs/schema.sql — там
-- лежит версия handle_new_user с проверкой белого списка, и она перекроет эту.
-- ============================================================================

-- Тело функции — точная копия версии из schema.sql БЕЗ проверки allowed_emails.
-- Всё остальное сохранено дословно: профиль и две стартовые колоды.
-- ⚠️ Если правишь handle_new_user в schema.sql — синхронизируй и здесь, иначе
-- открытие регистрации молча откатит свежие изменения.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.decks (owner_id, title, description, lang)
  values
    (new.id, 'Мои слова',    'Английские слова из чтения и добавленные вручную', 'en'),
    (new.id, 'Mis palabras', 'Испанские слова из паков, чтения и добавленные вручную', 'es');

  return new;
end;
$$;

-- Таблица allowed_emails и обзор access_overview НЕ удаляются: это история
-- закрытого теста и заготовка под будущий блок-лист. Просто перестают влиять
-- на регистрацию.

-- Проверка сразу после выполнения (должно вернуть 'открыта'):
--   select case when prosrc like '%RECALL_NOT_INVITED%' then 'закрыта' else 'открыта' end
--     from pg_proc where proname = 'handle_new_user';
