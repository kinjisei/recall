/**
 * Слепок каталога базы: одна строка на объект, «вид | имя | подробности»,
 * отсортировано — расхождение двух баз читается глазами (PLAN.md Ф1.2).
 *
 * Общий для всех сверок «база = база»: тестовая против живой, версия схемы
 * против версии. Чем полнее слепок, тем меньше пропускает сверка, поэтому
 * здесь всё, от чего зависит поведение и доступ:
 *   функции (исходник, security definer, search_path, владелец) и их права;
 *   таблицы, представления, последовательности, RLS и права на них;
 *   колонки (тип, not null, умолчание) и КОЛОНОЧНЫЕ права;
 *   ограничения (check, внешние ключи, unique), индексы, политики, триггеры
 *   (включая триггер на auth.users), типы, расширения, права по умолчанию.
 *
 * ⚠️ Только pg_catalog, НЕ information_schema. information_schema показывает
 * лишь то, что видит текущая роль: живая база читается ролью «только чтение»,
 * и гранты чужих ролей там просто пропали бы — сверка нашла бы ложные
 * расхождения или, хуже, не нашла бы настоящих. Отсутствующий acl (NULL)
 * раскрываем через acldefault — это и есть «права по умолчанию», которые
 * однажды оставили функцию открытой анониму.
 *
 * ⚠️ Колоночные права (attacl) обязательны: секреты profiles закрыты именно
 * ими (CLAUDE.md, «RLS не прячет колонки»). Прежний слепок check-schema-equal
 * их не снимал — потерянный грант на колонку прошёл бы сверку.
 *
 * ⚠️ Исходник функции сравниваем БЕЗ \r. Postgres хранит его как прислали:
 * на проде 75 из 82 функций вставлены из Windows (CRLF), а та же миграция,
 * записанная с LF, дала бы «другой» исходник — 75 ложных расхождений.
 * Безопасно это потому, что \r нет ни в одной строковой константе: проверено
 * лексером по всем 82 функциям прода 27.09.2026 (вне констант \r — пробел).
 * Появится многострочная константа — это правило придётся пересмотреть.
 */

const who = (oid) => `case when ${oid} = 0 then 'PUBLIC' else pg_get_userbyid(${oid}) end`

export const CATALOG_SNAPSHOT = `
with rel as (
  select c.oid, c.relname, c.relkind, c.relowner, c.relacl,
         c.relrowsecurity, c.relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
), fn as (
  select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args,
         p.proowner, p.proacl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
)
select line from (
  select format('FUNC | %s(%s) | returns=%s | lang=%s | definer=%s | vol=%s | cfg=%s | owner=%s | src=%s',
                f.proname, f.args, pg_get_function_result(f.oid), l.lanname, p.prosecdef,
                p.provolatile, coalesce(array_to_string(p.proconfig, ','), '-'),
                pg_get_userbyid(f.proowner), md5(replace(p.prosrc, E'\\r', ''))) as line
    from fn f join pg_proc p on p.oid = f.oid join pg_language l on l.oid = p.prolang
  union all
  select format('FUNC-ACL | %s(%s) | %s | %s', f.proname, f.args, ${who('a.grantee')}, a.privilege_type)
    from fn f, aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
  union all
  select format('REL | %s | kind=%s | owner=%s | rls=%s | force=%s',
                r.relname, r.relkind, pg_get_userbyid(r.relowner),
                r.relrowsecurity, r.relforcerowsecurity)
    from rel r
  union all
  select format('REL-ACL | %s | %s | %s', r.relname, ${who('a.grantee')}, a.privilege_type)
    from rel r,
         aclexplode(coalesce(r.relacl,
           acldefault(case when r.relkind = 'S' then 's' else 'r' end::"char", r.relowner))) a
  union all
  select format('COL | %s.%s | %s | notnull=%s | def=%s | gen=%s | identity=%s',
                r.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull,
                coalesce(pg_get_expr(d.adbin, d.adrelid), '-'), a.attgenerated, a.attidentity)
    from rel r
    join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where r.relkind in ('r', 'p', 'v', 'm', 'f')
  union all
  select format('COL-ACL | %s.%s | %s | %s', r.relname, a.attname, ${who('x.grantee')}, x.privilege_type)
    from rel r
    join pg_attribute a on a.attrelid = r.oid and a.attnum > 0
                       and not a.attisdropped and a.attacl is not null,
         aclexplode(a.attacl) x
  union all
  select format('CONSTRAINT | %s | %s | %s', r.relname, co.conname, pg_get_constraintdef(co.oid))
    from rel r join pg_constraint co on co.conrelid = r.oid
  union all
  select format('INDEX | %s', pg_get_indexdef(i.indexrelid))
    from pg_index i join rel r on r.oid = i.indrelid
  union all
  select format('POLICY | %s | %s | cmd=%s | permissive=%s | roles=%s | using=%s | check=%s',
                r.relname, po.polname, po.polcmd, po.polpermissive,
                (select string_agg(q.n, ',' order by q.n)
                   from (select ${who('x')} as n from unnest(po.polroles) x) q),
                md5(coalesce(pg_get_expr(po.polqual, po.polrelid), '-')),
                md5(coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '-')))
    from pg_policy po join rel r on r.oid = po.polrelid
  union all
  -- триггеры, которые зовут НАШИ функции, — включая триггер на auth.users
  select format('TRIGGER | %s', pg_get_triggerdef(t.oid))
    from pg_trigger t join fn f on f.oid = t.tgfoid
   where not t.tgisinternal
  union all
  -- событийные триггеры на наших функциях: на проде так живёт ensure_rls
  -- (сам включает RLS на каждой новой таблице public)
  select format('EVENT-TRIGGER | %s | on=%s | tags=%s | enabled=%s | owner=%s | fn=%s',
                e.evtname, e.evtevent, coalesce(array_to_string(e.evttags, ','), '-'),
                e.evtenabled, pg_get_userbyid(e.evtowner), f.proname)
    from pg_event_trigger e join fn f on f.oid = e.evtfoid
  union all
  select format('VIEW | %s | %s', r.relname, md5(pg_get_viewdef(r.oid)))
    from rel r where r.relkind in ('v', 'm')
  union all
  select format('TYPE | %s | %s', t.typname,
                coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder)
                            from pg_enum e where e.enumtypid = t.oid), t.typtype::text))
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typtype in ('e', 'c', 'd')
     and not exists (select 1 from pg_class c where c.reltype = t.oid)
  union all
  select format('EXT | %s | %s', e.extname, e.extnamespace::regnamespace) from pg_extension e
  union all
  -- права по умолчанию только НАШЕЙ роли: служебные (supabase_admin…) платформа
  -- настраивает сама, и у проектов разного возраста они разные
  select format('DEFACL | %s | %s | %s | %s', pg_get_userbyid(d.defaclrole),
                case when d.defaclnamespace = 0 then '(global)' else d.defaclnamespace::regnamespace::text end,
                d.defaclobjtype, d.defaclacl::text)
    from pg_default_acl d where d.defaclrole = 'postgres'::regrole
) s order by line
`

/** Расхождение двух слепков: что есть только в первом и только во втором. */
export function diffSnapshots(a, b) {
  const inA = new Set(a)
  const inB = new Set(b)
  return { onlyA: a.filter((l) => !inB.has(l)), onlyB: b.filter((l) => !inA.has(l)) }
}
