// Типы для vite.config.ts (сам модуль — scripts/_keys.mjs).
export declare const PUBLISHABLE: string
export declare const SECRET: string
export declare function keyProblem(name: string, value: string | undefined, kind: 'publishable' | 'secret'): string | null
export declare function buildEnvProblems(env: Record<string, string | undefined>, opts: { onVercel: boolean }): string[]
