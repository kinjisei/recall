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
      ai_call_log: {
        Row: {
          attempts: Json
          call_token: string
          called_at: string
          id: number
          latency_ms: number | null
          model: string | null
          status: string
          task: string
          tier: string | null
          user_id: string
        }
        Insert: {
          attempts?: Json
          call_token: string
          called_at?: string
          id?: never
          latency_ms?: number | null
          model?: string | null
          status: string
          task: string
          tier?: string | null
          user_id: string
        }
        Update: {
          attempts?: Json
          call_token?: string
          called_at?: string
          id?: never
          latency_ms?: number | null
          model?: string | null
          status?: string
          task?: string
          tier?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_calls: {
        Row: {
          called_at: string
          cost_energy: number
          id: number
          is_generation: boolean
          kind: string
          pool_owner: string | null
          refund_token: string | null
          user_id: string
        }
        Insert: {
          called_at?: string
          cost_energy?: number
          id?: number
          is_generation?: boolean
          kind?: string
          pool_owner?: string | null
          refund_token?: string | null
          user_id: string
        }
        Update: {
          called_at?: string
          cost_energy?: number
          id?: number
          is_generation?: boolean
          kind?: string
          pool_owner?: string | null
          refund_token?: string | null
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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
          lang: string | null
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          lang?: string | null
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          lang?: string | null
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
      events: {
        Row: {
          anon_id: string | null
          created_at: string
          id: number
          name: string
          props: Json
          source: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          id?: number
          name: string
          props?: Json
          source?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          id?: number
          name?: string
          props?: Json
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
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
      homework: {
        Row: {
          created_at: string
          due_at: string
          id: string
          lang: string
          note: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          due_at: string
          id?: string
          lang?: string
          note?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: string
          lang?: string
          note?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_items: {
        Row: {
          base_count: number
          chosen_at: string | null
          done_at: string | null
          done_by: string | null
          homework_id: string
          id: string
          kind: string
          pick_group: number | null
          pos: number
          ref_id: string | null
          target: number
          title: string
        }
        Insert: {
          base_count?: number
          chosen_at?: string | null
          done_at?: string | null
          done_by?: string | null
          homework_id: string
          id?: string
          kind: string
          pick_group?: number | null
          pos?: number
          ref_id?: string | null
          target?: number
          title: string
        }
        Update: {
          base_count?: number
          chosen_at?: string | null
          done_at?: string | null
          done_by?: string | null
          homework_id?: string
          id?: string
          kind?: string
          pick_group?: number | null
          pos?: number
          ref_id?: string | null
          target?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_items_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_participants: {
        Row: {
          attended: boolean | null
          card_id: string
          charge: string | null
          charge_auto: boolean
          lesson_id: string
          marked_at: string | null
          teacher_id: string
          trial: boolean
        }
        Insert: {
          attended?: boolean | null
          card_id: string
          charge?: string | null
          charge_auto?: boolean
          lesson_id: string
          marked_at?: string | null
          teacher_id: string
          trial?: boolean
        }
        Update: {
          attended?: boolean | null
          card_id?: string
          charge?: string | null
          charge_auto?: boolean
          lesson_id?: string
          marked_at?: string | null
          teacher_id?: string
          trial?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lesson_participants_card_id_teacher_id_fkey"
            columns: ["card_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "student_cards"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "lesson_participants_lesson_id_teacher_id_fkey"
            columns: ["lesson_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      lesson_series: {
        Row: {
          created_at: string
          ends_on: string | null
          every_weeks: number
          generated_until: string | null
          id: string
          kind: string
          link: string | null
          minutes: number
          split_from: string | null
          start_time: string
          starts_on: string
          teacher_id: string
          title: string | null
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          every_weeks?: number
          generated_until?: string | null
          id?: string
          kind: string
          link?: string | null
          minutes: number
          split_from?: string | null
          start_time: string
          starts_on: string
          teacher_id: string
          title?: string | null
          updated_at?: string
          weekdays: number[]
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          every_weeks?: number
          generated_until?: string | null
          id?: string
          kind?: string
          link?: string | null
          minutes?: number
          split_from?: string | null
          start_time?: string
          starts_on?: string
          teacher_id?: string
          title?: string | null
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_series_split_from_fkey"
            columns: ["split_from"]
            isOneToOne: false
            referencedRelation: "lesson_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_series_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cancelled_at: string | null
          created_at: string
          ends_at: string
          id: string
          kind: string
          link: string | null
          moved_from: string | null
          series_date: string | null
          series_id: string | null
          settled_at: string | null
          starts_at: string
          status: string
          teacher_id: string
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          kind: string
          link?: string | null
          moved_from?: string | null
          series_date?: string | null
          series_id?: string | null
          settled_at?: string | null
          starts_at: string
          status?: string
          teacher_id: string
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          kind?: string
          link?: string | null
          moved_from?: string | null
          series_date?: string | null
          series_id?: string | null
          settled_at?: string | null
          starts_at?: string
          status?: string
          teacher_id?: string
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_series_id_teacher_id_fkey"
            columns: ["series_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "lesson_series"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
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
      notification_prefs: {
        Row: {
          lesson_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          lesson_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          lesson_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          about: string
          enabled: boolean
          fn: string
          last_created: number | null
          last_error: string | null
          last_run_at: string | null
          name: string
        }
        Insert: {
          about: string
          enabled?: boolean
          fn: string
          last_created?: number | null
          last_error?: string | null
          last_run_at?: string | null
          name: string
        }
        Update: {
          about?: string
          enabled?: boolean
          fn?: string
          last_created?: number | null
          last_error?: string | null
          last_run_at?: string | null
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          dedupe_key: string
          id: string
          kind: string
          read_at: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          dedupe_key: string
          id?: string
          kind: string
          read_at?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          dedupe_key?: string
          id?: string
          kind?: string
          read_at?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      paid_lessons: {
        Row: {
          card_id: string
          created_at: string
          created_by: string | null
          id: string
          n: number
          note: string | null
          paid_on: string
          teacher_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          n: number
          note?: string | null
          paid_on?: string
          teacher_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          n?: number
          note?: string | null
          paid_on?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_lessons_card_id_teacher_id_fkey"
            columns: ["card_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "student_cards"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "paid_lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_claims: {
        Row: {
          created_at: string
          id: string
          months: number
          outcome: string | null
          payment_id: string | null
          plan: string
          resolved_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          months?: number
          outcome?: string | null
          payment_id?: string | null
          plan: string
          resolved_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          months?: number
          outcome?: string | null
          payment_id?: string | null
          plan?: string
          resolved_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_claims_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string
          confirmed_by: string | null
          ends_at: string
          id: string
          method: string
          months: number
          note: string | null
          plan: string
          request_id: string | null
          starts_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string
          confirmed_by?: string | null
          ends_at: string
          id?: string
          method: string
          months: number
          note?: string | null
          plan: string
          request_id?: string | null
          starts_at: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string
          confirmed_by?: string | null
          ends_at?: string
          id?: string
          method?: string
          months?: number
          note?: string | null
          plan?: string
          request_id?: string | null
          starts_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      personal_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
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
          first_student_at: string | null
          goal: string | null
          id: string
          invite_code: string | null
          is_admin: boolean
          level: string | null
          native_lang: string | null
          plan: string
          plan_expires_at: string | null
          referral_hint_seen_at: string | null
          role: string | null
          trial_bonus_days: number
          trial_until: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string | null
          display_name?: string | null
          first_student_at?: string | null
          goal?: string | null
          id: string
          invite_code?: string | null
          is_admin?: boolean
          level?: string | null
          native_lang?: string | null
          plan?: string
          plan_expires_at?: string | null
          referral_hint_seen_at?: string | null
          role?: string | null
          trial_bonus_days?: number
          trial_until?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string | null
          display_name?: string | null
          first_student_at?: string | null
          goal?: string | null
          id?: string
          invite_code?: string | null
          is_admin?: boolean
          level?: string | null
          native_lang?: string | null
          plan?: string
          plan_expires_at?: string | null
          referral_hint_seen_at?: string | null
          role?: string | null
          trial_bonus_days?: number
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
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          paid_at: string | null
          payment_id: string | null
          referee_id: string | null
          referee_plan: string | null
          referrer_id: string
          reward_days: number
          reward_months: number
          reward_plan: string | null
          rewarded_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          referee_id?: string | null
          referee_plan?: string | null
          referrer_id: string
          reward_days?: number
          reward_months?: number
          reward_plan?: string | null
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          referee_id?: string | null
          referee_plan?: string | null
          referrer_id?: string
          reward_days?: number
          reward_months?: number
          reward_plan?: string | null
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "access_overview"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
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
      schedule_settings: {
        Row: {
          default_link: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          default_link?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          default_link?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_settings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series_participants: {
        Row: {
          card_id: string
          series_id: string
          teacher_id: string
        }
        Insert: {
          card_id: string
          series_id: string
          teacher_id: string
        }
        Update: {
          card_id?: string
          series_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_participants_card_id_teacher_id_fkey"
            columns: ["card_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "student_cards"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "series_participants_series_id_teacher_id_fkey"
            columns: ["series_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "lesson_series"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      student_cards: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          invite_code: string | null
          name: string
          note: string | null
          status: string
          teacher_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          name: string
          note?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          name?: string
          note?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_cards_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_cards_user_id_fkey"
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
      teacher_signups: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_signups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
          seat: boolean
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          daily_plan?: Json | null
          id?: string
          seat?: boolean
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          daily_plan?: Json | null
          id?: string
          seat?: boolean
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
            foreignKeyName: "writing_task_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writing_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "writing_tasks"
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
      teacher_signups_overview: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          plan: string | null
          students: number | null
          trial_until: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      access_end: {
        Args: {
          p_expires: string
          p_plan: string
          p_role: string
          p_trial: string
        }
        Returns: {
          ends_at: string
          source: string
        }[]
      }
      activity_total: {
        Args: { p_types: string[]; p_user: string }
        Returns: number
      }
      add_paid_lessons: {
        Args: {
          p_card: string
          p_count: number
          p_note?: string
          p_paid_on?: string
        }
        Returns: string
      }
      admin_ai_tasks: {
        Args: { p_days?: number }
        Returns: {
          avg_ms: number
          calls: number
          cut: number
          day: string
          failed: number
          ok: number
          p95_ms: number
          task: string
        }[]
      }
      admin_ai_usage: {
        Args: { p_days?: number }
        Returns: {
          avg_first_ms: number
          avg_ms: number
          day: string
          failed: number
          model: string
          ok: number
          p95_ms: number
          refused: number
          requests: number
        }[]
      }
      admin_dismiss_payment_claim: {
        Args: { p_claim: string }
        Returns: undefined
      }
      admin_feedback: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      admin_find_user: { Args: { q: string }; Returns: Json }
      admin_funnel: { Args: { p_days?: number }; Returns: Json }
      admin_payment_claims: {
        Args: never
        Returns: {
          claim_plan: string
          code: string
          created_at: string
          display_name: string
          email: string
          id: string
          months: number
          plan: string
          plan_expires_at: string
          role: string
          students: number
          trial_until: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_recent_errors: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      admin_recent_payments: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          confirmed_at: string
          display_name: string
          email: string
          ends_at: string
          id: string
          method: string
          months: number
          note: string
          plan: string
          starts_at: string
          user_id: string
        }[]
      }
      admin_set_plan: {
        Args: { months: number; new_plan: string; target: string }
        Returns: Json
      }
      after_lessons_changed: {
        Args: { p_change: Json; p_teacher: string }
        Returns: undefined
      }
      after_payment_confirmed: {
        Args: { p_payment: string }
        Returns: undefined
      }
      almaty_ts: { Args: { p_day: string; p_time: string }; Returns: string }
      apply_referral_rewards: { Args: { p_referrer: string }; Returns: number }
      assert_teacher_can_write: { Args: never; Returns: undefined }
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
      assign_words_to_student: {
        Args: { p_lang: string; p_student_id: string; p_words: Json }
        Returns: number
      }
      assign_writing_task: {
        Args: { p_student_id: string; p_task_id: string }
        Returns: undefined
      }
      attach_referral: {
        Args: { p_code: string; p_uid: string }
        Returns: boolean
      }
      become_teacher: { Args: { p_ref?: string }; Returns: undefined }
      cancel_lesson: {
        Args: { p_charge: boolean; p_lesson: string }
        Returns: undefined
      }
      cancel_placement: { Args: { p_id: string }; Returns: undefined }
      cancel_series_from: {
        Args: { p_charge: boolean; p_lesson: string }
        Returns: undefined
      }
      card_lesson_balance: {
        Args: { p_card: string }
        Returns: {
          balance: number
          charged: number
          paid: number
        }[]
      }
      card_takes_seat: { Args: { p_status: string }; Returns: boolean }
      card_text: { Args: { p: string; p_max: number }; Returns: string }
      choose_homework_item: { Args: { p_item: string }; Returns: undefined }
      complete_homework_item: { Args: { p_item: string }; Returns: undefined }
      confirm_payment: {
        Args: {
          p_amount: number
          p_claim?: string
          p_method?: string
          p_months: number
          p_note?: string
          p_plan: string
          p_request?: string
          p_user: string
        }
        Returns: {
          ends_at: string
          id: string
          plan: string
          repeated: boolean
          starts_at: string
        }[]
      }
      covering_teacher: {
        Args: { p_paid_only?: boolean; p_student: string }
        Returns: string
      }
      create_homework: {
        Args: {
          p_due: string
          p_items: Json
          p_lang: string
          p_note?: string
          p_student_id: string
        }
        Returns: string
      }
      create_lesson: {
        Args: {
          p_cards: string[]
          p_kind: string
          p_link?: string
          p_minutes: number
          p_starts_at: string
          p_title?: string
        }
        Returns: string
      }
      create_series: {
        Args: {
          p_cards: string[]
          p_ends_on?: string
          p_every_weeks: number
          p_kind: string
          p_link?: string
          p_minutes: number
          p_starts_on: string
          p_time: string
          p_title?: string
          p_weekdays: number[]
        }
        Returns: string
      }
      create_student_card: {
        Args: {
          p_contact?: string
          p_name: string
          p_note?: string
          p_status?: string
        }
        Returns: string
      }
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
      dismiss_referral_hint: { Args: never; Returns: undefined }
      dispatch_notifications: { Args: never; Returns: number }
      energy_source: { Args: { uid: string }; Returns: Record<string, unknown> }
      ensure_invite_code: { Args: never; Returns: string }
      ensure_personal_code: { Args: { p_user: string }; Returns: string }
      finish_material_review: {
        Args: { p_id: string; p_review: Json }
        Returns: undefined
      }
      finish_writing_review: {
        Args: { p_band: string; p_id: string; p_review: Json }
        Returns: undefined
      }
      free_teacher_seats: { Args: never; Returns: number }
      get_card_history: {
        Args: { p_before?: string; p_card: string; p_limit?: number }
        Returns: {
          at: string
          attended: boolean
          charge: string
          charge_auto: boolean
          ends_at: string
          id: string
          item: string
          lesson_kind: string
          lesson_status: string
          n: number
          note: string
          paid_on: string
          starts_at: string
          title: string
          trial: boolean
        }[]
      }
      get_homework: { Args: { p_student?: string }; Returns: Json }
      get_homework_many: { Args: never; Returns: Json }
      get_lesson_balances: {
        Args: never
        Returns: {
          balance: number
          card_id: string
          charged: number
          paid: number
        }[]
      }
      get_my_lesson_balances: {
        Args: never
        Returns: {
          lessons_left: number
          teacher_id: string
          teacher_name: string
          tracked: boolean
        }[]
      }
      get_my_lessons: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ends_at: string
          kind: string
          lesson_id: string
          link: string
          moved_from: string
          starts_at: string
          status: string
          teacher_id: string
          teacher_name: string
          title: string
          version: number
        }[]
      }
      get_my_plan: { Args: never; Returns: Json }
      get_my_referral: {
        Args: never
        Returns: {
          code: string
          invited: number
          paid: number
          pending: number
          reward_days: number
          reward_months: number
        }[]
      }
      get_my_series: {
        Args: never
        Returns: {
          card_ids: string[]
          ends_on: string
          every_weeks: number
          id: string
          kind: string
          link: string
          minutes: number
          split_from: string
          start_time: string
          starts_on: string
          title: string
          weekdays: number[]
        }[]
      }
      get_my_student_cards: {
        Args: never
        Returns: {
          contact: string
          created_at: string
          holds_seat: boolean
          id: string
          in_app: boolean
          linked_at: string
          name: string
          note: string
          seat: boolean
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      get_pay_info: {
        Args: never
        Returns: {
          claim_created_at: string
          claim_id: string
          claim_months: number
          claim_plan: string
          code: string
          plan: string
          plan_expires_at: string
          role: string
          trial_until: string
        }[]
      }
      get_schedule: {
        Args: { p_from: string; p_to: string }
        Returns: {
          attended: boolean
          card_id: string
          card_name: string
          card_status: string
          charge: string
          charge_auto: boolean
          ends_at: string
          kind: string
          lesson_id: string
          link: string
          moved_from: string
          series_date: string
          series_id: string
          settled: boolean
          starts_at: string
          status: string
          title: string
          trial: boolean
          version: number
        }[]
      }
      get_schedule_settings: {
        Args: never
        Returns: {
          default_link: string
        }[]
      }
      has_paid_access: { Args: { uid: string }; Returns: boolean }
      has_premium_access: { Args: { uid: string }; Returns: boolean }
      holds_seat: {
        Args: { p_student: string; p_teacher: string }
        Returns: boolean
      }
      homework_item_progress: { Args: { p_item: string }; Returns: number }
      homework_json: {
        Args: { p_student: string; p_teacher?: string }
        Returns: Json
      }
      is_student_of: { Args: { s_id: string; t_id: string }; Returns: boolean }
      join_teacher: { Args: { code: string }; Returns: string }
      latin_letters: { Args: { p: string }; Returns: string }
      lesson_cancel: {
        Args: { p_charge: boolean; p_lesson: string }
        Returns: number
      }
      lesson_check_time: {
        Args: { p_minutes: number; p_starts_at: string }
        Returns: undefined
      }
      lesson_join_cards: {
        Args: { p_cards: string[]; p_lesson: string }
        Returns: undefined
      }
      lesson_link_clean: { Args: { p_link: string }; Returns: string }
      lock_teacher_seats: { Args: { p_teacher: string }; Returns: undefined }
      log_activity: {
        Args: {
          p_day: string
          p_items?: number
          p_sec?: number
          p_type: string
        }
        Returns: undefined
      }
      log_ai_call: {
        Args: {
          p_attempts: Json
          p_latency_ms: number
          p_model: string
          p_nonce: string
          p_refund?: boolean
          p_status: string
          p_task: string
          p_tier: string
        }
        Returns: boolean
      }
      mark_homework_choice: { Args: { p_item: string }; Returns: undefined }
      mark_lesson_participant: {
        Args: { p_card: string; p_lesson: string; p_outcome: string }
        Returns: undefined
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      material_assigned_to: {
        Args: { m_id: string; s_id: string }
        Returns: boolean
      }
      material_owned_by: {
        Args: { m_id: string; u_id: string }
        Returns: boolean
      }
      new_invite_code: { Args: never; Returns: string }
      norm_answer: { Args: { s: string }; Returns: string }
      norm_typed: { Args: { s: string }; Returns: string }
      notify: {
        Args: {
          p_data: Json
          p_dedupe_key: string
          p_kind: string
          p_user_id: string
        }
        Returns: boolean
      }
      notify_access_ending: { Args: { p_now: string }; Returns: number }
      notify_lessons_low: { Args: { p_card: string }; Returns: boolean }
      pin_default_seats: { Args: { p_teacher: string }; Returns: undefined }
      plan_price: { Args: { p_plan: string }; Returns: number }
      quest_correct_answer: { Args: { p_id: string }; Returns: number }
      reassign_material: {
        Args: { p_id: string; p_note: string }
        Returns: undefined
      }
      reassign_writing: {
        Args: { p_id: string; p_note: string }
        Returns: undefined
      }
      recall_day_start: { Args: never; Returns: string }
      recall_month_start: { Args: never; Returns: string }
      recompute_teacher_trial: { Args: { p_uid: string }; Returns: string }
      referral_hint: { Args: never; Returns: boolean }
      referral_reward: {
        Args: { p_referee_plan: string; p_referrer_plan: string }
        Returns: {
          days: number
          months: number
        }[]
      }
      refresh_homework_for: { Args: { p_student: string }; Returns: undefined }
      refund_ai_call: { Args: { p_nonce: string }; Returns: boolean }
      regenerate_invite_code: { Args: never; Returns: string }
      registration_open: { Args: never; Returns: boolean }
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
      report_payment_sent: {
        Args: { p_months?: number; p_plan: string }
        Returns: {
          created_at: string
          id: string
          months: number
          plan: string
        }[]
      }
      restore_lesson: { Args: { p_lesson: string }; Returns: undefined }
      rule_access_ending: { Args: never; Returns: number }
      run_notification_rules: { Args: never; Returns: Json }
      save_material_ai_review: {
        Args: { p_id: string; p_review: Json }
        Returns: undefined
      }
      save_quest_messages: {
        Args: { p_id: string; p_messages: Json }
        Returns: undefined
      }
      schedule_cards: {
        Args: { p_cards: string[]; p_kind: string; p_teacher: string }
        Returns: string[]
      }
      schedule_horizon_days: { Args: never; Returns: number }
      schedule_limit: { Args: { p_what: string }; Returns: number }
      schedule_tick: { Args: { p_now: string }; Returns: Json }
      seat_links: {
        Args: { p_teacher: string }
        Returns: {
          created_at: string | null
          daily_plan: Json | null
          id: string
          seat: boolean
          student_id: string
          teacher_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "teacher_students"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      self_assign_material: {
        Args: { p_material_id: string }
        Returns: undefined
      }
      send_card_message: {
        Args: { p_card: string; p_text: string }
        Returns: string
      }
      series_days: { Args: { p_weekdays: number[] }; Returns: number[] }
      series_fill: {
        Args: { p_from: string; p_now: string; p_series: string }
        Returns: number
      }
      series_slot: {
        Args: {
          p_day: string
          p_ends: string
          p_every: number
          p_starts: string
          p_weekdays: number[]
        }
        Returns: boolean
      }
      set_cancel_charge: {
        Args: { p_card: string; p_charge: boolean; p_lesson: string }
        Returns: undefined
      }
      set_daily_plan: {
        Args: { p_plan: Json; p_student_id: string }
        Returns: undefined
      }
      set_default_lesson_link: { Args: { p_link: string }; Returns: undefined }
      set_student_card_status: {
        Args: { p_card: string; p_status: string }
        Returns: undefined
      }
      set_student_seat: {
        Args: { p_on: boolean; p_student: string }
        Returns: undefined
      }
      spend_energy: {
        Args: {
          p_cost?: number
          p_generation?: boolean
          p_kind?: string
          p_nonce?: string
        }
        Returns: undefined
      }
      start_own_writing: {
        Args: {
          p_lang: string
          p_level: string
          p_mode: string
          p_prompt: string
          p_settings?: Json
        }
        Returns: string
      }
      stop_teaching: { Args: never; Returns: undefined }
      student_card_invite: { Args: { p_card: string }; Returns: string }
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
        Returns: Json
      }
      submit_writing: {
        Args: { p_band: string; p_essay: string; p_grade: Json; p_id: string }
        Returns: undefined
      }
      teacher_can_write: { Args: { p_uid: string }; Returns: boolean }
      teacher_delete_student_cards: {
        Args: { p_card_ids: Json; p_student_id: string }
        Returns: number
      }
      teacher_energy_pool: { Args: { p_plan: string }; Returns: number }
      teacher_gen_limit: { Args: { p_plan: string }; Returns: number }
      teacher_seat_limit: { Args: { p_plan: string }; Returns: number }
      teacher_seats_effective: { Args: { p_uid: string }; Returns: number }
      teacher_trial_end: {
        Args: { p_bonus: number; p_first: string; p_since: string }
        Returns: string
      }
      track_event: {
        Args: {
          p_anon?: string
          p_name: string
          p_props?: Json
          p_source?: string
        }
        Returns: undefined
      }
      unassign_material: {
        Args: { p_material_id: string; p_student_id: string }
        Returns: undefined
      }
      unassign_writing_task: {
        Args: { p_student_id: string; p_task_id: string }
        Returns: undefined
      }
      update_lesson: {
        Args: {
          p_cards: string[]
          p_kind: string
          p_lesson: string
          p_link?: string
          p_minutes: number
          p_starts_at: string
          p_title?: string
        }
        Returns: undefined
      }
      update_series_from: {
        Args: {
          p_cards: string[]
          p_ends_on?: string
          p_every_weeks: number
          p_kind: string
          p_lesson: string
          p_link?: string
          p_minutes: number
          p_time: string
          p_title?: string
          p_weekdays: number[]
        }
        Returns: string
      }
      update_student_card: {
        Args: {
          p_card: string
          p_contact?: string
          p_name: string
          p_note?: string
        }
        Returns: undefined
      }
      writing_assigned_to: {
        Args: { s_id: string; w_id: string }
        Returns: boolean
      }
      writing_task_owned_by: {
        Args: { u_id: string; w_id: string }
        Returns: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
