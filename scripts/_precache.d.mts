// Типы для vite.config.ts (сам модуль — scripts/_precache.mjs).
import type { Plugin } from 'vite'

interface PrecacheEntry {
  url: string
  revision: string | null
  size: number
}

export declare function startupFiles(bundle: Record<string, unknown>, always?: RegExp[]): Set<string>
export declare function startupPrecache(): {
  collect: Plugin
  transform: (entries: PrecacheEntry[]) => Promise<{ manifest: PrecacheEntry[]; warnings: string[] }>
  verify: Plugin
}
export declare function startupGraph(distDir: string): { refs: string[]; graph: Map<string, string> }
export declare function readPrecache(distDir: string): Set<string> | null
export declare function precacheProblems(distDir: string, precache?: Set<string> | null): string[]
