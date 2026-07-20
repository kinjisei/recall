// ============================================================================
// AI-квесты по грамматике (см. блок «AI-КВЕСТЫ» в docs/schema.sql).
// Запись — только через security-definer RPC: назначает учитель, прогресс
// и переписку пишет ученица. Чтение — по RLS (обе стороны).
// ============================================================================
import { supabase } from './supabase'
import type { AppLang, ChatTurn, GrammarQuest } from '../types'

/** Квесты текущей ученицы (новые сверху). */
export async function listMyQuests(): Promise<GrammarQuest[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('grammar_quests')
    .select('*')
    .eq('student_id', auth.user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as GrammarQuest[]
}

/** Квесты конкретной ученицы — для карточки на экране преподавателя. */
export async function listStudentQuests(studentId: string): Promise<GrammarQuest[]> {
  const { data, error } = await supabase
    .from('grammar_quests')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as GrammarQuest[]
}

export async function assignQuest(input: {
  studentId: string
  lang: AppLang
  level: string
  topic: string
  scenario: string
  target: number
}): Promise<void> {
  const { error } = await supabase.rpc('assign_grammar_quest', {
    p_student_id: input.studentId,
    p_lang: input.lang,
    p_level: input.level,
    p_topic: input.topic,
    p_scenario: input.scenario,
    p_target: input.target,
  })
  if (error) throw error
}

export async function deleteQuest(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_grammar_quest', { p_id: id })
  if (error) throw error
}

/** Засчитать один верный ответ; возвращает новый progress. */
export async function questCorrectAnswer(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('quest_correct_answer', { p_id: id })
  if (error) throw error
  return data as number
}

export async function saveQuestMessages(id: string, messages: ChatTurn[]): Promise<void> {
  const { error } = await supabase.rpc('save_quest_messages', {
    p_id: id,
    p_messages: messages,
  })
  if (error) throw error
}
