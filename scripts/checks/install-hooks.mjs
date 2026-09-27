#!/usr/bin/env node
// Включает хуки git из папки .githooks/ (pre-commit, commit-msg) — без
// зависимостей вроде husky: git сам умеет брать хуки из папки репозитория.
// Запускается сам на `npm install` / `npm ci` (скрипт prepare) и вручную:
// npm run prepare.
//
// ⚠️ Этот скрипт выполняется и там, где хуки не нужны: на сборке Vercel и в CI.
// Упасть он не имеет права — иначе сломается выкатка. Поэтому любая неудача
// (нет git, нет .git, CI) — тихий выход с кодом 0.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const cwd = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

if (process.env.CI || process.env.VERCEL || !existsSync(`${cwd}.git`)) process.exit(0)
try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd, stdio: 'ignore' })
  console.log('хуки git включены: .githooks/ (pre-commit — сторожа, commit-msg — описания)')
} catch {
  // нет git в PATH — не наша забота здесь
}
