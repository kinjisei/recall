// Сборка учебника «Строитель А+Б»: markdown-главы + глоссарий + оболочка →
//   build/index.html  — для публикации артефактом (без <!doctype>-обвязки)
//   build/local.html  — то же, открывается с компа двойным кликом
// Запуск: node docs/textbook/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------- оглавление (источник правды для оболочки; статусы — в PLAN.md) ----------
const PARTS = {
  I: 'До стройки',
  II: 'Стройка',
  III: 'Сдача и эксплуатация',
  IV: 'Дом продаётся',
  V: 'Инструмент',
};
const CHAPTERS = [
  { n: '1',  id: '01',  part: 'I',   title: 'Насмотренность: где брать вкус и идеи', file: '01-nasmotrennost.md' },
  { n: '2',  id: '02',  part: 'I',   title: 'Идея и проверка спроса', file: '02-idea-i-spros.md' },
  { n: '3',  id: '03',  part: 'I',   title: 'Планировка: требования, сценарии, MVP', file: '03-planirovka.md' },
  { n: '4',  id: '04',  part: 'II',  title: 'Фундамент: стек, структура, типы', file: '04-fundament.md' },
  { n: '5',  id: '05',  part: 'II',  title: 'Код: почему «работает» ещё не значит «хорошо»', file: '05-kod.md' },
  { n: '6',  id: '06',  part: 'II',  title: 'Безопасность: двери и замки', file: '06-bezopasnost.md' },
  { n: '7',  id: '07',  part: 'II',  title: 'Данные и база', file: '07-dannye.md' },
  { n: '8',  id: '08',  part: 'II',  title: 'Тесты и ревью', file: '08-testy.md' },
  { n: '9',  id: '09',  part: 'II',  title: 'Дизайн и UX', file: '09-dizayn.md' },
  { n: '10', id: '10',  part: 'III', title: 'Карта сервисов: поставщики, тарифы, выбор', file: '10-servisy.md' },
  { n: '11', id: '11',  part: 'III', title: 'Деплой и эксплуатация', file: '11-deploy.md' },
  { n: '12', id: '12',  part: 'III', title: 'Нагрузка и карта трат' },
  { n: '13', id: '13',  part: 'III', title: 'Юридика, налоги, оформление' },
  { n: '14', id: '14',  part: 'IV',  title: 'Цена, тарифы и юнит-экономика' },
  { n: '15', id: '15',  part: 'IV',  title: 'Лендинг и продающие тексты' },
  { n: '16', id: '16',  part: 'IV',  title: 'Запуск и первые клиенты' },
  { n: '17', id: '17',  part: 'IV',  title: 'Продажи и CRM' },
  { n: '18', id: '18',  part: 'IV',  title: 'Удержание и метрики' },
  { n: '19', id: '19',  part: 'IV',  title: 'Поддержка и обратная связь' },
  { n: '20а', id: '20a', part: 'V',  title: 'Как разговаривать с ИИ' },
  { n: '20б', id: '20b', part: 'V',  title: 'Оркестр из ИИ' },
];

// ---------- мини-markdown → HTML ----------
const glossary = JSON.parse(readFileSync(join(ROOT, 'glossary.json'), 'utf8'));
const glossIds = new Set(glossary.map(g => g.id));
const warnings = [];

const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s, chFile) {
  let out = escHtml(s);
  // [[id|текст]] / [[id]] → кнопка глоссария
  out = out.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id, text) => {
    if (!glossIds.has(id)) { warnings.push(`${chFile}: термин [[${id}]] не найден в glossary.json`); return text || id; }
    const label = text || glossary.find(g => g.id === id).term;
    return `<button class="term" data-t="${id}">${label}</button>`;
  });
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return out;
}

function mdToHtml(md, chFile) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let list = null;          // 'ul' | 'ol' | null
  let para = [];
  let quote = [];           // строки текущего blockquote

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '), chFile)}</p>`); para = []; }
  };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushQuote = () => {
    if (!quote.length) return;
    const text = quote.join(' ');
    let cls = 'callout';
    if (text.startsWith('✅')) cls += ' c-good';
    else if (text.startsWith('⚠️')) cls += ' c-warn';
    out.push(`<div class="${cls}"><p>${inline(text, chFile)}</p></div>`);
    quote = [];
  };

  // Разбить строку таблицы на ячейки. Защищаем «|» внутри глоссария [[id|текст]]
  // (иначе он рвал бы ячейку) сентинелом  на время split.
  const cells = (row) =>
    row
      .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '[[$1$2]]')
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim().replace(//g, '|'));

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trimEnd();
    const t = line.trim();
    if (t.startsWith('> ') || t === '>') { flushPara(); flushList(); quote.push(t.replace(/^>\s?/, '')); continue; }
    flushQuote();
    // таблица GFM: строка |...| со следующей строкой-разделителем |---|
    if (t.startsWith('|') && li + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[li + 1].trim())) {
      flushPara(); flushList();
      const head = cells(t);
      li++; // пропускаем разделитель
      const body = [];
      while (li + 1 < lines.length && lines[li + 1].trim().startsWith('|')) {
        li++;
        body.push(cells(lines[li].trim()));
      }
      let tbl = '<div class="tablewrap"><table><thead><tr>' +
        head.map((h) => `<th>${inline(h, chFile)}</th>`).join('') + '</tr></thead><tbody>';
      for (const row of body) {
        tbl += '<tr>' + row.map((c) => `<td>${inline(c, chFile)}</td>`).join('') + '</tr>';
      }
      out.push(tbl + '</tbody></table></div>');
      continue;
    }
    if (!t) { flushPara(); flushList(); continue; }
    if (t.startsWith('# ')) { flushPara(); flushList(); out.push(`<h1>${inline(t.slice(2), chFile)}</h1>`); continue; }
    if (t.startsWith('## ')) { flushPara(); flushList(); out.push(`<h2>${inline(t.slice(3), chFile)}</h2>`); continue; }
    if (t.startsWith('### ')) { flushPara(); flushList(); out.push(`<h3>${inline(t.slice(4), chFile)}</h3>`); continue; }
    if (t === '---') { flushPara(); flushList(); out.push('<hr>'); continue; }
    const mUl = t.match(/^[-•]\s+(.*)$/);
    const mOl = t.match(/^\d+\.\s+(.*)$/);
    if (mUl || mOl) {
      flushPara();
      const kind = mUl ? 'ul' : 'ol';
      if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((mUl || mOl)[1], chFile)}</li>`);
      continue;
    }
    flushList();
    para.push(t);
  }
  flushPara(); flushList(); flushQuote();
  return out.join('\n');
}

// ---------- главы ----------
const chapters = CHAPTERS.map(c => {
  if (!c.file) return { ...c, html: null };
  const md = readFileSync(join(ROOT, 'chapters', c.file), 'utf8');
  // <h1> главы берём из md (первая строка '# ...'), заголовок в оглавлении — из manifest
  return { n: c.n, id: c.id, part: c.part, title: c.title, html: mdToHtml(md, c.file) };
});

// ---------- шрифты ----------
const fontB64 = f => {
  const p = join(ROOT, '..', '..', 'node_modules', '@fontsource-variable', 'onest', 'files', f);
  if (!existsSync(p)) { warnings.push(`шрифт не найден: ${f} (будет системный)`); return ''; }
  return 'data:font/woff2;base64,' + readFileSync(p).toString('base64');
};

// ---------- сборка ----------
const payload = JSON.stringify({ parts: PARTS, chapters, glossary }).replace(/</g, '\\u003c');
let html = readFileSync(join(ROOT, 'shell', 'template.html'), 'utf8')
  .split('__FONT_CYR__').join(fontB64('onest-cyrillic-wght-normal.woff2'))
  .split('__FONT_LAT__').join(fontB64('onest-latin-wght-normal.woff2'))
  .split('__PAYLOAD__').join(payload);

mkdirSync(join(ROOT, 'build'), { recursive: true });
writeFileSync(join(ROOT, 'build', 'index.html'), html);
writeFileSync(join(ROOT, 'build', 'local.html'),
  '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  '</head>\n<body>\n' + html + '\n</body>\n</html>\n');

const ready = chapters.filter(c => c.html).length;
console.log(`OK: глав опубликовано ${ready}/${chapters.length}, index.html ${(html.length / 1024).toFixed(0)} КБ`);
for (const w of warnings) console.log('⚠️ ' + w);
