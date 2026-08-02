export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string | null
          day: string | null
          duration_sec: number | null
          id: string
          items_done: number | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          day?: string | null
          duration_sec?: number | null
          id?: string
          items_done?: number | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          day?: string | null
          duration_sec?: number | null
          id?: string
          items_done?: number | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_calls: {
        Row: {
          called_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          called_at?: string
          id?: number
          kind?: string
          user_id: string
        }
        Update: {
          called_at?: string
          id?: number
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          added_at: string
          email: string
          note: string | null
        }
        Insert: {
          added_at?: string
          email: string
          note?: string | null
        }
        Update: {
          added_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      cards: {
        Row: {
          audio_url: string | null
          back: string | null
          created_at: string | null
          deck_id: string | null
          example: string | null
          front: string
          id: string
          ipa: string | null
          source: string | null
        }
        Insert: {
          audio_url?: string | null
          back?: string | null
          created_at?: string | null
          deck_id?: string | null
          example?: string | null
          front: string
          id?: string
          ipa?: string | null
          source?: string | null
        }
        Update: {
          audio_url?: string | null
          back?: string | null
          created_at?: string | null
          deck_id?: string | null
          example?: string | null
          front?: string
          id?: string
          ipa?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          audio_url: string | null
          body: string | null
          created_at: string | null
          id: string
          level: string | null
          source: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          audio_url?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          audio_url?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_assignments: {
        Row: {
          created_at: string | null
          deck_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          deck_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          deck_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_assignments_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_shared: boolean | null
          lang: string
          owner_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean | null
          lang?: string
          owner_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean | null
          lang?: string
          owner_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grammar_mistakes: {
        Row: {
          created_at: string
          ex: number
          id: string
          lang: string
          topic_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          ex: number
          id?: string
          lang: string
          topic_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          ex?: number
          id?: string
          lang?: string
          topic_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grammar_mistakes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grammar_quests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          lang: string
          level: string
          messages: Json | null
          progress: number
          scenario: string
          status: string
          student_id: string
          target: number
          teacher_id: string
          topic: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lang?: string
          level?: string
          messages?: Json | null
          progress?: number
          scenario: string
          status?: string
          student_id: string
          target?: number
          teacher_id: string
          topic: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lang?: string
          level?: string
          messages?: Json | null
          progress?: number
          scenario?: string
          status?: string
          student_id?: string
          target?: number
          teacher_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "grammar_quests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grammar_quests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_assignments: {
        Row: {
          ai_review: Json | null
          answers: Json | null
          attempts: Json | null
          auto_score: number | null
          auto_total: number | null
          created_at: string | null
          id: string
          material_id: string
          note: string | null
          reviewed_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_review: Json | null
        }
        Insert: {
          ai_review?: Json | null
          answers?: Json | null
          attempts?: Json | null
          auto_score?: number | null
          auto_total?: number | null
          created_at?: string | null
          id?: string
          material_id: string
          note?: string | null
          reviewed_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_review?: Json | null
        }
        Update: {
          ai_review?: Json | null
          answers?: Json | null
          attempts?: Json | null
          auto_score?: number | null
          auto_total?: number | null
          created_at?: string | null
          id?: string
          material_id?: string
          note?: string | null
          reviewed_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_review?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "material_assignments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          body: string
          created_at: string | null
          exercises: Json
          format: string
          id: string
          lang: string
          length_range: string
          level: string
          plan: Json | null
          teacher_id: string
          title: string | null
          topic: string
        }
        Insert: {
          body: string
          created_at?: string | null
          exercises: Json
          format: string
          id?: string
          lang?: string
          length_range: string
          level: string
          plan?: Json | null
          teacher_id: string
          title?: string | null
          topic: string
        }
        Update: {
          body?: string
          created_at?: string | null
          exercises?: Json
          format?: string
          id?: string
          lang?: string
          length_range?: string
          level?: string
          plan?: Json | null
          teacher_id?: string
          title?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          role: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          lang: string
          result_level: string | null
          status: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lang: string
          result_level?: string | null
          status?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lang?: string
          result_level?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string | null
          display_name: string | null
          id: string
          invite_code: string | null
          is_admin: boolean
          level: string | null
          native_lang: string | null
          plan: string
          plan_expires_at: string | null
          role: string | null
          trial_until: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string | null
          display_name?: string | null
          id: string
          invite_code?: string | null
          is_admin?: boolean
          level?: string | null
          native_lang?: string | null
          plan?: string
          plan_expires_at?: string | null
          role?: string | null
          trial_until?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string | null
          display_name?: string | null
          id?: string
          invite_code?: string | null
          is_admin?: boolean
          level?: string | null
          native_lang?: string | null
          plan?: string
          plan_expires_at?: string | null
          role?: string | null
          trial_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      review_states: {
        Row: {
          card_id: string | null
          difficulty: number | null
          due: string | null
          id: string
          lapses: number | null
          last_review: string | null
          reps: number | null
          stability: number | null
          state: string | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          difficulty?: number | null
          due?: string | null
          id?: string
          lapses?: number | null
          last_review?: string | null
          reps?: number | null
          stability?: number | null
          state?: string | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          difficulty?: number | null
          due?: string | null
          id?: string
          lapses?: number | null
          last_review?: string | null
          reps?: number | null
          stability?: number | null
          state?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_states_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string
          goal: string
          id: string
          lang: string
          level: string
          start_day: string
          status: string
          student_id: string
          summary: string
          teacher_id: string
          weeks: Json
        }
        Insert: {
          created_at?: string
          goal?: string
          id?: string
          lang: string
          level: string
          start_day?: string
          status?: string
          student_id: string
          summary?: string
          teacher_id: string
          weeks: Json
        }
        Update: {
          created_at?: string
          goal?: string
          id?: string
          lang?: string
          level?: string
          start_day?: string
          status?: string
          student_id?: string
          summary?: string
          teacher_id?: string
          weeks?: Json
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_students: {
        Row: {
          created_at: string | null
          daily_plan: Json | null
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          daily_plan?: Json | null
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          daily_plan?: Json | null
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      word_checks: {
        Row: {
          card_ids: Json
          completed_at: string | null
          created_at: string | null
          id: string
          results: Json | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          card_ids: Json
          completed_at?: string | null
          created_at?: string | null
          id?: string
          results?: Json | null
          student_id: string
          teacher_id: string
        }
        Update: {
          card_ids?: Json
          completed_at?: string | null
          created_at?: string | null
          id?: string
          results?: Json | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_checks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "word_checks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      writing_submissions: {
        Row: {
          created_at: string | null
          feedback: Json | null
          id: string
          prompt: string | null
          text: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: Json | null
          id?: string
          prompt?: string | null
          text: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: Json | null
          id?: string
          prompt?: string | null
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "writing_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      writing_task_assignments: {
        Row: {
          ai_review: Json | null
          attempts: Json | null
          band: string | null
          created_at: string | null
          essay: string | null
          id: string
          note: string | null
          reviewed_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          task_id: string
          teacher_review: Json | null
        }
        Insert: {
          ai_review?: Json | null
          attempts?: Json | null
          band?: string | null
          created_at?: string | null
          essay?: string | null
          id?: string
          note?: string | null
          reviewed_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          task_id: string
          teacher_review?: Json | null
        }
        Update: {
          ai_review?: Json | null
          attempts?: Json | null
          band?: string | null
          created_at?: string | null
          essay?: string | null
          id?: string
          note?: string | null
          reviewed_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          task_id?: string
          teacher_review?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "writing_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "writing_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writing_task_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      writing_tasks: {
        Row: {
          created_at: string | null
          id: string
          lang: string
          level: string
          mode: string
          prompt: string
          settings: Json | null
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lang?: string
          level: string
          mode: string
          prompt: string
          settings?: Json | null
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lang?: string
          level?: string
          mode?: string
          prompt?: string
          settings?: Json | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "writing_tasks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      access_overview: {
        Row: {
          added_at: string | null
          banned_until: string | null
          blocked: boolean | null
          display_name: string | null
          email: string | null
          last_sign_in_at: string | null
          note: string | null
          registered_at: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: []
      }
      ai_usage_overview: {
        Row: {
          display_name: string | null
          email: string | null
          last_call: string | null
          last_day: number | null
          last_hour: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_find_user: { Args: { q: string }; Returns: Json }
      admin_set_plan: {
        Args: { months: number; new_plan: string; target: string }
        Returns: Json
      }
      assign_grammar_quest: {
        Args: {
          p_lang: string
          p_level: string
          p_scenario: string
          p_student_id: string
          p_target: number
          p_topic: string
        }
        Returns: string
      }
      assign_material: {
        Args: { p_material_id: string; p_student_id: string }
        Returns: undefined
      }
      assign_writing_task: {
        Args: { p_task_id: string; p_student_id: string }
        Returns: undefined
      }
      unassign_writing_task: {
        Args: { p_task_id: string; p_student_id: string }
        Returns: undefined
      }
      submit_writing: {
        Args: { p_id: string; p_essay: string; p_grade: Json; p_band: string }
        Returns: undefined
      }
      assign_placement: {
        Args: { p_lang: string; p_student_id: string }
        Returns: string
      }
      assign_selected_words: {
        Args: {
          p_cards: Json
          p_lang: string
          p_student_id: string
          p_title: string
        }
        Returns: number
      }
      assign_word_check: {
        Args: { p_card_ids: Json; p_student_id: string }
        Returns: undefined
      }
      cancel_placement: { Args: { p_id: string }; Returns: undefined }
      consume_ai_quota: { Args: { p_kind?: string }; Returns: undefined }
      deck_assigned_to: {
        Args: { d_id: string; s_id: string }
        Returns: boolean
      }
      deck_owned_by: { Args: { d_id: string; u_id: string }; Returns: boolean }
      deck_owned_by_student_of: {
        Args: { d_id: string; t_id: string }
        Returns: boolean
      }
      delete_grammar_quest: { Args: { p_id: string }; Returns: undefined }
      ensure_invite_code: { Args: never; Returns: string }
      finish_material_review: {
        Args: { p_id: string; p_review: Json }
        Returns: undefined
      }
      get_my_plan: { Args: never; Returns: Json }
      has_paid_access: { Args: { uid: string }; Returns: boolean }
      has_premium_access: { Args: { uid: string }; Returns: boolean }
      is_student_of: { Args: { s_id: string; t_id: string }; Returns: boolean }
      join_teacher: { Args: { code: string }; Returns: string }
      log_activity: {
        Args: {
          p_day: string
          p_items?: number
          p_sec?: number
          p_type: string
        }
        Returns: undefined
      }
      material_assigned_to: {
        Args: { m_id: string; s_id: string }
        Returns: boolean
      }
      material_owned_by: {
        Args: { m_id: string; u_id: string }
        Returns: boolean
      }
      norm_answer: { Args: { s: string }; Returns: string }
      quest_correct_answer: { Args: { p_id: string }; Returns: number }
      reassign_material: {
        Args: { p_id: string; p_note: string }
        Returns: undefined
      }
      regenerate_invite_code: { Args: never; Returns: string }
      replace_study_plan: {
        Args: {
          p_goal: string
          p_lang: string
          p_level: string
          p_student_id: string
          p_summary: string
          p_weeks: Json
        }
        Returns: string
      }
      save_material_ai_review: {
        Args: { p_id: string; p_review: Json }
        Returns: undefined
      }
      save_quest_messages: {
        Args: { p_id: string; p_messages: Json }
        Returns: undefined
      }
      set_daily_plan: {
        Args: { p_plan: Json; p_student_id: string }
        Returns: undefined
      }
      submit_material: {
        Args: {
          p_answers: Json
          p_auto_score: number
          p_auto_total: number
          p_id: string
        }
        Returns: undefined
      }
      submit_placement: {
        Args: { p_lang: string; p_level: string }
        Returns: number
      }
      submit_word_check: {
        Args: { p_id: string; p_results: Json }
        Returns: boolean
      }
      teacher_seat_limit: { Args: { p_plan: string }; Returns: number }
      unassign_material: {
        Args: { p_material_id: string; p_student_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
