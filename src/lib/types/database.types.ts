export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          staff_note: string | null
          status: Database["public"]["Enums"]["deletion_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          staff_note?: string | null
          status?: Database["public"]["Enums"]["deletion_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          staff_note?: string | null
          status?: Database["public"]["Enums"]["deletion_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_calendar_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_at: string
          id: string
          location: string | null
          reminder_minutes_before: number | null
          reminder_sent_at: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_at: string
          id?: string
          location?: string | null
          reminder_minutes_before?: number | null
          reminder_sent_at?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string
          id?: string
          location?: string | null
          reminder_minutes_before?: number | null
          reminder_sent_at?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_applications: {
        Row: {
          applicant_id: string
          assigned_reviewer: string | null
          business_details: Json
          created_at: string
          document_refs: Json
          id: string
          internal_notes: string | null
          notes: string | null
          reference_number: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
        }
        Insert: {
          applicant_id: string
          assigned_reviewer?: string | null
          business_details?: Json
          created_at?: string
          document_refs?: Json
          id?: string
          internal_notes?: string | null
          notes?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
        }
        Update: {
          applicant_id?: string
          assigned_reviewer?: string | null
          business_details?: Json
          created_at?: string
          document_refs?: Json
          id?: string
          internal_notes?: string | null
          notes?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_applications_assigned_reviewer_fkey"
            columns: ["assigned_reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          link_id: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          link_id: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          link_id?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          affiliate_id: string
          click_id: string | null
          commission_amount: number
          created_at: string
          id: string
          order_id: string
          status: Database["public"]["Enums"]["conversion_status"]
        }
        Insert: {
          affiliate_id: string
          click_id?: string | null
          commission_amount: number
          created_at?: string
          id?: string
          order_id: string
          status?: Database["public"]["Enums"]["conversion_status"]
        }
        Update: {
          affiliate_id?: string
          click_id?: string | null
          commission_amount?: number
          created_at?: string
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["conversion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          affiliate_id: string
          campaign_name: string | null
          clicks_count: number
          code: string
          created_at: string
          id: string
          target_path: string
        }
        Insert: {
          affiliate_id: string
          campaign_name?: string | null
          clicks_count?: number
          code: string
          created_at?: string
          id?: string
          target_path?: string
        }
        Update: {
          affiliate_id?: string
          campaign_name?: string | null
          clicks_count?: number
          code?: string
          created_at?: string
          id?: string
          target_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          payout_details: Json
          profile_id: string
          referral_code: string
          status: Database["public"]["Enums"]["agency_status"]
          total_earned: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          payout_details?: Json
          profile_id: string
          referral_code: string
          status?: Database["public"]["Enums"]["agency_status"]
          total_earned?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          payout_details?: Json
          profile_id?: string
          referral_code?: string
          status?: Database["public"]["Enums"]["agency_status"]
          total_earned?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          allowed_products: Database["public"]["Enums"]["order_item_type"][]
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          commission_rate: number
          commission_rate_set_at: string | null
          contact_email: string
          contact_phone: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          credit_balance: number
          credit_limit: number
          id: string
          legal_name: string | null
          logo_path: string | null
          low_balance_threshold: number
          name: string
          registration_number: string | null
          status: Database["public"]["Enums"]["agency_status"]
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_products?: Database["public"]["Enums"]["order_item_type"][]
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          commission_rate?: number
          commission_rate_set_at?: string | null
          contact_email: string
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          credit_balance?: number
          credit_limit?: number
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          low_balance_threshold?: number
          name: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["agency_status"]
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_products?: Database["public"]["Enums"]["order_item_type"][]
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          commission_rate?: number
          commission_rate_set_at?: string | null
          contact_email?: string
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          credit_balance?: number
          credit_limit?: number
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          low_balance_threshold?: number
          name?: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["agency_status"]
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "agency_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_applications: {
        Row: {
          agency_name: string
          applicant_id: string
          assigned_reviewer: string | null
          business_details: Json
          created_at: string
          document_refs: Json
          id: string
          internal_notes: string | null
          reference_number: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
        }
        Insert: {
          agency_name: string
          applicant_id: string
          assigned_reviewer?: string | null
          business_details?: Json
          created_at?: string
          document_refs?: Json
          id?: string
          internal_notes?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
        }
        Update: {
          agency_name?: string
          applicant_id?: string
          assigned_reviewer?: string | null
          business_details?: Json
          created_at?: string
          document_refs?: Json
          id?: string
          internal_notes?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_applications_assigned_reviewer_fkey"
            columns: ["assigned_reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_commission_entries: {
        Row: {
          agency_id: string
          amount: number
          commission_amount: number
          created_at: string
          id: string
          markup_amount: number
          order_id: string
          rate_applied: number
          status: Database["public"]["Enums"]["commission_entry_status"]
        }
        Insert: {
          agency_id: string
          amount: number
          commission_amount: number
          created_at?: string
          id?: string
          markup_amount?: number
          order_id: string
          rate_applied: number
          status?: Database["public"]["Enums"]["commission_entry_status"]
        }
        Update: {
          agency_id?: string
          amount?: number
          commission_amount?: number
          created_at?: string
          id?: string
          markup_amount?: number
          order_id?: string
          rate_applied?: number
          status?: Database["public"]["Enums"]["commission_entry_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agency_commission_entries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_commission_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_commission_payouts: {
        Row: {
          agency_id: string
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          method: string | null
          paid_at: string
          payout_reference: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          agency_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string
          payout_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          agency_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string
          payout_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agency_commission_payouts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_commission_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_customers: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_customers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_markups: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          item_type: Database["public"]["Enums"]["order_item_type"] | null
          markup_type: Database["public"]["Enums"]["markup_type"]
          updated_at: string
          value: number
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"] | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          updated_at?: string
          value: number
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"] | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "agency_markups_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          profile_id: string
          role_in_agency: Database["public"]["Enums"]["agency_role"]
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          profile_id: string
          role_in_agency?: Database["public"]["Enums"]["agency_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          role_in_agency?: Database["public"]["Enums"]["agency_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_refund_requests: {
        Row: {
          agency_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string | null
          reason: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["refund_request_status"]
          wallet_transaction_id: string | null
        }
        Insert: {
          agency_id: string
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          reason: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_request_status"]
          wallet_transaction_id?: string | null
        }
        Update: {
          agency_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          reason?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_request_status"]
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_refund_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_refund_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_refund_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_refund_requests_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "agency_wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_tiers: {
        Row: {
          created_at: string
          default_commission_rate: number
          default_credit_limit: number
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_commission_rate?: number
          default_credit_limit?: number
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_commission_rate?: number
          default_credit_limit?: number
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      agency_wallet_transactions: {
        Row: {
          agency_id: string
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          document_number: string | null
          id: string
          note: string | null
          order_id: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Insert: {
          agency_id: string
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Update: {
          agency_id?: string
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "agency_wallet_transactions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_wallet_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      airlines: {
        Row: {
          iata_code: string
          icao_code: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          iata_code: string
          icao_code?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          iata_code?: string
          icao_code?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      airports: {
        Row: {
          city: string
          country_code: string
          iata_code: string
          icao_code: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          timezone: string | null
        }
        Insert: {
          city: string
          country_code: string
          iata_code: string
          icao_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          timezone?: string | null
        }
        Update: {
          city?: string
          country_code?: string
          iata_code?: string
          icao_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          timezone?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          approved_amount: number | null
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["booking_request_kind"]
          order_id: string
          reason: string
          requested_amount: number | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          staff_note: string | null
          status: Database["public"]["Enums"]["booking_request_status"]
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["booking_request_kind"]
          order_id: string
          reason: string
          requested_amount?: number | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          staff_note?: string | null
          status?: Database["public"]["Enums"]["booking_request_status"]
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_request_kind"]
          order_id?: string
          reason?: string
          requested_amount?: number | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          staff_note?: string | null
          status?: Database["public"]["Enums"]["booking_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payout_reference: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payout_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payout_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_venues: {
        Row: {
          address: string | null
          amenities: Json
          base_price: number
          capacity_seated: number | null
          capacity_standing: number | null
          city: string
          country_code: string
          created_at: string
          currency: string
          description: string | null
          event_types: Json
          id: string
          images: Json
          is_featured: boolean
          name: string
          price_unit: string
          size_sqm: number | null
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          tagline: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: Json
          base_price: number
          capacity_seated?: number | null
          capacity_standing?: number | null
          city: string
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          event_types?: Json
          id?: string
          images?: Json
          is_featured?: boolean
          name: string
          price_unit?: string
          size_sqm?: number | null
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: Json
          base_price?: number
          capacity_seated?: number | null
          capacity_standing?: number | null
          city?: string
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          event_types?: Json
          id?: string
          images?: Json
          is_featured?: boolean
          name?: string
          price_unit?: string
          size_sqm?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      flight_bookings: {
        Row: {
          agency_id: string | null
          booked_by: string
          cabin_class: string
          created_at: string
          currency: string
          customer_id: string
          depart_at: string
          destination_iata: string
          id: string
          origin_iata: string
          provider: string
          provider_booking_ref: string | null
          raw_payload: Json
          return_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          booked_by: string
          cabin_class?: string
          created_at?: string
          currency?: string
          customer_id: string
          depart_at: string
          destination_iata: string
          id?: string
          origin_iata: string
          provider: string
          provider_booking_ref?: string | null
          raw_payload?: Json
          return_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          booked_by?: string
          cabin_class?: string
          created_at?: string
          currency?: string
          customer_id?: string
          depart_at?: string
          destination_iata?: string
          id?: string
          origin_iata?: string
          provider?: string
          provider_booking_ref?: string | null
          raw_payload?: Json
          return_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_bookings_destination_iata_fkey"
            columns: ["destination_iata"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["iata_code"]
          },
          {
            foreignKeyName: "flight_bookings_origin_iata_fkey"
            columns: ["origin_iata"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["iata_code"]
          },
        ]
      }
      flight_offers: {
        Row: {
          airline_id: string | null
          arrive_at: string
          cabin_class: string
          created_at: string
          currency: string
          depart_at: string
          destination_iata: string
          expires_at: string
          flight_number: string | null
          id: string
          origin_iata: string
          price: number
          provider: string
          provider_offer_id: string
          raw_payload: Json
        }
        Insert: {
          airline_id?: string | null
          arrive_at: string
          cabin_class?: string
          created_at?: string
          currency?: string
          depart_at: string
          destination_iata: string
          expires_at: string
          flight_number?: string | null
          id?: string
          origin_iata: string
          price: number
          provider: string
          provider_offer_id: string
          raw_payload?: Json
        }
        Update: {
          airline_id?: string | null
          arrive_at?: string
          cabin_class?: string
          created_at?: string
          currency?: string
          depart_at?: string
          destination_iata?: string
          expires_at?: string
          flight_number?: string | null
          id?: string
          origin_iata?: string
          price?: number
          provider?: string
          provider_offer_id?: string
          raw_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "flight_offers_airline_id_fkey"
            columns: ["airline_id"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_offers_destination_iata_fkey"
            columns: ["destination_iata"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["iata_code"]
          },
          {
            foreignKeyName: "flight_offers_origin_iata_fkey"
            columns: ["origin_iata"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["iata_code"]
          },
        ]
      }
      flight_passengers: {
        Row: {
          booking_id: string
          date_of_birth: string | null
          full_name: string
          id: string
          meal_preference: string | null
          nationality: string | null
          passenger_type: Database["public"]["Enums"]["passenger_type"]
          passport_expiry: string | null
          passport_number: string | null
          seat_preference: string | null
        }
        Insert: {
          booking_id: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          meal_preference?: string | null
          nationality?: string | null
          passenger_type?: Database["public"]["Enums"]["passenger_type"]
          passport_expiry?: string | null
          passport_number?: string | null
          seat_preference?: string | null
        }
        Update: {
          booking_id?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          meal_preference?: string | null
          nationality?: string | null
          passenger_type?: Database["public"]["Enums"]["passenger_type"]
          passport_expiry?: string | null
          passport_number?: string | null
          seat_preference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_passengers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "flight_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          as_of: string
          base_currency: string
          quote_currency: string
          rate: number
          source: string
          updated_at: string
        }
        Insert: {
          as_of?: string
          base_currency: string
          quote_currency: string
          rate: number
          source?: string
          updated_at?: string
        }
        Update: {
          as_of?: string
          base_currency?: string
          quote_currency?: string
          rate?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      hall_bookings: {
        Row: {
          admin_notes: string | null
          agency_id: string | null
          booked_by: string
          booking_ref: string
          created_at: string
          currency: string
          customer_id: string
          customer_notes: string | null
          end_date: string
          end_time: string | null
          event_name: string | null
          event_type: string
          expected_guests: number | null
          id: string
          price: number
          setup_requirements: string | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          admin_notes?: string | null
          agency_id?: string | null
          booked_by: string
          booking_ref?: string
          created_at?: string
          currency?: string
          customer_id: string
          customer_notes?: string | null
          end_date: string
          end_time?: string | null
          event_name?: string | null
          event_type: string
          expected_guests?: number | null
          id?: string
          price?: number
          setup_requirements?: string | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          admin_notes?: string | null
          agency_id?: string | null
          booked_by?: string
          booking_ref?: string
          created_at?: string
          currency?: string
          customer_id?: string
          customer_notes?: string | null
          end_date?: string
          end_time?: string | null
          event_name?: string | null
          event_type?: string
          expected_guests?: number | null
          id?: string
          price?: number
          setup_requirements?: string | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_bookings: {
        Row: {
          agency_id: string | null
          booked_by: string
          check_in: string
          check_out: string
          created_at: string
          currency: string
          customer_id: string
          guest_details: Json
          hotel_id: string
          id: string
          num_adults: number
          num_children: number
          num_rooms: number
          room_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          booked_by: string
          check_in: string
          check_out: string
          created_at?: string
          currency?: string
          customer_id: string
          guest_details?: Json
          hotel_id: string
          id?: string
          num_adults?: number
          num_children?: number
          num_rooms?: number
          room_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          booked_by?: string
          check_in?: string
          check_out?: string
          created_at?: string
          currency?: string
          customer_id?: string
          guest_details?: Json
          hotel_id?: string
          id?: string
          num_adults?: number
          num_children?: number
          num_rooms?: number
          room_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_partner_applications: {
        Row: {
          applicant_id: string
          assigned_reviewer: string | null
          business_details: Json
          business_name: string
          created_at: string
          document_refs: Json
          id: string
          internal_notes: string | null
          reference_number: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
        }
        Insert: {
          applicant_id: string
          assigned_reviewer?: string | null
          business_details?: Json
          business_name: string
          created_at?: string
          document_refs?: Json
          id?: string
          internal_notes?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
        }
        Update: {
          applicant_id?: string
          assigned_reviewer?: string | null
          business_details?: Json
          business_name?: string
          created_at?: string
          document_refs?: Json
          id?: string
          internal_notes?: string | null
          reference_number?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_partner_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_partner_applications_assigned_reviewer_fkey"
            columns: ["assigned_reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_partner_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_partner_members: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          profile_id: string
          role_in_partner: Database["public"]["Enums"]["agency_member_role"]
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          profile_id: string
          role_in_partner?: Database["public"]["Enums"]["agency_member_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          profile_id?: string
          role_in_partner?: Database["public"]["Enums"]["agency_member_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "hotel_partner_members_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "hotel_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_partner_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_partners: {
        Row: {
          commission_rate: number
          contact_email: string
          contact_phone: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          legal_name: string | null
          name: string
          status: Database["public"]["Enums"]["agency_status"]
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          contact_email: string
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          name: string
          status?: Database["public"]["Enums"]["agency_status"]
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          contact_email?: string
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          status?: Database["public"]["Enums"]["agency_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_room_inventory: {
        Row: {
          booked_units: number
          date: string
          id: string
          price_override: number | null
          room_id: string
          total_units: number
        }
        Insert: {
          booked_units?: number
          date: string
          id?: string
          price_override?: number | null
          room_id: string
          total_units: number
        }
        Update: {
          booked_units?: number
          date?: string
          id?: string
          price_override?: number | null
          room_id?: string
          total_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_room_inventory_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rooms: {
        Row: {
          amenities: Json
          base_price: number
          bed_type: string | null
          created_at: string
          currency: string
          description: string | null
          hotel_id: string
          id: string
          images: Json
          max_occupancy: number
          name: string
          size_sqm: number | null
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }
        Insert: {
          amenities?: Json
          base_price: number
          bed_type?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          hotel_id: string
          id?: string
          images?: Json
          max_occupancy?: number
          name: string
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Update: {
          amenities?: Json
          base_price?: number
          bed_type?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          hotel_id?: string
          id?: string
          images?: Json
          max_occupancy?: number
          name?: string
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address_line: string | null
          amenities: Json
          city: string
          country_code: string
          created_at: string
          description: string | null
          id: string
          images: Json
          latitude: number | null
          longitude: number | null
          name: string
          partner_id: string
          slug: string
          star_rating: number | null
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          amenities?: Json
          city: string
          country_code: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          latitude?: number | null
          longitude?: number | null
          name: string
          partner_id: string
          slug: string
          star_rating?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          amenities?: Json
          city?: string
          country_code?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          latitude?: number | null
          longitude?: number | null
          name?: string
          partner_id?: string
          slug?: string
          star_rating?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "hotel_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          order_id: string
          pdf_storage_path: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
        }
        Insert: {
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          order_id: string
          pdf_storage_path?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total: number
        }
        Update: {
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          order_id?: string
          pdf_storage_path?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          portal: string | null
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown
          portal?: string | null
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          portal?: string | null
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          display_currency: string
          email_enabled: boolean
          language: Database["public"]["Enums"]["account_language"]
          profile_id: string
          sms_enabled: boolean
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          display_currency?: string
          email_enabled?: boolean
          language?: Database["public"]["Enums"]["account_language"]
          profile_id: string
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          display_currency?: string
          email_enabled?: boolean
          language?: Database["public"]["Enums"]["account_language"]
          profile_id?: string
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          flight_booking_id: string | null
          hall_booking_id: string | null
          hotel_booking_id: string | null
          id: string
          item_type: Database["public"]["Enums"]["order_item_type"]
          order_id: string
          quantity: number
          total_price: number
          umrah_booking_id: string | null
          unit_price: number
          visa_application_id: string | null
        }
        Insert: {
          created_at?: string
          flight_booking_id?: string | null
          hall_booking_id?: string | null
          hotel_booking_id?: string | null
          id?: string
          item_type: Database["public"]["Enums"]["order_item_type"]
          order_id: string
          quantity?: number
          total_price: number
          umrah_booking_id?: string | null
          unit_price: number
          visa_application_id?: string | null
        }
        Update: {
          created_at?: string
          flight_booking_id?: string | null
          hall_booking_id?: string | null
          hotel_booking_id?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"]
          order_id?: string
          quantity?: number
          total_price?: number
          umrah_booking_id?: string | null
          unit_price?: number
          visa_application_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_flight_booking_id_fkey"
            columns: ["flight_booking_id"]
            isOneToOne: false
            referencedRelation: "flight_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_hall_booking_id_fkey"
            columns: ["hall_booking_id"]
            isOneToOne: false
            referencedRelation: "hall_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_hotel_booking_id_fkey"
            columns: ["hotel_booking_id"]
            isOneToOne: false
            referencedRelation: "hotel_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_umrah_booking_id_fkey"
            columns: ["umrah_booking_id"]
            isOneToOne: false
            referencedRelation: "umrah_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_visa_application_id_fkey"
            columns: ["visa_application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_click_id: string | null
          affiliate_id: string | null
          agency_customer_id: string | null
          agency_id: string | null
          booked_by: string
          created_at: string
          currency: string
          customer_id: string
          discount_total: number
          hold_expires_at: string | null
          id: string
          markup_amount: number
          notes: string | null
          order_number: string
          paid_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          affiliate_click_id?: string | null
          affiliate_id?: string | null
          agency_customer_id?: string | null
          agency_id?: string | null
          booked_by: string
          created_at?: string
          currency?: string
          customer_id: string
          discount_total?: number
          hold_expires_at?: string | null
          id?: string
          markup_amount?: number
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          affiliate_click_id?: string | null
          affiliate_id?: string | null
          agency_customer_id?: string | null
          agency_id?: string | null
          booked_by?: string
          created_at?: string
          currency?: string
          customer_id?: string
          discount_total?: number
          hold_expires_at?: string | null
          id?: string
          markup_amount?: number
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_click_id_fkey"
            columns: ["affiliate_click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_agency_customer_id_fkey"
            columns: ["agency_customer_id"]
            isOneToOne: false
            referencedRelation: "agency_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_account_events: {
        Row: {
          account_id: string
          action: string
          actor: string | null
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          account_id: string
          action: string
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_account_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_account_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_accounts: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          internal_notes: string | null
          offboarded_at: string | null
          payment_terms: string | null
          status: Database["public"]["Enums"]["partner_account_status"]
          suspended_at: string | null
          type: string
          updated_at: string
          went_live_at: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          id: string
          internal_notes?: string | null
          offboarded_at?: string | null
          payment_terms?: string | null
          status?: Database["public"]["Enums"]["partner_account_status"]
          suspended_at?: string | null
          type: string
          updated_at?: string
          went_live_at?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          internal_notes?: string | null
          offboarded_at?: string | null
          payment_terms?: string | null
          status?: Database["public"]["Enums"]["partner_account_status"]
          suspended_at?: string | null
          type?: string
          updated_at?: string
          went_live_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_document_reviews: {
        Row: {
          application_id: string
          application_type: string
          created_at: string
          doc_key: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          application_type: string
          created_at?: string
          doc_key: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          application_type?: string
          created_at?: string
          doc_key?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_document_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          kind: string
          label: string | null
          last4: string | null
          msisdn: string | null
          provider: string
          provider_customer_id: string | null
          provider_payment_method_id: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          kind?: string
          label?: string | null
          last4?: string | null
          msisdn?: string | null
          provider: string
          provider_customer_id?: string | null
          provider_payment_method_id?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          kind?: string
          label?: string | null
          last4?: string | null
          msisdn?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_payment_method_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          instructions: string | null
          method_id: string | null
          method_label: string | null
          order_id: string
          paid_at: string | null
          payer_phone: string | null
          provider: string
          provider_payment_intent_id: string | null
          provider_ref: string | null
          raw_payload: Json
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          method_id?: string | null
          method_label?: string | null
          order_id: string
          paid_at?: string | null
          payer_phone?: string | null
          provider: string
          provider_payment_intent_id?: string | null
          provider_ref?: string | null
          raw_payload?: Json
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          method_id?: string | null
          method_label?: string | null
          order_id?: string
          paid_at?: string | null
          payer_phone?: string | null
          provider?: string
          provider_payment_intent_id?: string | null
          provider_ref?: string | null
          raw_payload?: Json
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_api_integrations: {
        Row: {
          category: string
          created_at: string
          credentials_encrypted: string | null
          id: string
          is_active: boolean
          last_test_message: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          provider_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean
          last_test_message?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean
          last_test_message?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_api_integrations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          metadata: Json
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          metadata?: Json
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          metadata?: Json
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      traveler_documents: {
        Row: {
          content_type: string | null
          created_at: string
          document_type: Database["public"]["Enums"]["traveler_document_type"]
          expires_at: string | null
          file_name: string
          file_size: number | null
          id: string
          label: string | null
          owner_id: string
          storage_path: string
          traveler_id: string | null
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          document_type?: Database["public"]["Enums"]["traveler_document_type"]
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          label?: string | null
          owner_id: string
          storage_path: string
          traveler_id?: string | null
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          document_type?: Database["public"]["Enums"]["traveler_document_type"]
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          label?: string | null
          owner_id?: string
          storage_path?: string
          traveler_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traveler_documents_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "traveler_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          id: string
          is_self: boolean
          nationality: string | null
          notes: string | null
          owner_id: string
          passport_expiry: string | null
          passport_issue_date: string | null
          passport_number: string | null
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_self?: boolean
          nationality?: string | null
          notes?: string | null
          owner_id: string
          passport_expiry?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          relationship?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_self?: boolean
          nationality?: string | null
          notes?: string | null
          owner_id?: string
          passport_expiry?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_bookings: {
        Row: {
          agency_id: string | null
          booked_by: string
          created_at: string
          currency: string
          customer_id: string
          departure_id: string
          id: string
          num_pilgrims: number
          package_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          booked_by: string
          created_at?: string
          currency?: string
          customer_id: string
          departure_id: string
          id?: string
          num_pilgrims: number
          package_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          booked_by?: string
          created_at?: string
          currency?: string
          customer_id?: string
          departure_id?: string
          id?: string
          num_pilgrims?: number
          package_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "umrah_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_bookings_departure_id_fkey"
            columns: ["departure_id"]
            isOneToOne: false
            referencedRelation: "umrah_package_departures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "umrah_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_itinerary_days: {
        Row: {
          created_at: string
          day_number: number
          description: string | null
          id: string
          package_id: string
          title: string
        }
        Insert: {
          created_at?: string
          day_number: number
          description?: string | null
          id?: string
          package_id: string
          title: string
        }
        Update: {
          created_at?: string
          day_number?: number
          description?: string | null
          id?: string
          package_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "umrah_itinerary_days_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "umrah_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_package_agencies: {
        Row: {
          agency_id: string
          created_at: string
          note: string | null
          package_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          note?: string | null
          package_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          note?: string | null
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "umrah_package_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_package_agencies_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "umrah_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_package_departures: {
        Row: {
          booked_seats: number
          created_at: string
          departure_date: string
          id: string
          package_id: string
          price_override: number | null
          return_date: string
          total_seats: number
        }
        Insert: {
          booked_seats?: number
          created_at?: string
          departure_date: string
          id?: string
          package_id: string
          price_override?: number | null
          return_date: string
          total_seats: number
        }
        Update: {
          booked_seats?: number
          created_at?: string
          departure_date?: string
          id?: string
          package_id?: string
          price_override?: number | null
          return_date?: string
          total_seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "umrah_package_departures_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "umrah_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_package_hotels: {
        Row: {
          city: string
          created_at: string
          distance_to_haram_m: number | null
          hotel_id: string | null
          id: string
          name: string
          nights: number | null
          package_id: string
          room_type: string | null
          sort_order: number
          star_rating: number | null
        }
        Insert: {
          city: string
          created_at?: string
          distance_to_haram_m?: number | null
          hotel_id?: string | null
          id?: string
          name: string
          nights?: number | null
          package_id: string
          room_type?: string | null
          sort_order?: number
          star_rating?: number | null
        }
        Update: {
          city?: string
          created_at?: string
          distance_to_haram_m?: number | null
          hotel_id?: string | null
          id?: string
          name?: string
          nights?: number | null
          package_id?: string
          room_type?: string | null
          sort_order?: number
          star_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "umrah_package_hotels_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_package_hotels_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "umrah_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_package_pricing: {
        Row: {
          created_at: string
          id: string
          package_id: string
          price: number
          sharing: number
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          price: number
          sharing: number
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          price?: number
          sharing?: number
        }
        Relationships: [
          {
            foreignKeyName: "umrah_package_pricing_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "umrah_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_packages: {
        Row: {
          base_price: number
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          contact_whatsapp: string | null
          created_at: string
          currency: string
          description: string | null
          destination_iata: string | null
          duration_days: number
          id: string
          images: Json
          includes: Json
          is_featured: boolean
          meal_plan: string
          meals_note: string | null
          name: string
          origin_iata: string | null
          original_price: number | null
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          tagline: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          base_price: number
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_iata?: string | null
          duration_days: number
          id?: string
          images?: Json
          includes?: Json
          is_featured?: boolean
          meal_plan?: string
          meals_note?: string | null
          name: string
          origin_iata?: string | null
          original_price?: number | null
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_iata?: string | null
          duration_days?: number
          id?: string
          images?: Json
          includes?: Json
          is_featured?: boolean
          meal_plan?: string
          meals_note?: string | null
          name?: string
          origin_iata?: string | null
          original_price?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      umrah_pilgrims: {
        Row: {
          booking_id: string
          date_of_birth: string | null
          full_name: string
          gender: Database["public"]["Enums"]["pilgrim_gender"]
          id: string
          mahram_name: string | null
          mahram_relation: string | null
          nationality: string | null
          passport_expiry: string | null
          passport_number: string | null
        }
        Insert: {
          booking_id: string
          date_of_birth?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["pilgrim_gender"]
          id?: string
          mahram_name?: string | null
          mahram_relation?: string | null
          nationality?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
        }
        Update: {
          booking_id?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["pilgrim_gender"]
          id?: string
          mahram_name?: string | null
          mahram_relation?: string | null
          nationality?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umrah_pilgrims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "umrah_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_application_status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["visa_status"]
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["visa_status"]
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["visa_status"]
        }
        Relationships: [
          {
            foreignKeyName: "visa_application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_applications: {
        Row: {
          admin_notes: string | null
          agency_id: string | null
          applicant_notes: string | null
          applicant_profile_id: string | null
          applicant_type: string
          application_ref: string
          contact_details: Json
          created_at: string
          currency: string
          current_step: number
          decided_at: string | null
          decided_by: string | null
          id: string
          price: number
          status: Database["public"]["Enums"]["visa_status"]
          submitted_by: string
          travel_details: Json
          traveler_details: Json
          updated_at: string
          visa_type_id: string
        }
        Insert: {
          admin_notes?: string | null
          agency_id?: string | null
          applicant_notes?: string | null
          applicant_profile_id?: string | null
          applicant_type?: string
          application_ref?: string
          contact_details?: Json
          created_at?: string
          currency?: string
          current_step?: number
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          price: number
          status?: Database["public"]["Enums"]["visa_status"]
          submitted_by: string
          travel_details?: Json
          traveler_details?: Json
          updated_at?: string
          visa_type_id: string
        }
        Update: {
          admin_notes?: string | null
          agency_id?: string | null
          applicant_notes?: string | null
          applicant_profile_id?: string | null
          applicant_type?: string
          application_ref?: string
          contact_details?: Json
          created_at?: string
          currency?: string
          current_step?: number
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          price?: number
          status?: Database["public"]["Enums"]["visa_status"]
          submitted_by?: string
          travel_details?: Json
          traveler_details?: Json
          updated_at?: string
          visa_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_applications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_applications_applicant_profile_id_fkey"
            columns: ["applicant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_applications_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_applications_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_document_requests: {
        Row: {
          application_id: string
          created_at: string
          description: string | null
          document_id: string | null
          id: string
          requested_by: string | null
          requirement: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          id?: string
          requested_by?: string | null
          requirement?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          id?: string
          requested_by?: string | null
          requirement?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_document_requests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "visa_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_documents: {
        Row: {
          application_id: string
          content_type: string | null
          created_at: string
          document_type: string
          file_name: string | null
          file_size: number | null
          id: string
          storage_path: string
          uploaded_by: string
          verified: boolean
        }
        Insert: {
          application_id: string
          content_type?: string | null
          created_at?: string
          document_type: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          storage_path: string
          uploaded_by: string
          verified?: boolean
        }
        Update: {
          application_id?: string
          content_type?: string | null
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          storage_path?: string
          uploaded_by?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "visa_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_members: {
        Row: {
          application_id: string
          created_at: string
          date_of_birth: string | null
          details: Json
          full_name: string
          id: string
          is_primary: boolean
          nationality: string | null
          passport_expiry: string | null
          passport_number: string | null
          relationship: string
          sort_order: number
        }
        Insert: {
          application_id: string
          created_at?: string
          date_of_birth?: string | null
          details?: Json
          full_name: string
          id?: string
          is_primary?: boolean
          nationality?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          relationship?: string
          sort_order?: number
        }
        Update: {
          application_id?: string
          created_at?: string
          date_of_birth?: string | null
          details?: Json
          full_name?: string
          id?: string
          is_primary?: boolean
          nationality?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          relationship?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "visa_members_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_types: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          destination_country_code: string
          entry_type: string
          id: string
          is_featured: boolean
          name: string
          overview: string | null
          price: number
          processing_days_max: number | null
          processing_days_min: number | null
          required_documents: Json
          status: Database["public"]["Enums"]["listing_status"]
          stay_days: number | null
          updated_at: string
          validity_days: number | null
          visa_category: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          destination_country_code: string
          entry_type?: string
          id?: string
          is_featured?: boolean
          name: string
          overview?: string | null
          price: number
          processing_days_max?: number | null
          processing_days_min?: number | null
          required_documents?: Json
          status?: Database["public"]["Enums"]["listing_status"]
          stay_days?: number | null
          updated_at?: string
          validity_days?: number | null
          visa_category?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          destination_country_code?: string
          entry_type?: string
          id?: string
          is_featured?: boolean
          name?: string
          overview?: string | null
          price?: number
          processing_days_max?: number | null
          processing_days_min?: number | null
          required_documents?: Json
          status?: Database["public"]["Enums"]["listing_status"]
          stay_days?: number | null
          updated_at?: string
          validity_days?: number | null
          visa_category?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_order_cancellation: {
        Args: { reason?: string; target_order_id: string }
        Returns: undefined
      }
      apply_agency_wallet_transaction: {
        Args: {
          target_agency_id: string
          target_order_id?: string
          tx_amount: number
          tx_note?: string
          tx_type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Returns: string
      }
      approve_affiliate_application: {
        Args: { application_id: string; p_note?: string }
        Returns: string
      }
      approve_agency_application: {
        Args: {
          application_id: string
          p_allowed_products?: Database["public"]["Enums"]["order_item_type"][]
          p_note?: string
        }
        Returns: string
      }
      approve_agency_refund_request: {
        Args: { notes?: string; request_id: string }
        Returns: undefined
      }
      approve_hotel_partner_application: {
        Args: { application_id: string; p_note?: string }
        Returns: string
      }
      can_access_order: { Args: { target_order_id: string }; Returns: boolean }
      cancel_order: {
        Args: { reason?: string; target_order_id: string }
        Returns: undefined
      }
      convert_hold_to_checkout: {
        Args: { target_order_id: string }
        Returns: undefined
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      expire_stale_holds: { Args: never; Returns: number }
      generate_affiliate_application_ref: { Args: never; Returns: string }
      generate_agency_application_ref: { Args: never; Returns: string }
      generate_hall_booking_ref: { Args: never; Returns: string }
      generate_hotel_partner_application_ref: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_visa_application_ref: { Args: never; Returns: string }
      get_venue_occupied_ranges: {
        Args: { from_date: string; target_venue_id: string; to_date: string }
        Returns: {
          end_date: string
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_affiliate_owner: {
        Args: { target_affiliate_id: string }
        Returns: boolean
      }
      is_agency_booker: { Args: { target_agency_id: string }; Returns: boolean }
      is_agency_member: { Args: { target_agency_id: string }; Returns: boolean }
      is_agency_owner: { Args: { target_agency_id: string }; Returns: boolean }
      is_agency_owner_or_admin: {
        Args: { target_agency_id: string }
        Returns: boolean
      }
      is_hotel_partner_member: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      is_hotel_partner_owner: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      promote_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      record_agency_commission_payout: {
        Args: {
          payout_amount: number
          payout_method?: string
          payout_ref?: string
          target_agency_id: string
          target_period_end?: string
          target_period_start?: string
        }
        Returns: string
      }
      reject_affiliate_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      reject_agency_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      reject_agency_refund_request: {
        Args: { notes?: string; request_id: string }
        Returns: undefined
      }
      reject_hotel_partner_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      room_available_units: {
        Args: {
          stay_check_in: string
          stay_check_out: string
          target_room_id: string
        }
        Returns: number
      }
      set_account_status: {
        Args: {
          new_status: Database["public"]["Enums"]["account_status"]
          target_user_id: string
        }
        Returns: undefined
      }
      set_platform_admin: {
        Args: { new_is_platform_admin: boolean; target_user_id: string }
        Returns: undefined
      }
      shares_active_org_with: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_language: "en" | "so" | "ar"
      account_status: "active" | "suspended" | "pending_verification"
      agency_member_role: "owner" | "staff"
      agency_role: "owner" | "admin" | "booking_staff" | "accountant" | "viewer"
      agency_status: "pending" | "active" | "suspended"
      app_role: "customer" | "agent" | "hotel_partner" | "affiliate" | "admin"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "draft"
        | "under_review"
        | "more_info_requested"
      booking_request_kind: "cancellation" | "refund" | "modification"
      booking_request_status:
        | "requested"
        | "in_review"
        | "approved"
        | "rejected"
        | "completed"
        | "withdrawn"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "refunded"
        | "no_show"
        | "failed"
      commission_entry_status: "pending" | "confirmed" | "paid_out" | "reversed"
      conversion_status: "pending" | "approved" | "paid" | "reversed"
      deletion_request_status:
        | "requested"
        | "in_review"
        | "completed"
        | "rejected"
        | "withdrawn"
      invoice_status: "draft" | "issued" | "paid" | "void"
      listing_status: "draft" | "pending_review" | "published" | "suspended"
      markup_type: "percent" | "fixed"
      member_status: "active" | "invited" | "removed"
      order_item_type: "hotel" | "flight" | "visa" | "umrah" | "hall"
      order_status:
        | "pending_payment"
        | "paid"
        | "processing"
        | "completed"
        | "cancelled"
        | "refunded"
        | "held"
      partner_account_status: "onboarding" | "live" | "suspended" | "offboarded"
      passenger_type: "adult" | "child" | "infant"
      payment_status:
        | "requires_action"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      payout_status: "pending" | "processing" | "paid" | "failed"
      pilgrim_gender: "male" | "female"
      refund_request_status: "pending" | "approved" | "rejected"
      traveler_document_type:
        | "passport_bio"
        | "passport_photo"
        | "national_id"
        | "photo"
        | "vaccination"
        | "bank_statement"
        | "employment_letter"
        | "invitation_letter"
        | "travel_insurance"
        | "other"
      trip_type: "one_way" | "round_trip" | "multi_city"
      visa_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "additional_info_required"
        | "processing"
        | "approved"
        | "rejected"
        | "issued"
        | "cancelled"
      wallet_tx_type:
        | "deposit"
        | "booking_payment"
        | "refund"
        | "adjustment"
        | "credit_note"
        | "debit_note"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_language: ["en", "so", "ar"],
      account_status: ["active", "suspended", "pending_verification"],
      agency_member_role: ["owner", "staff"],
      agency_role: ["owner", "admin", "booking_staff", "accountant", "viewer"],
      agency_status: ["pending", "active", "suspended"],
      app_role: ["customer", "agent", "hotel_partner", "affiliate", "admin"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "draft",
        "under_review",
        "more_info_requested",
      ],
      booking_request_kind: ["cancellation", "refund", "modification"],
      booking_request_status: [
        "requested",
        "in_review",
        "approved",
        "rejected",
        "completed",
        "withdrawn",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "refunded",
        "no_show",
        "failed",
      ],
      commission_entry_status: ["pending", "confirmed", "paid_out", "reversed"],
      conversion_status: ["pending", "approved", "paid", "reversed"],
      deletion_request_status: [
        "requested",
        "in_review",
        "completed",
        "rejected",
        "withdrawn",
      ],
      invoice_status: ["draft", "issued", "paid", "void"],
      listing_status: ["draft", "pending_review", "published", "suspended"],
      markup_type: ["percent", "fixed"],
      member_status: ["active", "invited", "removed"],
      order_item_type: ["hotel", "flight", "visa", "umrah", "hall"],
      order_status: [
        "pending_payment",
        "paid",
        "processing",
        "completed",
        "cancelled",
        "refunded",
        "held",
      ],
      partner_account_status: ["onboarding", "live", "suspended", "offboarded"],
      passenger_type: ["adult", "child", "infant"],
      payment_status: [
        "requires_action",
        "processing",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      payout_status: ["pending", "processing", "paid", "failed"],
      pilgrim_gender: ["male", "female"],
      refund_request_status: ["pending", "approved", "rejected"],
      traveler_document_type: [
        "passport_bio",
        "passport_photo",
        "national_id",
        "photo",
        "vaccination",
        "bank_statement",
        "employment_letter",
        "invitation_letter",
        "travel_insurance",
        "other",
      ],
      trip_type: ["one_way", "round_trip", "multi_city"],
      visa_status: [
        "draft",
        "submitted",
        "in_review",
        "additional_info_required",
        "processing",
        "approved",
        "rejected",
        "issued",
        "cancelled",
      ],
      wallet_tx_type: [
        "deposit",
        "booking_payment",
        "refund",
        "adjustment",
        "credit_note",
        "debit_note",
      ],
    },
  },
} as const

