-- ============================================================================
-- 0001 — новые функции закрыты для анонима с рождения (PLAN.md Ф1.2)
-- ============================================================================
-- Класс ошибки, случившийся дважды (CLAUDE.md, раздел «Безопасность»): новая
-- функция получает EXECUTE для PUBLIC (встроенное право Postgres) и anon
-- (права по умолчанию Supabase) — и открыта анониму, пока её не накроет
-- revoke. Так жили choose_homework_item (одно окно между заливками) и
-- submit_word_check (drop + create на каждой заливке — открыта всегда).
--
-- Лечим в корне: права по умолчанию для функций, которые создаёт postgres.
-- Проверено на тестовой базе 27.09.2026: новая функция и пересозданная через
-- drop + create закрыты для anon и PUBLIC, открыты для authenticated.
--
-- ⚠️ PUBLIC получает право ГЛОБАЛЬНО, поэтому и отзывается глобально, без
-- «in schema»: в пределах схемы Postgres глобальное право не отзывает.
-- anon Supabase раздаёт в схеме public — там же и отзываем.
--
-- Блок-страховка в конце остаётся вторым поясом: она обязана заканчивать
-- КАЖДУЮ миграцию (сторожит scripts/test-migrations.mjs).
-- ============================================================================
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

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

