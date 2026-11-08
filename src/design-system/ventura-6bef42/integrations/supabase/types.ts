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
      ai_credit_usage: {
        Row: {
          action: string
          created_at: string
          credits: number
          id: string
          pool: string
          program_id: string
          startup_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          credits: number
          id?: string
          pool: string
          program_id: string
          startup_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          credits?: number
          id?: string
          pool?: string
          program_id?: string
          startup_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_usage_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_followup_questions: {
        Row: {
          answer_text: string | null
          answered_at: string | null
          created_at: string
          field_target: string | null
          id: string
          priority: number
          question_text: string
          reason: string | null
          startup_id: string
          weekly_update_id: string
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          field_target?: string | null
          id?: string
          priority?: number
          question_text: string
          reason?: string | null
          startup_id: string
          weekly_update_id: string
        }
        Update: {
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          field_target?: string | null
          id?: string
          priority?: number
          question_text?: string
          reason?: string | null
          startup_id?: string
          weekly_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_followup_questions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          generated_profile_json: Json | null
          id: string
          raw_answers_json: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          generated_profile_json?: Json | null
          id?: string
          raw_answers_json: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          generated_profile_json?: Json | null
          id?: string
          raw_answers_json?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_profiles: {
        Row: {
          audiences: string[]
          bio: string | null
          coaching_areas: string[]
          company: string | null
          completed_at: string | null
          cover_url: string | null
          created_at: string
          engagement_type: string | null
          formats: string[]
          founder_problems: string[]
          full_name: string
          headline: string | null
          help_types: string[]
          hours_per_month: number | null
          industries: string[]
          involvement: string | null
          languages: string[]
          linkedin_url: string | null
          location: string | null
          motivations: string[]
          photo_url: string | null
          role_title: string | null
          stages: string[]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          audiences?: string[]
          bio?: string | null
          coaching_areas?: string[]
          company?: string | null
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          engagement_type?: string | null
          formats?: string[]
          founder_problems?: string[]
          full_name?: string
          headline?: string | null
          help_types?: string[]
          hours_per_month?: number | null
          industries?: string[]
          involvement?: string | null
          languages?: string[]
          linkedin_url?: string | null
          location?: string | null
          motivations?: string[]
          photo_url?: string | null
          role_title?: string | null
          stages?: string[]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          audiences?: string[]
          bio?: string | null
          coaching_areas?: string[]
          company?: string | null
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          engagement_type?: string | null
          formats?: string[]
          founder_problems?: string[]
          full_name?: string
          headline?: string | null
          help_types?: string[]
          hours_per_month?: number | null
          industries?: string[]
          involvement?: string | null
          languages?: string[]
          linkedin_url?: string | null
          location?: string | null
          motivations?: string[]
          photo_url?: string | null
          role_title?: string | null
          stages?: string[]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      coach_research: {
        Row: {
          best_fit_for: Json
          created_at: string
          error: string | null
          help_with: Json
          positioning: string | null
          researched_at: string | null
          sources: Json
          specialisations: Json
          status: string
          track_record: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          best_fit_for?: Json
          created_at?: string
          error?: string | null
          help_with?: Json
          positioning?: string | null
          researched_at?: string | null
          sources?: Json
          specialisations?: Json
          status?: string
          track_record?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          best_fit_for?: Json
          created_at?: string
          error?: string | null
          help_with?: Json
          positioning?: string | null
          researched_at?: string | null
          sources?: Json
          specialisations?: Json
          status?: string
          track_record?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          startup_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          startup_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_parse_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          manifest: Json | null
          pdf_path: string
          result: Json | null
          startup_id: string | null
          status: string
          thumbnail_paths: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          manifest?: Json | null
          pdf_path: string
          result?: Json | null
          startup_id?: string | null
          status?: string
          thumbnail_paths?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          manifest?: Json | null
          pdf_path?: string
          result?: Json | null
          startup_id?: string | null
          status?: string
          thumbnail_paths?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_parse_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          page_url: string | null
          screenshot_paths: string[]
          status: Database["public"]["Enums"]["feedback_status"]
          type: Database["public"]["Enums"]["feedback_type"]
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          screenshot_paths?: string[]
          status?: Database["public"]["Enums"]["feedback_status"]
          type: Database["public"]["Enums"]["feedback_type"]
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          screenshot_paths?: string[]
          status?: Database["public"]["Enums"]["feedback_status"]
          type?: Database["public"]["Enums"]["feedback_type"]
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      founder_accounts: {
        Row: {
          about: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          current_company: string | null
          current_position: string | null
          email: string
          full_name: string
          headline: string | null
          id: string
          industry: string | null
          onboarding_completed_at: string | null
          photo_url: string | null
          user_id: string
        }
        Insert: {
          about?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          current_company?: string | null
          current_position?: string | null
          email: string
          full_name: string
          headline?: string | null
          id?: string
          industry?: string | null
          onboarding_completed_at?: string | null
          photo_url?: string | null
          user_id: string
        }
        Update: {
          about?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          current_company?: string | null
          current_position?: string | null
          email?: string
          full_name?: string
          headline?: string | null
          id?: string
          industry?: string | null
          onboarding_completed_at?: string | null
          photo_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      founder_ai_conversations: {
        Row: {
          created_at: string
          id: string
          program_id: string
          startup_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          startup_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          startup_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_ai_conversations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_ai_conversations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_ai_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "founder_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_education: {
        Row: {
          created_at: string
          degree: string | null
          description: string | null
          end_date: string | null
          end_year: number | null
          field_of_study: string | null
          id: string
          is_current: boolean
          logo_url: string | null
          school: string
          sort_order: number
          start_date: string | null
          start_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_date?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          is_current?: boolean
          logo_url?: string | null
          school: string
          sort_order?: number
          start_date?: string | null
          start_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_date?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          is_current?: boolean
          logo_url?: string | null
          school?: string
          sort_order?: number
          start_date?: string | null
          start_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_experiences: {
        Row: {
          company: string
          created_at: string
          description: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean
          location: string | null
          logo_url: string | null
          sort_order: number
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          logo_url?: string | null
          sort_order?: number
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          logo_url?: string | null
          sort_order?: number
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_follows: {
        Row: {
          created_at: string
          follower_id: string
          founder_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          founder_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          founder_id?: string
          id?: string
        }
        Relationships: []
      }
      founder_generated_profiles: {
        Row: {
          created_at: string
          generated_profile_json: Json
          id: string
          raw_answers_json: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_profile_json?: Json
          id?: string
          raw_answers_json?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_profile_json?: Json
          id?: string
          raw_answers_json?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_history: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          icon_url: string | null
          id: string
          kind: string
          name: string
          organization: string | null
          start_date: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          icon_url?: string | null
          id?: string
          kind: string
          name: string
          organization?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          icon_url?: string | null
          id?: string
          kind?: string
          name?: string
          organization?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      founder_onboarding_answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          input_mode: string
          question_key: string
          question_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_text?: string
          created_at?: string
          id?: string
          input_mode?: string
          question_key: string
          question_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          input_mode?: string
          question_key?: string
          question_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_skills: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      founder_updates: {
        Row: {
          body: string
          created_at: string
          id: string
          startup_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          startup_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          startup_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goal_alerts: {
        Row: {
          completed_at: string | null
          created_at: string
          goal_text: string
          id: string
          last_checked_at: string | null
          last_checked_week: string | null
          sentence: string
          startup_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          goal_text: string
          id?: string
          last_checked_at?: string | null
          last_checked_week?: string | null
          sentence: string
          startup_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          goal_text?: string
          id?: string
          last_checked_at?: string | null
          last_checked_week?: string | null
          sentence?: string
          startup_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_alerts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          startup_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          startup_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          startup_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investor_profiles: {
        Row: {
          bio: string | null
          check_size: string | null
          company_types: string[]
          completed_at: string | null
          cover_url: string | null
          created_at: string
          deals_per_year: number | null
          earliness: number | null
          evaluation_priorities: string[]
          firm: string | null
          full_name: string
          headline: string | null
          industries: string[]
          intent: string | null
          linkedin_url: string | null
          location: string | null
          locations: string[]
          open_to: string[]
          photo_url: string | null
          role_title: string | null
          skip_signals: string[]
          stages: string[]
          ticket_max: number | null
          ticket_min: number | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          check_size?: string | null
          company_types?: string[]
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          deals_per_year?: number | null
          earliness?: number | null
          evaluation_priorities?: string[]
          firm?: string | null
          full_name?: string
          headline?: string | null
          industries?: string[]
          intent?: string | null
          linkedin_url?: string | null
          location?: string | null
          locations?: string[]
          open_to?: string[]
          photo_url?: string | null
          role_title?: string | null
          skip_signals?: string[]
          stages?: string[]
          ticket_max?: number | null
          ticket_min?: number | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          check_size?: string | null
          company_types?: string[]
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          deals_per_year?: number | null
          earliness?: number | null
          evaluation_priorities?: string[]
          firm?: string | null
          full_name?: string
          headline?: string | null
          industries?: string[]
          intent?: string | null
          linkedin_url?: string | null
          location?: string | null
          locations?: string[]
          open_to?: string[]
          photo_url?: string | null
          role_title?: string | null
          skip_signals?: string[]
          stages?: string[]
          ticket_max?: number | null
          ticket_min?: number | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      investor_research: {
        Row: {
          best_fit_for: Json
          created_at: string
          error: string | null
          help_with: Json
          positioning: string | null
          researched_at: string | null
          sources: Json
          specialisations: Json
          status: string
          track_record: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          best_fit_for?: Json
          created_at?: string
          error?: string | null
          help_with?: Json
          positioning?: string | null
          researched_at?: string | null
          sources?: Json
          specialisations?: Json
          status?: string
          track_record?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          best_fit_for?: Json
          created_at?: string
          error?: string | null
          help_with?: Json
          positioning?: string | null
          researched_at?: string | null
          sources?: Json
          specialisations?: Json
          status?: string
          track_record?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investor_startup_notes: {
        Row: {
          created_at: string
          id: string
          note: string | null
          startup_id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          startup_id: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          startup_id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_startup_notes_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_startup_views: {
        Row: {
          created_at: string
          id: string
          last_seen_update_id: string | null
          last_seen_week_of: string | null
          last_viewed_at: string
          startup_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_update_id?: string | null
          last_seen_week_of?: string | null
          last_viewed_at?: string
          startup_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_update_id?: string | null
          last_seen_week_of?: string | null
          last_viewed_at?: string
          startup_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_startup_views_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_update_reads: {
        Row: {
          created_at: string
          id: string
          read_at: string
          updated_at: string
          user_id: string
          weekly_update_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string
          updated_at?: string
          user_id: string
          weekly_update_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string
          updated_at?: string
          user_id?: string
          weekly_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_update_reads_weekly_update_id_fkey"
            columns: ["weekly_update_id"]
            isOneToOne: false
            referencedRelation: "weekly_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      mentors: {
        Row: {
          created_at: string
          enriched_at: string | null
          expertise_summary: string | null
          handle: string
          headline: string | null
          id: string
          industries: string[]
          linkedin_url: string
          location: string | null
          name: string | null
          photo_url: string | null
          raw_profile: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enriched_at?: string | null
          expertise_summary?: string | null
          handle: string
          headline?: string | null
          id?: string
          industries?: string[]
          linkedin_url: string
          location?: string | null
          name?: string | null
          photo_url?: string | null
          raw_profile?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enriched_at?: string | null
          expertise_summary?: string | null
          handle?: string
          headline?: string | null
          id?: string
          industries?: string[]
          linkedin_url?: string
          location?: string | null
          name?: string | null
          photo_url?: string | null
          raw_profile?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          body: string
          created_at: string
          id: string
          is_private: boolean
          read_at: string | null
          recipient_id: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"] | null
          startup_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          body: string
          created_at?: string
          id?: string
          is_private?: boolean
          read_at?: string | null
          recipient_id: string
          sender_id: string
          sender_role?: Database["public"]["Enums"]["app_role"] | null
          startup_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string
          created_at?: string
          id?: string
          is_private?: boolean
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["app_role"] | null
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_deck_openings: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_deck_openings_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email_notifications: boolean
          featured_startup_id: string | null
          founder_type: string | null
          full_name: string | null
          handle: string | null
          headline: string | null
          home_tour_seen_at: string | null
          id: string
          industries_interest: string[]
          investment_focus: string[]
          investor_role: string | null
          linkedin_url: string | null
          location: string | null
          organization: string | null
          pitch_deck_upload_count: number
          preferred_stages: string[]
          program_tour_seen_at: string | null
          regions: string[]
          skills: string[]
          ticket_max: number | null
          ticket_min: number | null
          updated_at: string
          verified: boolean
          website: string | null
          why_building: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email_notifications?: boolean
          featured_startup_id?: string | null
          founder_type?: string | null
          full_name?: string | null
          handle?: string | null
          headline?: string | null
          home_tour_seen_at?: string | null
          id: string
          industries_interest?: string[]
          investment_focus?: string[]
          investor_role?: string | null
          linkedin_url?: string | null
          location?: string | null
          organization?: string | null
          pitch_deck_upload_count?: number
          preferred_stages?: string[]
          program_tour_seen_at?: string | null
          regions?: string[]
          skills?: string[]
          ticket_max?: number | null
          ticket_min?: number | null
          updated_at?: string
          verified?: boolean
          website?: string | null
          why_building?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email_notifications?: boolean
          featured_startup_id?: string | null
          founder_type?: string | null
          full_name?: string | null
          handle?: string | null
          headline?: string | null
          home_tour_seen_at?: string | null
          id?: string
          industries_interest?: string[]
          investment_focus?: string[]
          investor_role?: string | null
          linkedin_url?: string | null
          location?: string | null
          organization?: string | null
          pitch_deck_upload_count?: number
          preferred_stages?: string[]
          program_tour_seen_at?: string | null
          regions?: string[]
          skills?: string[]
          ticket_max?: number | null
          ticket_min?: number | null
          updated_at?: string
          verified?: boolean
          website?: string | null
          why_building?: string | null
        }
        Relationships: []
      }
      program_ai_conversations: {
        Row: {
          created_at: string
          id: string
          program_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_ai_conversations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_ai_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          program_id: string
          role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          program_id: string
          role: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          program_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "program_ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_ai_messages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          program_id: string
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          program_id: string
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          program_id?: string
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_announcements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_coaches: {
        Row: {
          created_at: string
          email: string | null
          expertise: string[]
          expertise_summary: string | null
          headline: string | null
          id: string
          linkedin_url: string | null
          match_points: Json | null
          match_reason: string | null
          matched_startup_id: string | null
          name: string
          photo_url: string | null
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          expertise?: string[]
          expertise_summary?: string | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          match_points?: Json | null
          match_reason?: string | null
          matched_startup_id?: string | null
          name: string
          photo_url?: string | null
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          expertise?: string[]
          expertise_summary?: string | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          match_points?: Json | null
          match_reason?: string | null
          matched_startup_id?: string | null
          name?: string
          photo_url?: string | null
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_coaches_matched_startup_id_fkey"
            columns: ["matched_startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_coaches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_connection_matches: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          kind: string
          points: string[]
          program_id: string
          reason: string | null
          source: string
          startup_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          kind: string
          points?: string[]
          program_id: string
          reason?: string | null
          source?: string
          startup_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          kind?: string
          points?: string[]
          program_id?: string
          reason?: string | null
          source?: string
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_connection_matches_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "program_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_connection_matches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_connection_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      program_connection_requests: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          kind: string
          note: string | null
          program_id: string
          startup_id: string
          status: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          program_id: string
          startup_id: string
          status?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          program_id?: string
          startup_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_connection_requests_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "program_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_connection_requests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_connection_requests_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      program_connections: {
        Row: {
          created_at: string
          expertise: string[]
          headline: string | null
          id: string
          kind: string
          linkedin_url: string | null
          location: string | null
          name: string
          photo_url: string | null
          program_id: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          expertise?: string[]
          headline?: string | null
          id?: string
          kind: string
          linkedin_url?: string | null
          location?: string | null
          name: string
          photo_url?: string | null
          program_id: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          expertise?: string[]
          headline?: string | null
          id?: string
          kind?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string
          photo_url?: string | null
          program_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_connections_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_credentials: {
        Row: {
          created_at: string
          id: string
          last_login_at: string | null
          login_id: string
          password_hash: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_login_at?: string | null
          login_id: string
          password_hash: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_login_at?: string | null
          login_id?: string
          password_hash?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_credentials_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          program_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string
          program_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          program_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          program_id: string
          starts_at: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          program_id: string
          starts_at: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          program_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_investor_connections: {
        Row: {
          connected_at: string
          created_at: string
          external_name: string | null
          id: string
          investor_user_id: string | null
          note: string | null
          program_id: string
          startup_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          created_at?: string
          external_name?: string | null
          id?: string
          investor_user_id?: string | null
          note?: string | null
          program_id: string
          startup_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          created_at?: string
          external_name?: string | null
          id?: string
          investor_user_id?: string | null
          note?: string | null
          program_id?: string
          startup_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_investor_connections_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_investor_connections_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      program_invitations: {
        Row: {
          created_at: string
          id: string
          label: string | null
          program_id: string
          status: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          program_id: string
          status?: string
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          program_id?: string
          status?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_invitations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_kpi_assignments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number
          declined_at: string | null
          due_date_override: string | null
          id: string
          kpi_id: string
          postpone_reason: string | null
          postpone_request_reason: string | null
          postpone_request_status: string | null
          postpone_requested_at: string | null
          postpone_requested_by: string | null
          postponed_at: string | null
          program_id: string
          startup_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          declined_at?: string | null
          due_date_override?: string | null
          id?: string
          kpi_id: string
          postpone_reason?: string | null
          postpone_request_reason?: string | null
          postpone_request_status?: string | null
          postpone_requested_at?: string | null
          postpone_requested_by?: string | null
          postponed_at?: string | null
          program_id: string
          startup_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          declined_at?: string | null
          due_date_override?: string | null
          id?: string
          kpi_id?: string
          postpone_reason?: string | null
          postpone_request_reason?: string | null
          postpone_request_status?: string | null
          postpone_requested_at?: string | null
          postpone_requested_by?: string | null
          postponed_at?: string | null
          program_id?: string
          startup_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_kpi_assignments_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "program_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_kpi_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_kpi_assignments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      program_kpi_entries: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          note: string | null
          proof_file_name: string | null
          proof_path: string | null
          recorded_by_label: string
          recorded_by_user_id: string | null
          review_status: string | null
          reviewed_at: string | null
          submitted_for_check: boolean
          value: number
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          note?: string | null
          proof_file_name?: string | null
          proof_path?: string | null
          recorded_by_label?: string
          recorded_by_user_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          submitted_for_check?: boolean
          value: number
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          note?: string | null
          proof_file_name?: string | null
          proof_path?: string | null
          recorded_by_label?: string
          recorded_by_user_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          submitted_for_check?: boolean
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_kpi_entries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "program_kpi_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      program_kpis: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          program_id: string
          proof_required: boolean
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          program_id: string
          proof_required?: boolean
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          program_id?: string
          proof_required?: boolean
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_kpis_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          program_id: string
          startup_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          program_id: string
          startup_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          program_id?: string
          startup_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_notes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_notes_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      program_startups: {
        Row: {
          coach_id: string | null
          coach_name: string | null
          created_at: string
          id: string
          investor_ready: boolean
          joined_at: string | null
          program_id: string
          startup_id: string
          status: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          coach_id?: string | null
          coach_name?: string | null
          created_at?: string
          id?: string
          investor_ready?: boolean
          joined_at?: string | null
          program_id: string
          startup_id: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string | null
          coach_name?: string | null
          created_at?: string
          id?: string
          investor_ready?: boolean
          joined_at?: string | null
          program_id?: string
          startup_id?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_startups_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "program_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_startups_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_startups_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      program_update_reviews: {
        Row: {
          id: string
          program_id: string
          reviewed_at: string
          startup_id: string
          week_of: string
        }
        Insert: {
          id?: string
          program_id: string
          reviewed_at?: string
          startup_id: string
          week_of: string
        }
        Update: {
          id?: string
          program_id?: string
          reviewed_at?: string
          startup_id?: string
          week_of?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          background_mode: string
          cohort_start_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          background_mode?: string
          cohort_start_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          background_mode?: string
          cohort_start_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          parts: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parts?: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "role_assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assistant_threads: {
        Row: {
          created_at: string
          id: string
          role: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_home_matches: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          profile_fingerprint: string
          rank: number
          reasons: Json
          role: string
          score: number
          startup_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          profile_fingerprint: string
          rank: number
          reasons?: Json
          role: string
          score?: number
          startup_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          profile_fingerprint?: string
          rank?: number
          reasons?: Json
          role?: string
          score?: number
          startup_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_home_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      role_home_shuffle_state: {
        Row: {
          created_at: string
          excluded_startup_ids: string[]
          role: string
          shuffle_date: string
          updated_at: string
          user_id: string
          uses: number
        }
        Insert: {
          created_at?: string
          excluded_startup_ids?: string[]
          role: string
          shuffle_date?: string
          updated_at?: string
          user_id: string
          uses?: number
        }
        Update: {
          created_at?: string
          excluded_startup_ids?: string[]
          role?: string
          shuffle_date?: string
          updated_at?: string
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      saves: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      site_announcements: {
        Row: {
          enabled: boolean
          id: string
          message: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      startup_ai_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          kind: string
          position: number
          program_id: string | null
          source_label: string | null
          startup_id: string
          title: string
          url: string | null
          week_of: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          position: number
          program_id?: string | null
          source_label?: string | null
          startup_id: string
          title: string
          url?: string | null
          week_of: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          position?: number
          program_id?: string | null
          source_label?: string | null
          startup_id?: string
          title?: string
          url?: string | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_ai_resources_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_ai_resources_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_analytics_snapshots: {
        Row: {
          activity_trend_json: Json
          ai_recommendations_json: Json
          created_at: string
          customer_growth_json: Json
          id: string
          revenue_growth_json: Json
          risk_analysis_json: Json
          sales_funnel_json: Json
          snapshot_type: string
          startup_id: string
          weekly_update_id: string
        }
        Insert: {
          activity_trend_json?: Json
          ai_recommendations_json?: Json
          created_at?: string
          customer_growth_json?: Json
          id?: string
          revenue_growth_json?: Json
          risk_analysis_json?: Json
          sales_funnel_json?: Json
          snapshot_type: string
          startup_id: string
          weekly_update_id: string
        }
        Update: {
          activity_trend_json?: Json
          ai_recommendations_json?: Json
          created_at?: string
          customer_growth_json?: Json
          id?: string
          revenue_growth_json?: Json
          risk_analysis_json?: Json
          sales_funnel_json?: Json
          snapshot_type?: string
          startup_id?: string
          weekly_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_analytics_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_badges: {
        Row: {
          code: string
          earned_at: string
          id: string
          meta: Json
          startup_id: string
        }
        Insert: {
          code: string
          earned_at?: string
          id?: string
          meta?: Json
          startup_id: string
        }
        Update: {
          code?: string
          earned_at?: string
          id?: string
          meta?: Json
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_badges_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_drafts: {
        Row: {
          created_at: string
          data: Json
          id: string
          source_job_id: string | null
          startup_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          source_job_id?: string | null
          startup_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          source_job_id?: string | null
          startup_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_drafts_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "deck_parse_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_drafts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_follows: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_follows_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          startup_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          startup_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          startup_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_invitations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_match_suggestions: {
        Row: {
          connection_id: string | null
          created_at: string
          headline: string | null
          id: string
          intro_requested: boolean
          kind: string
          linkedin_url: string | null
          name: string
          photo_url: string | null
          program_id: string
          rank: number
          reason: string | null
          source: string
          startup_id: string
          ventura_handle: string | null
          ventura_user_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          intro_requested?: boolean
          kind: string
          linkedin_url?: string | null
          name: string
          photo_url?: string | null
          program_id: string
          rank?: number
          reason?: string | null
          source?: string
          startup_id: string
          ventura_handle?: string | null
          ventura_user_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          intro_requested?: boolean
          kind?: string
          linkedin_url?: string | null
          name?: string
          photo_url?: string | null
          program_id?: string
          rank?: number
          reason?: string | null
          source?: string
          startup_id?: string
          ventura_handle?: string | null
          ventura_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_match_suggestions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "program_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_match_suggestions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_match_suggestions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_members: {
        Row: {
          created_at: string
          id: string
          role: string
          startup_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          startup_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          startup_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_members_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_private_metrics: {
        Row: {
          confidence: string | null
          created_at: string
          delta_numeric: number | null
          delta_percent: number | null
          id: string
          metric_category: string
          metric_name: string
          numeric_value: number | null
          previous_numeric_value: number | null
          source_type: string
          startup_id: string
          unit: string | null
          value: string | null
          weekly_update_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          delta_numeric?: number | null
          delta_percent?: number | null
          id?: string
          metric_category: string
          metric_name: string
          numeric_value?: number | null
          previous_numeric_value?: number | null
          source_type?: string
          startup_id: string
          unit?: string | null
          value?: string | null
          weekly_update_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          delta_numeric?: number | null
          delta_percent?: number | null
          id?: string
          metric_category?: string
          metric_name?: string
          numeric_value?: number | null
          previous_numeric_value?: number | null
          source_type?: string
          startup_id?: string
          unit?: string | null
          value?: string | null
          weekly_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_private_metrics_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_profile_requests: {
        Row: {
          created_at: string
          id: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      startup_progression_cards: {
        Row: {
          card_type: string
          created_at: string
          description: string | null
          display_order: number
          icon_name: string | null
          id: string
          image_url: string | null
          is_public: boolean
          label: string
          numeric_value: number | null
          previous_value: string | null
          source_type: string
          startup_id: string
          subtitle: string | null
          updated_at: string
          value: string | null
          weekly_delta: string | null
          weekly_update_id: string
        }
        Insert: {
          card_type: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          label: string
          numeric_value?: number | null
          previous_value?: string | null
          source_type?: string
          startup_id: string
          subtitle?: string | null
          updated_at?: string
          value?: string | null
          weekly_delta?: string | null
          weekly_update_id: string
        }
        Update: {
          card_type?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          label?: string
          numeric_value?: number | null
          previous_value?: string | null
          source_type?: string
          startup_id?: string
          subtitle?: string | null
          updated_at?: string
          value?: string | null
          weekly_delta?: string | null
          weekly_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_progression_cards_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_tracked_questions: {
        Row: {
          created_at: string
          is_hidden: boolean
          question: string
          slot: number
          startup_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_hidden?: boolean
          question: string
          slot: number
          startup_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_hidden?: boolean
          question?: string
          slot?: number
          startup_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_tracked_questions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_views: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_views_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_weekly_goals: {
        Row: {
          author_id: string
          carried_from_goal_id: string | null
          created_at: string
          drop_reason: string | null
          id: string
          order_index: number
          program_kpi_id: string | null
          source_label: string | null
          startup_id: string
          status: Database["public"]["Enums"]["weekly_goal_status"]
          title: string
          updated_at: string
          week_of: string
          xp_awarded: number
        }
        Insert: {
          author_id: string
          carried_from_goal_id?: string | null
          created_at?: string
          drop_reason?: string | null
          id?: string
          order_index?: number
          program_kpi_id?: string | null
          source_label?: string | null
          startup_id: string
          status?: Database["public"]["Enums"]["weekly_goal_status"]
          title: string
          updated_at?: string
          week_of: string
          xp_awarded?: number
        }
        Update: {
          author_id?: string
          carried_from_goal_id?: string | null
          created_at?: string
          drop_reason?: string | null
          id?: string
          order_index?: number
          program_kpi_id?: string | null
          source_label?: string | null
          startup_id?: string
          status?: Database["public"]["Enums"]["weekly_goal_status"]
          title?: string
          updated_at?: string
          week_of?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "startup_weekly_goals_carried_from_goal_id_fkey"
            columns: ["carried_from_goal_id"]
            isOneToOne: false
            referencedRelation: "startup_weekly_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_weekly_goals_program_kpi_id_fkey"
            columns: ["program_kpi_id"]
            isOneToOne: false
            referencedRelation: "program_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_weekly_goals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_xp_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          meta: Json
          startup_id: string
          user_id: string | null
          week_of: string | null
          xp: number
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          meta?: Json
          startup_id: string
          user_id?: string | null
          week_of?: string | null
          xp?: number
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          meta?: Json
          startup_id?: string
          user_id?: string | null
          week_of?: string | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "startup_xp_events_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startups: {
        Row: {
          accelerator: string | null
          attachments: Json | null
          business_id: string | null
          business_model_tags: string[] | null
          competitive_advantage: string | null
          competitors: string[] | null
          country: string | null
          created_at: string
          customers_and_users: string | null
          description: string | null
          discovery_order: number | null
          executive_summary: string | null
          founder_story: string | null
          header_image_url: string | null
          hidden_from_discovery: boolean
          id: string
          industry: string | null
          industry_tags: string[] | null
          investment_case: string | null
          investor_readiness: string | null
          is_demo: boolean
          is_paused: boolean
          is_primary: boolean
          is_published: boolean
          is_registered: boolean | null
          location: string | null
          logo_url: string | null
          looking_for: string | null
          market: string | null
          missing_information: string[] | null
          name: string
          one_liner: string | null
          owner_id: string
          paused_at: string | null
          pinned_badge_code: string | null
          pitch_deck_path: string | null
          pitch_deck_url: string | null
          pitch_video_duration: number | null
          pitch_video_status: string | null
          pitch_video_uid: string | null
          problem: string | null
          program_logos: Json
          published_at: string | null
          slug: string
          solution: string | null
          stage: string | null
          tagline: string | null
          team_members: Json | null
          traction: string | null
          updated_at: string
          video_url: string | null
          website: string | null
        }
        Insert: {
          accelerator?: string | null
          attachments?: Json | null
          business_id?: string | null
          business_model_tags?: string[] | null
          competitive_advantage?: string | null
          competitors?: string[] | null
          country?: string | null
          created_at?: string
          customers_and_users?: string | null
          description?: string | null
          discovery_order?: number | null
          executive_summary?: string | null
          founder_story?: string | null
          header_image_url?: string | null
          hidden_from_discovery?: boolean
          id?: string
          industry?: string | null
          industry_tags?: string[] | null
          investment_case?: string | null
          investor_readiness?: string | null
          is_demo?: boolean
          is_paused?: boolean
          is_primary?: boolean
          is_published?: boolean
          is_registered?: boolean | null
          location?: string | null
          logo_url?: string | null
          looking_for?: string | null
          market?: string | null
          missing_information?: string[] | null
          name: string
          one_liner?: string | null
          owner_id: string
          paused_at?: string | null
          pinned_badge_code?: string | null
          pitch_deck_path?: string | null
          pitch_deck_url?: string | null
          pitch_video_duration?: number | null
          pitch_video_status?: string | null
          pitch_video_uid?: string | null
          problem?: string | null
          program_logos?: Json
          published_at?: string | null
          slug: string
          solution?: string | null
          stage?: string | null
          tagline?: string | null
          team_members?: Json | null
          traction?: string | null
          updated_at?: string
          video_url?: string | null
          website?: string | null
        }
        Update: {
          accelerator?: string | null
          attachments?: Json | null
          business_id?: string | null
          business_model_tags?: string[] | null
          competitive_advantage?: string | null
          competitors?: string[] | null
          country?: string | null
          created_at?: string
          customers_and_users?: string | null
          description?: string | null
          discovery_order?: number | null
          executive_summary?: string | null
          founder_story?: string | null
          header_image_url?: string | null
          hidden_from_discovery?: boolean
          id?: string
          industry?: string | null
          industry_tags?: string[] | null
          investment_case?: string | null
          investor_readiness?: string | null
          is_demo?: boolean
          is_paused?: boolean
          is_primary?: boolean
          is_published?: boolean
          is_registered?: boolean | null
          location?: string | null
          logo_url?: string | null
          looking_for?: string | null
          market?: string | null
          missing_information?: string[] | null
          name?: string
          one_liner?: string | null
          owner_id?: string
          paused_at?: string | null
          pinned_badge_code?: string | null
          pitch_deck_path?: string | null
          pitch_deck_url?: string | null
          pitch_video_duration?: number | null
          pitch_video_status?: string | null
          pitch_video_uid?: string | null
          problem?: string | null
          program_logos?: Json
          published_at?: string | null
          slug?: string
          solution?: string | null
          stage?: string | null
          tagline?: string | null
          team_members?: Json | null
          traction?: string | null
          updated_at?: string
          video_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          context: string | null
          created_at: string
          href: string | null
          id: string
          kind: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          context?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          context?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_seen_badges: {
        Row: {
          badge_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          vc_fund: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          vc_fund?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          vc_fund?: string | null
        }
        Relationships: []
      }
      weekly_customer_conversations: {
        Row: {
          created_at: string
          customers_talked_to: number
          founder_id: string
          id: string
          question: string | null
          slot: number
          startup_id: string
          updated_at: string
          week_of: string
        }
        Insert: {
          created_at?: string
          customers_talked_to: number
          founder_id: string
          id?: string
          question?: string | null
          slot?: number
          startup_id: string
          updated_at?: string
          week_of: string
        }
        Update: {
          created_at?: string
          customers_talked_to?: number
          founder_id?: string
          id?: string
          question?: string | null
          slot?: number
          startup_id?: string
          updated_at?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_customer_conversations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_step_completions: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          step: string
          updated_at: string
          user_id: string
          week_of: string
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          step: string
          updated_at?: string
          user_id: string
          week_of: string
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          step?: string
          updated_at?: string
          user_id?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_step_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_update_attachments: {
        Row: {
          author_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          startup_id: string
          storage_path: string
          weekly_update_id: string | null
        }
        Insert: {
          author_id: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          startup_id: string
          storage_path: string
          weekly_update_id?: string | null
        }
        Update: {
          author_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          startup_id?: string
          storage_path?: string
          weekly_update_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_update_attachments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_update_attachments_weekly_update_id_fkey"
            columns: ["weekly_update_id"]
            isOneToOne: false
            referencedRelation: "weekly_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_update_sessions: {
        Row: {
          completion_percent: number
          created_at: string
          current_ai_question: string | null
          ended_at: string | null
          founder_id: string
          id: string
          session_status: string
          started_at: string
          startup_id: string
          total_recording_seconds: number
          transcript_final: string | null
          transcript_partial: string | null
          weekly_update_id: string | null
        }
        Insert: {
          completion_percent?: number
          created_at?: string
          current_ai_question?: string | null
          ended_at?: string | null
          founder_id: string
          id?: string
          session_status?: string
          started_at?: string
          startup_id: string
          total_recording_seconds?: number
          transcript_final?: string | null
          transcript_partial?: string | null
          weekly_update_id?: string | null
        }
        Update: {
          completion_percent?: number
          created_at?: string
          current_ai_question?: string | null
          ended_at?: string | null
          founder_id?: string
          id?: string
          session_status?: string
          started_at?: string
          startup_id?: string
          total_recording_seconds?: number
          transcript_final?: string | null
          transcript_partial?: string | null
          weekly_update_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_update_sessions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_update_sessions_weekly_update_id_fkey"
            columns: ["weekly_update_id"]
            isOneToOne: false
            referencedRelation: "weekly_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_updates: {
        Row: {
          author_id: string
          content: Json
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          recording_seconds: number
          startup_id: string
          status: string
          summary: string | null
          title: string | null
          transcript: string | null
          updated_at: string
          week_of: string
        }
        Insert: {
          author_id: string
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          recording_seconds?: number
          startup_id: string
          status?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          week_of?: string
        }
        Update: {
          author_id?: string
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          recording_seconds?: number
          startup_id?: string
          status?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_updates_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_stale_weekly_drafts: {
        Args: { _startup_id: string }
        Returns: undefined
      }
      generate_unique_handle: { Args: { _base: string }; Returns: string }
      get_startup_public_goal_stats: {
        Args: { _startup_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_program_member: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_startup_member: {
        Args: { _program_id: string; _startup_id: string; _user_id: string }
        Returns: boolean
      }
      is_public_founder: { Args: { _user_id: string }; Returns: boolean }
      is_startup_member: {
        Args: { _startup_id: string; _user_id: string }
        Returns: boolean
      }
      is_startup_team: {
        Args: { _startup_id: string; _user_id: string }
        Returns: boolean
      }
      is_verified_investor: { Args: { _user_id: string }; Returns: boolean }
      startup_current_week_start: {
        Args: { _startup_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "founder" | "investor" | "admin" | "mentor"
      feedback_status: "open" | "in_progress" | "resolved"
      feedback_type: "bug" | "feature"
      weekly_goal_status: "pending" | "done" | "carried_over" | "dropped"
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
    Enums: {
      app_role: ["founder", "investor", "admin", "mentor"],
      feedback_status: ["open", "in_progress", "resolved"],
      feedback_type: ["bug", "feature"],
      weekly_goal_status: ["pending", "done", "carried_over", "dropped"],
    },
  },
} as const
