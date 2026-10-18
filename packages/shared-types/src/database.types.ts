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
          about: string | null
          address: string | null
          allowed_products: Database["public"]["Enums"]["order_item_type"][]
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_swift_code: string | null
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
          website: string | null
        }
        Insert: {
          about?: string | null
          address?: string | null
          allowed_products?: Database["public"]["Enums"]["order_item_type"][]
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
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
          website?: string | null
        }
        Update: {
          about?: string | null
          address?: string | null
          allowed_products?: Database["public"]["Enums"]["order_item_type"][]
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
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
          website?: string | null
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
          {
            foreignKeyName: "agency_customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_markup_requests: {
        Row: {
          action: string
          agency_id: string
          created_at: string
          id: string
          item_type: Database["public"]["Enums"]["order_item_type"] | null
          markup_type: Database["public"]["Enums"]["markup_type"]
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          action: string
          agency_id: string
          created_at?: string
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"] | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          action?: string
          agency_id?: string
          created_at?: string
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"] | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_markup_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_markup_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_markup_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
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
      agency_payout_requests: {
        Row: {
          agency_id: string
          amount: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_swift_code: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          method: string | null
          paid_at: string | null
          payout_id: string | null
          proof_path: string | null
          provider: string | null
          provider_ref: string | null
          rail: string
          reference: string | null
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          settled_by: string | null
          status: Database["public"]["Enums"]["payout_request_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          payout_id?: string | null
          proof_path?: string | null
          provider?: string | null
          provider_ref?: string | null
          rail?: string
          reference?: string | null
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          settled_by?: string | null
          status?: Database["public"]["Enums"]["payout_request_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          payout_id?: string | null
          proof_path?: string | null
          provider?: string | null
          provider_ref?: string | null
          rail?: string
          reference?: string | null
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          settled_by?: string | null
          status?: Database["public"]["Enums"]["payout_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_payout_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payout_requests_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "agency_commission_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payout_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payout_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payout_requests_settled_by_fkey"
            columns: ["settled_by"]
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
      agency_topup_requests: {
        Row: {
          agency_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          note: string | null
          proof_path: string | null
          provider: string | null
          provider_ref: string | null
          rail: string
          reference: string | null
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["topup_status"]
          updated_at: string
          wallet_transaction_id: string | null
        }
        Insert: {
          agency_id: string
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          note?: string | null
          proof_path?: string | null
          provider?: string | null
          provider_ref?: string | null
          rail: string
          reference?: string | null
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          updated_at?: string
          wallet_transaction_id?: string | null
        }
        Update: {
          agency_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          note?: string | null
          proof_path?: string | null
          provider?: string | null
          provider_ref?: string | null
          rail?: string
          reference?: string | null
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          updated_at?: string
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_topup_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_topup_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_topup_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_topup_requests_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "agency_wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
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
      amenities: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          scope: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          scope?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
        ]
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
          hall_booking_id: string | null
          hotel_booking_id: string | null
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
          hall_booking_id?: string | null
          hotel_booking_id?: string | null
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
          hall_booking_id?: string | null
          hotel_booking_id?: string | null
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
            foreignKeyName: "booking_requests_hall_booking_id_fkey"
            columns: ["hall_booking_id"]
            isOneToOne: false
            referencedRelation: "hall_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_hotel_booking_id_fkey"
            columns: ["hotel_booking_id"]
            isOneToOne: false
            referencedRelation: "hotel_bookings"
            referencedColumns: ["id"]
          },
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
          created_by: string | null
          currency: string
          id: string
          method: string | null
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
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
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
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
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
          {
            foreignKeyName: "commission_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          contact_email: string | null
          country_code: string
          created_at: string
          currency: string
          description: string | null
          event_types: Json
          id: string
          images: Json
          is_featured: boolean
          name: string
          partner_id: string | null
          phone: string | null
          policies: string | null
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
          contact_email?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          event_types?: Json
          id?: string
          images?: Json
          is_featured?: boolean
          name: string
          partner_id?: string | null
          phone?: string | null
          policies?: string | null
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
          contact_email?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          event_types?: Json
          id?: string
          images?: Json
          is_featured?: boolean
          name?: string
          partner_id?: string | null
          phone?: string | null
          policies?: string | null
          price_unit?: string
          size_sqm?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_venues_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_bookings: {
        Row: {
          agency_customer_id: string | null
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
          agency_customer_id?: string | null
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
          agency_customer_id?: string | null
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
            foreignKeyName: "flight_bookings_agency_customer_id_fkey"
            columns: ["agency_customer_id"]
            isOneToOne: false
            referencedRelation: "agency_customers"
            referencedColumns: ["id"]
          },
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
      hall_booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_value: string | null
          id: string
          kind: string
          to_value: string | null
          venue_id: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_value?: string | null
          id?: string
          kind: string
          to_value?: string | null
          venue_id: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_value?: string | null
          id?: string
          kind?: string
          to_value?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "hall_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_booking_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_bookings: {
        Row: {
          admin_notes: string | null
          agency_id: string | null
          allocated_at: string | null
          booked_by: string
          booking_ref: string
          channel: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          customer_id: string
          customer_notes: string | null
          displaced_at: string | null
          displaced_by: string | null
          end_date: string
          end_time: string | null
          event_name: string | null
          event_type: string
          expected_guests: number | null
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          price: number
          priority: number
          setup_requirements: string | null
          source: string
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          admin_notes?: string | null
          agency_id?: string | null
          allocated_at?: string | null
          booked_by: string
          booking_ref?: string
          channel?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          customer_notes?: string | null
          displaced_at?: string | null
          displaced_by?: string | null
          end_date: string
          end_time?: string | null
          event_name?: string | null
          event_type: string
          expected_guests?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          price?: number
          priority?: number
          setup_requirements?: string | null
          source?: string
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          admin_notes?: string | null
          agency_id?: string | null
          allocated_at?: string | null
          booked_by?: string
          booking_ref?: string
          channel?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          customer_notes?: string | null
          displaced_at?: string | null
          displaced_by?: string | null
          end_date?: string
          end_time?: string | null
          event_name?: string | null
          event_type?: string
          expected_guests?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          price?: number
          priority?: number
          setup_requirements?: string | null
          source?: string
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
            foreignKeyName: "hall_bookings_displaced_by_fkey"
            columns: ["displaced_by"]
            isOneToOne: false
            referencedRelation: "hall_bookings"
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
      hotel_amenities: {
        Row: {
          amenity_id: string
          created_at: string
          hotel_id: string
        }
        Insert: {
          amenity_id: string
          created_at?: string
          hotel_id: string
        }
        Update: {
          amenity_id?: string
          created_at?: string
          hotel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_amenities_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_value: string | null
          hotel_id: string
          id: string
          kind: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_value?: string | null
          hotel_id: string
          id?: string
          kind: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_value?: string | null
          hotel_id?: string
          id?: string
          kind?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_booking_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "hotel_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_booking_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_booking_room_units: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          booking_id: string
          locked: boolean
          room_unit_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          booking_id: string
          locked?: boolean
          room_unit_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          booking_id?: string
          locked?: boolean
          room_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_booking_room_units_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_booking_room_units_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "hotel_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_booking_room_units_room_unit_id_fkey"
            columns: ["room_unit_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_units"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_bookings: {
        Row: {
          agency_id: string | null
          allocated_at: string | null
          booked_by: string
          channel: string
          check_in: string
          check_out: string
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          currency: string
          customer_id: string
          displaced_at: string | null
          displaced_by: string | null
          guest_details: Json
          hotel_id: string
          id: string
          num_adults: number
          num_children: number
          num_rooms: number
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          priority: number
          room_id: string
          source: string
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
          _allocate_hotel_booking: string | null
        }
        Insert: {
          agency_id?: string | null
          allocated_at?: string | null
          booked_by: string
          channel?: string
          check_in: string
          check_out: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          displaced_at?: string | null
          displaced_by?: string | null
          guest_details?: Json
          hotel_id: string
          id?: string
          num_adults?: number
          num_children?: number
          num_rooms?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          priority?: number
          room_id: string
          source?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          allocated_at?: string | null
          booked_by?: string
          channel?: string
          check_in?: string
          check_out?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          displaced_at?: string | null
          displaced_by?: string | null
          guest_details?: Json
          hotel_id?: string
          id?: string
          num_adults?: number
          num_children?: number
          num_rooms?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          priority?: number
          room_id?: string
          source?: string
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
            foreignKeyName: "hotel_bookings_displaced_by_fkey"
            columns: ["displaced_by"]
            isOneToOne: false
            referencedRelation: "hotel_bookings"
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
      hotel_managers: {
        Row: {
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          permissions: string[]
          profile_id: string
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          permissions?: string[]
          profile_id: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          permissions?: string[]
          profile_id?: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "hotel_managers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_managers_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_managers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      hotel_room_amenities: {
        Row: {
          amenity_id: string
          created_at: string
          room_id: string
        }
        Insert: {
          amenity_id: string
          created_at?: string
          room_id: string
        }
        Update: {
          amenity_id?: string
          created_at?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_room_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_room_amenities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_room_disable_dates: {
        Row: {
          created_at: string
          created_by: string | null
          date_end: string
          date_start: string
          id: string
          reason: string | null
          room_unit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_end: string
          date_start: string
          id?: string
          reason?: string | null
          room_unit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_end?: string
          date_start?: string
          id?: string
          reason?: string | null
          room_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_room_disable_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_room_disable_dates_room_unit_id_fkey"
            columns: ["room_unit_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_units"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_room_inventory: {
        Row: {
          date: string
          id: string
          price_override: number | null
          room_id: string
          total_units: number
        }
        Insert: {
          date: string
          id?: string
          price_override?: number | null
          room_id: string
          total_units: number
        }
        Update: {
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
      hotel_room_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      hotel_room_units: {
        Row: {
          created_at: string
          floor: string | null
          hotel_id: string
          id: string
          notes: string | null
          out_of_order_reason: string | null
          room_number: string
          room_type_id: string
          status: Database["public"]["Enums"]["hotel_room_unit_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor?: string | null
          hotel_id: string
          id?: string
          notes?: string | null
          out_of_order_reason?: string | null
          room_number: string
          room_type_id: string
          status?: Database["public"]["Enums"]["hotel_room_unit_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor?: string | null
          hotel_id?: string
          id?: string
          notes?: string | null
          out_of_order_reason?: string | null
          room_number?: string
          room_type_id?: string
          status?: Database["public"]["Enums"]["hotel_room_unit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_room_units_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_room_units_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rate_rules: {
        Row: {
          adjustment: string
          created_at: string
          created_by: string | null
          date_end: string
          date_start: string
          hotel_id: string
          id: string
          name: string
          room_id: string | null
          value: number
          weekdays: number[] | null
        }
        Insert: {
          adjustment: string
          created_at?: string
          created_by?: string | null
          date_end: string
          date_start: string
          hotel_id: string
          id?: string
          name: string
          room_id?: string | null
          value: number
          weekdays?: number[] | null
        }
        Update: {
          adjustment?: string
          created_at?: string
          created_by?: string | null
          date_end?: string
          date_start?: string
          hotel_id?: string
          id?: string
          name?: string
          room_id?: string | null
          value?: number
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rate_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rate_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rate_rules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_refund_rules: {
        Row: {
          created_at: string
          days_before: number
          deduction_percent: number
          hotel_id: string
          id: string
        }
        Insert: {
          created_at?: string
          days_before: number
          deduction_percent: number
          hotel_id: string
          id?: string
        }
        Update: {
          created_at?: string
          days_before?: number
          deduction_percent?: number
          hotel_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_refund_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
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
          description_so: string | null
          floor: string | null
          hotel_id: string
          id: string
          images: Json
          max_occupancy: number
          name: string
          name_so: string | null
          size_sqm: number | null
          status: Database["public"]["Enums"]["listing_status"]
          total_units: number
          updated_at: string
        }
        Insert: {
          amenities?: Json
          base_price: number
          bed_type?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          description_so?: string | null
          floor?: string | null
          hotel_id: string
          id?: string
          images?: Json
          max_occupancy?: number
          name: string
          name_so?: string | null
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          total_units: number
          updated_at?: string
        }
        Update: {
          amenities?: Json
          base_price?: number
          bed_type?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          description_so?: string | null
          floor?: string | null
          hotel_id?: string
          id?: string
          images?: Json
          max_occupancy?: number
          name?: string
          name_so?: string | null
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          total_units?: number
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
          booking_mode: string
          check_in_time: string | null
          check_out_time: string | null
          city: string
          contact_email: string | null
          country_code: string
          created_at: string
          description: string | null
          description_so: string | null
          id: string
          images: Json
          latitude: number | null
          logo_path: string | null
          longitude: number | null
          name: string
          partner_id: string | null
          phone: string | null
          policies: string | null
          slug: string
          star_rating: number | null
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          amenities?: Json
          booking_mode?: string
          check_in_time?: string | null
          check_out_time?: string | null
          city: string
          contact_email?: string | null
          country_code: string
          created_at?: string
          description?: string | null
          description_so?: string | null
          id?: string
          images?: Json
          latitude?: number | null
          logo_path?: string | null
          longitude?: number | null
          name: string
          partner_id?: string | null
          phone?: string | null
          policies?: string | null
          slug: string
          star_rating?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          amenities?: Json
          booking_mode?: string
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string
          contact_email?: string | null
          country_code?: string
          created_at?: string
          description?: string | null
          description_so?: string | null
          id?: string
          images?: Json
          latitude?: number | null
          logo_path?: string | null
          longitude?: number | null
          name?: string
          partner_id?: string | null
          phone?: string | null
          policies?: string | null
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
          {
            foreignKeyName: "order_items_visa_application_id_fkey"
            columns: ["visa_application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
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
          booking_batch_id: string | null
          created_at: string
          currency: string
          customer_id: string
          discount_total: number
          fee_total: number
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
          booking_batch_id?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          discount_total?: number
          fee_total?: number
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
          booking_batch_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          discount_total?: number
          fee_total?: number
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
          config: Json
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
          config?: Json
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
          config?: Json
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
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agent_code: string | null
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
          agent_code?: string | null
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
          agent_code?: string | null
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
      property_links: {
        Row: {
          created_at: string
          hotel_id: string | null
          id: string
          label: string
          sort_order: number
          url: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          hotel_id?: string | null
          id?: string
          label: string
          sort_order?: number
          url: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          hotel_id?: string | null
          id?: string
          label?: string
          sort_order?: number
          url?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_links_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_links_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      property_reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          customer_id: string | null
          hotel_id: string | null
          id: string
          rating: number
          source: string
          status: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          hotel_id?: string | null
          id?: string
          rating: number
          source?: string
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          hotel_id?: string | null
          id?: string
          rating?: number
          source?: string
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_reviews_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
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
      umrah_booking_documents: {
        Row: {
          booking_id: string
          content_type: string | null
          created_at: string
          doc_type: string
          file_name: string | null
          file_size: number | null
          id: string
          pilgrim_id: string | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          booking_id: string
          content_type?: string | null
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          pilgrim_id?: string | null
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          booking_id?: string
          content_type?: string | null
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          pilgrim_id?: string | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umrah_booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "umrah_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_booking_documents_pilgrim_id_fkey"
            columns: ["pilgrim_id"]
            isOneToOne: false
            referencedRelation: "umrah_pilgrims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_booking_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_booking_stage_history: {
        Row: {
          actor: string | null
          booking_id: string
          created_at: string
          id: string
          note: string | null
          stage: Database["public"]["Enums"]["umrah_fulfillment_stage"]
        }
        Insert: {
          actor?: string | null
          booking_id: string
          created_at?: string
          id?: string
          note?: string | null
          stage: Database["public"]["Enums"]["umrah_fulfillment_stage"]
        }
        Update: {
          actor?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          note?: string | null
          stage?: Database["public"]["Enums"]["umrah_fulfillment_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "umrah_booking_stage_history_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_booking_stage_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "umrah_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_bookings: {
        Row: {
          agency_id: string | null
          booked_by: string
          booking_kind: string
          created_at: string
          currency: string
          custom_request_id: string | null
          customer_id: string
          departure_id: string | null
          fulfillment_stage: Database["public"]["Enums"]["umrah_fulfillment_stage"]
          id: string
          num_pilgrims: number
          package_id: string | null
          room_sharing: number | null
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          booked_by: string
          booking_kind?: string
          created_at?: string
          currency?: string
          custom_request_id?: string | null
          customer_id: string
          departure_id?: string | null
          fulfillment_stage?: Database["public"]["Enums"]["umrah_fulfillment_stage"]
          id?: string
          num_pilgrims: number
          package_id?: string | null
          room_sharing?: number | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          booked_by?: string
          booking_kind?: string
          created_at?: string
          currency?: string
          custom_request_id?: string | null
          customer_id?: string
          departure_id?: string | null
          fulfillment_stage?: Database["public"]["Enums"]["umrah_fulfillment_stage"]
          id?: string
          num_pilgrims?: number
          package_id?: string | null
          room_sharing?: number | null
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
            foreignKeyName: "umrah_bookings_custom_request_id_fkey"
            columns: ["custom_request_id"]
            isOneToOne: false
            referencedRelation: "umrah_custom_requests"
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
      umrah_custom_request_services: {
        Row: {
          category: Database["public"]["Enums"]["umrah_service_category"]
          created_at: string
          id: string
          line_total: number
          name: string
          price_unit: Database["public"]["Enums"]["umrah_price_unit"]
          quantity: number
          request_id: string
          service_id: string | null
          unit_price: number
        }
        Insert: {
          category: Database["public"]["Enums"]["umrah_service_category"]
          created_at?: string
          id?: string
          line_total: number
          name: string
          price_unit: Database["public"]["Enums"]["umrah_price_unit"]
          quantity: number
          request_id: string
          service_id?: string | null
          unit_price: number
        }
        Update: {
          category?: Database["public"]["Enums"]["umrah_service_category"]
          created_at?: string
          id?: string
          line_total?: number
          name?: string
          price_unit?: Database["public"]["Enums"]["umrah_price_unit"]
          quantity?: number
          request_id?: string
          service_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "umrah_custom_request_services_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "umrah_custom_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_custom_request_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "umrah_services"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_custom_requests: {
        Row: {
          agency_id: string | null
          booked_by: string
          created_at: string
          currency: string
          current_step: number
          customer_id: string
          departure_date: string | null
          id: string
          nights_madinah: number
          nights_makkah: number
          notes: string | null
          num_pilgrims: number
          pilgrims: Json
          reference: string
          room_sharing: number
          status: string
          subtotal: number
          tier: Database["public"]["Enums"]["umrah_tier"]
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          booked_by: string
          created_at?: string
          currency?: string
          current_step?: number
          customer_id: string
          departure_date?: string | null
          id?: string
          nights_madinah?: number
          nights_makkah?: number
          notes?: string | null
          num_pilgrims?: number
          pilgrims?: Json
          reference?: string
          room_sharing?: number
          status?: string
          subtotal?: number
          tier?: Database["public"]["Enums"]["umrah_tier"]
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          booked_by?: string
          created_at?: string
          currency?: string
          current_step?: number
          customer_id?: string
          departure_date?: string | null
          id?: string
          nights_madinah?: number
          nights_makkah?: number
          notes?: string | null
          num_pilgrims?: number
          pilgrims?: Json
          reference?: string
          room_sharing?: number
          status?: string
          subtotal?: number
          tier?: Database["public"]["Enums"]["umrah_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "umrah_custom_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_custom_requests_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_custom_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          baggage_note: string | null
          booked_seats: number
          created_at: string
          departure_date: string
          id: string
          offline_seats: number
          outbound_airline: string | null
          outbound_arrives_at: string | null
          outbound_departs_at: string | null
          outbound_flight_number: string | null
          package_id: string
          price_override: number | null
          return_airline: string | null
          return_arrives_at: string | null
          return_date: string
          return_departs_at: string | null
          return_flight_number: string | null
          total_seats: number
        }
        Insert: {
          baggage_note?: string | null
          booked_seats?: number
          created_at?: string
          departure_date: string
          id?: string
          offline_seats?: number
          outbound_airline?: string | null
          outbound_arrives_at?: string | null
          outbound_departs_at?: string | null
          outbound_flight_number?: string | null
          package_id: string
          price_override?: number | null
          return_airline?: string | null
          return_arrives_at?: string | null
          return_date: string
          return_departs_at?: string | null
          return_flight_number?: string | null
          total_seats: number
        }
        Update: {
          baggage_note?: string | null
          booked_seats?: number
          created_at?: string
          departure_date?: string
          id?: string
          offline_seats?: number
          outbound_airline?: string | null
          outbound_arrives_at?: string | null
          outbound_departs_at?: string | null
          outbound_flight_number?: string | null
          package_id?: string
          price_override?: number | null
          return_airline?: string | null
          return_arrives_at?: string | null
          return_date?: string
          return_departs_at?: string | null
          return_flight_number?: string | null
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
      umrah_service_sharing_prices: {
        Row: {
          price: number
          service_id: string
          sharing: number
        }
        Insert: {
          price: number
          service_id: string
          sharing: number
        }
        Update: {
          price?: number
          service_id?: string
          sharing?: number
        }
        Relationships: [
          {
            foreignKeyName: "umrah_service_sharing_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "umrah_services"
            referencedColumns: ["id"]
          },
        ]
      }
      umrah_services: {
        Row: {
          category: Database["public"]["Enums"]["umrah_service_category"]
          created_at: string
          currency: string
          description: string | null
          distance_to_haram_m: number | null
          id: string
          is_default: boolean
          name: string
          price: number
          price_unit: Database["public"]["Enums"]["umrah_price_unit"]
          sort_order: number
          star_rating: number | null
          status: Database["public"]["Enums"]["listing_status"]
          tier: Database["public"]["Enums"]["umrah_tier"] | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["umrah_service_category"]
          created_at?: string
          currency?: string
          description?: string | null
          distance_to_haram_m?: number | null
          id?: string
          is_default?: boolean
          name: string
          price: number
          price_unit: Database["public"]["Enums"]["umrah_price_unit"]
          sort_order?: number
          star_rating?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          tier?: Database["public"]["Enums"]["umrah_tier"] | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["umrah_service_category"]
          created_at?: string
          currency?: string
          description?: string | null
          distance_to_haram_m?: number | null
          id?: string
          is_default?: boolean
          name?: string
          price?: number
          price_unit?: Database["public"]["Enums"]["umrah_price_unit"]
          sort_order?: number
          star_rating?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          tier?: Database["public"]["Enums"]["umrah_tier"] | null
          updated_at?: string
        }
        Relationships: []
      }
      venue_blocked_dates: {
        Row: {
          created_at: string
          created_by: string | null
          date_end: string
          date_start: string
          id: string
          reason: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_end: string
          date_start: string
          id?: string
          reason?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_end?: string
          date_start?: string
          id?: string
          reason?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_blocked_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_blocked_dates_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_refund_rules: {
        Row: {
          created_at: string
          days_before: number
          deduction_percent: number
          id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          days_before: number
          deduction_percent: number
          id?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          days_before?: number
          deduction_percent?: number
          id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_refund_rules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_managers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          permissions: string[]
          profile_id: string
          status: Database["public"]["Enums"]["member_status"]
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          permissions?: string[]
          profile_id: string
          status?: Database["public"]["Enums"]["member_status"]
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          permissions?: string[]
          profile_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_managers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_managers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_managers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_partner_applications: {
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
            foreignKeyName: "venue_partner_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_partner_applications_assigned_reviewer_fkey"
            columns: ["assigned_reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_partner_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_partner_members: {
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
            foreignKeyName: "venue_partner_members_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_partner_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_partners: {
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
            foreignKeyName: "venue_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_application_centres: {
        Row: {
          address: string | null
          appointment_url: string | null
          city: string
          collection_hours: string | null
          country_code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          provider: string | null
          submission_hours: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          appointment_url?: string | null
          city: string
          collection_hours?: string | null
          country_code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          provider?: string | null
          submission_hours?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          appointment_url?: string | null
          city?: string
          collection_hours?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          provider?: string | null
          submission_hours?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
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
            foreignKeyName: "visa_application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
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
          agency_customer_id: string | null
          agency_id: string | null
          applicant_notes: string | null
          applicant_profile_id: string | null
          applicant_type: string
          application_ref: string
          contact_details: Json
          created_at: string
          currency: string
          current_step: number
          custom_answers: Json
          decided_at: string | null
          decided_by: string | null
          fee_amount: number
          id: string
          info_return_stage: Database["public"]["Enums"]["visa_status"] | null
          partner_last_synced_at: string | null
          partner_provider_key: string | null
          partner_raw_payload: Json | null
          partner_ref: string | null
          partner_status: string | null
          price: number
          resolved_documents: Json | null
          resolved_eligibility_requirements: string | null
          resolved_price: number | null
          resolved_processing_days_max: number | null
          resolved_processing_days_min: number | null
          resolved_processing_fee: number | null
          status: Database["public"]["Enums"]["visa_status"]
          submitted_at: string | null
          submitted_by: string
          travel_details: Json
          traveler_details: Json
          updated_at: string
          visa_type_id: string
          workflow: Json
          _visa_create_passports: undefined | null
          _visa_is_case_party: boolean | null
          visa_case_attention: string | null
        }
        Insert: {
          admin_notes?: string | null
          agency_customer_id?: string | null
          agency_id?: string | null
          applicant_notes?: string | null
          applicant_profile_id?: string | null
          applicant_type?: string
          application_ref?: string
          contact_details?: Json
          created_at?: string
          currency?: string
          current_step?: number
          custom_answers?: Json
          decided_at?: string | null
          decided_by?: string | null
          fee_amount?: number
          id?: string
          info_return_stage?: Database["public"]["Enums"]["visa_status"] | null
          partner_last_synced_at?: string | null
          partner_provider_key?: string | null
          partner_raw_payload?: Json | null
          partner_ref?: string | null
          partner_status?: string | null
          price: number
          resolved_documents?: Json | null
          resolved_eligibility_requirements?: string | null
          resolved_price?: number | null
          resolved_processing_days_max?: number | null
          resolved_processing_days_min?: number | null
          resolved_processing_fee?: number | null
          status?: Database["public"]["Enums"]["visa_status"]
          submitted_at?: string | null
          submitted_by: string
          travel_details?: Json
          traveler_details?: Json
          updated_at?: string
          visa_type_id: string
          workflow?: Json
        }
        Update: {
          admin_notes?: string | null
          agency_customer_id?: string | null
          agency_id?: string | null
          applicant_notes?: string | null
          applicant_profile_id?: string | null
          applicant_type?: string
          application_ref?: string
          contact_details?: Json
          created_at?: string
          currency?: string
          current_step?: number
          custom_answers?: Json
          decided_at?: string | null
          decided_by?: string | null
          fee_amount?: number
          id?: string
          info_return_stage?: Database["public"]["Enums"]["visa_status"] | null
          partner_last_synced_at?: string | null
          partner_provider_key?: string | null
          partner_raw_payload?: Json | null
          partner_ref?: string | null
          partner_status?: string | null
          price?: number
          resolved_documents?: Json | null
          resolved_eligibility_requirements?: string | null
          resolved_price?: number | null
          resolved_processing_days_max?: number | null
          resolved_processing_days_min?: number | null
          resolved_processing_fee?: number | null
          status?: Database["public"]["Enums"]["visa_status"]
          submitted_at?: string | null
          submitted_by?: string
          travel_details?: Json
          traveler_details?: Json
          updated_at?: string
          visa_type_id?: string
          workflow?: Json
        }
        Relationships: [
          {
            foreignKeyName: "visa_applications_agency_customer_id_fkey"
            columns: ["agency_customer_id"]
            isOneToOne: false
            referencedRelation: "agency_customers"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "visa_case_queue"
            referencedColumns: ["visa_type_id"]
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
      visa_appointments: {
        Row: {
          application_id: string
          appointment_type: string
          biometrics_completed: boolean
          biometrics_required: boolean
          centre_id: string
          confirmation_number: string | null
          created_at: string
          created_by: string | null
          id: string
          member_id: string | null
          scheduled_at: string
          status: string
          status_changed_at: string | null
          status_reason: string | null
          supersedes_id: string | null
        }
        Insert: {
          application_id: string
          appointment_type: string
          biometrics_completed?: boolean
          biometrics_required?: boolean
          centre_id: string
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          scheduled_at: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          supersedes_id?: string | null
        }
        Update: {
          application_id?: string
          appointment_type?: string
          biometrics_completed?: boolean
          biometrics_required?: boolean
          centre_id?: string
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          scheduled_at?: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_appointments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_appointments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_appointments_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "visa_application_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "visa_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_appointments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "visa_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_case_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          actor_name: string | null
          actor_permission: string | null
          application_id: string
          created_at: string
          customer_summary: string | null
          customer_visible: boolean
          data: Json
          event_type: string
          from_stage: Database["public"]["Enums"]["visa_status"] | null
          id: string
          member_id: string | null
          notify_customer: boolean
          notify_staff: boolean
          reason: string | null
          summary: string
          to_stage: Database["public"]["Enums"]["visa_status"] | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind: string
          actor_name?: string | null
          actor_permission?: string | null
          application_id: string
          created_at?: string
          customer_summary?: string | null
          customer_visible?: boolean
          data?: Json
          event_type: string
          from_stage?: Database["public"]["Enums"]["visa_status"] | null
          id?: string
          member_id?: string | null
          notify_customer?: boolean
          notify_staff?: boolean
          reason?: string | null
          summary: string
          to_stage?: Database["public"]["Enums"]["visa_status"] | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          actor_name?: string | null
          actor_permission?: string | null
          application_id?: string
          created_at?: string
          customer_summary?: string | null
          customer_visible?: boolean
          data?: Json
          event_type?: string
          from_stage?: Database["public"]["Enums"]["visa_status"] | null
          id?: string
          member_id?: string | null
          notify_customer?: boolean
          notify_staff?: boolean
          reason?: string | null
          summary?: string
          to_stage?: Database["public"]["Enums"]["visa_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_case_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_case_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_case_messages: {
        Row: {
          application_id: string
          author_id: string | null
          author_kind: string
          author_name: string | null
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          author_kind: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          author_kind?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_case_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_case_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_case_ops: {
        Row: {
          application_id: string
          assigned_to: string | null
          priority: string
          sla_due_at: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          assigned_to?: string | null
          priority?: string
          sla_due_at?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          assigned_to?: string | null
          priority?: string
          sla_due_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_case_ops_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_case_ops_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_case_ops_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_decisions: {
        Row: {
          application_id: string
          authority: string
          authority_reference: string | null
          correction_reason: string | null
          decision_date: string
          id: string
          letter_document_id: string | null
          notes: string | null
          outcome: string
          recorded_at: string
          recorded_by: string | null
          source: string
          supersedes_id: string | null
        }
        Insert: {
          application_id: string
          authority: string
          authority_reference?: string | null
          correction_reason?: string | null
          decision_date: string
          id?: string
          letter_document_id?: string | null
          notes?: string | null
          outcome: string
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          supersedes_id?: string | null
        }
        Update: {
          application_id?: string
          authority?: string
          authority_reference?: string | null
          correction_reason?: string | null
          decision_date?: string
          id?: string
          letter_document_id?: string | null
          notes?: string | null
          outcome?: string
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_decisions_letter_document_id_fkey"
            columns: ["letter_document_id"]
            isOneToOne: false
            referencedRelation: "visa_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_decisions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_decisions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "visa_decisions"
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
          due_date: string | null
          id: string
          requested_by: string | null
          requirement: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          requested_by?: string | null
          requirement?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          requested_by?: string | null
          requirement?: string
          resolved_at?: string | null
          resolved_by?: string | null
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
            foreignKeyName: "visa_document_requests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
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
          {
            foreignKeyName: "visa_document_requests_resolved_by_fkey"
            columns: ["resolved_by"]
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
          expires_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          is_current: boolean
          member_id: string | null
          rejection_reason: string | null
          request_id: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          supersedes_id: string | null
          uploaded_by: string
          version: number
        }
        Insert: {
          application_id: string
          content_type?: string | null
          created_at?: string
          document_type: string
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_current?: boolean
          member_id?: string | null
          rejection_reason?: string | null
          request_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          supersedes_id?: string | null
          uploaded_by: string
          version?: number
        }
        Update: {
          application_id?: string
          content_type?: string | null
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_current?: boolean
          member_id?: string | null
          rejection_reason?: string | null
          request_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          supersedes_id?: string | null
          uploaded_by?: string
          version?: number
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
            foreignKeyName: "visa_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "visa_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "visa_document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "visa_documents"
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
          {
            foreignKeyName: "visa_members_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_nationality_rules: {
        Row: {
          created_at: string
          eligibility_requirements: string | null
          id: string
          nationality_code: string
          price: number | null
          processing_days_max: number | null
          processing_days_min: number | null
          processing_fee: number | null
          required_documents: Json | null
          updated_at: string
          visa_type_id: string
        }
        Insert: {
          created_at?: string
          eligibility_requirements?: string | null
          id?: string
          nationality_code: string
          price?: number | null
          processing_days_max?: number | null
          processing_days_min?: number | null
          processing_fee?: number | null
          required_documents?: Json | null
          updated_at?: string
          visa_type_id: string
        }
        Update: {
          created_at?: string
          eligibility_requirements?: string | null
          id?: string
          nationality_code?: string
          price?: number | null
          processing_days_max?: number | null
          processing_days_min?: number | null
          processing_fee?: number | null
          required_documents?: Json | null
          updated_at?: string
          visa_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_nationality_rules_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["visa_type_id"]
          },
          {
            foreignKeyName: "visa_nationality_rules_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_passport_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          delivery_mode: string | null
          from_status: string | null
          id: string
          note: string | null
          passport_id: string
          reference: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          delivery_mode?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          passport_id: string
          reference?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          delivery_mode?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          passport_id?: string
          reference?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_passport_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_passport_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_passport_events_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "visa_passports"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_passports: {
        Row: {
          application_id: string
          authorization_document_id: string | null
          collector_name: string | null
          courier_name: string | null
          created_at: string
          delivery_mode: string | null
          holder_name: string | null
          id: string
          member_id: string | null
          status: string
          tracking_reference: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          authorization_document_id?: string | null
          collector_name?: string | null
          courier_name?: string | null
          created_at?: string
          delivery_mode?: string | null
          holder_name?: string | null
          id?: string
          member_id?: string | null
          status?: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          authorization_document_id?: string | null
          collector_name?: string | null
          courier_name?: string | null
          created_at?: string
          delivery_mode?: string | null
          holder_name?: string | null
          id?: string
          member_id?: string | null
          status?: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_passports_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_passports_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_passports_authorization_document_id_fkey"
            columns: ["authorization_document_id"]
            isOneToOne: false
            referencedRelation: "visa_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_passports_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "visa_members"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_processing_jobs: {
        Row: {
          application_id: string
          appointment_date: string | null
          appointment_id: string | null
          centre_id: string | null
          centre_status: string
          centre_status_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          failure_reason: string | null
          id: string
          lodged_with: string | null
          lodgement_date: string | null
          lodgement_reference: string | null
          partner_last_synced_at: string | null
          partner_raw_payload: Json | null
          partner_ref: string | null
          partner_status: string | null
          processing_stage: string
          provider_key: string | null
          receipt_document_id: string | null
          returned_reason: string | null
          route: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          application_id: string
          appointment_date?: string | null
          appointment_id?: string | null
          centre_id?: string | null
          centre_status?: string
          centre_status_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          lodged_with?: string | null
          lodgement_date?: string | null
          lodgement_reference?: string | null
          partner_last_synced_at?: string | null
          partner_raw_payload?: Json | null
          partner_ref?: string | null
          partner_status?: string | null
          processing_stage?: string
          provider_key?: string | null
          receipt_document_id?: string | null
          returned_reason?: string | null
          route: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          application_id?: string
          appointment_date?: string | null
          appointment_id?: string | null
          centre_id?: string | null
          centre_status?: string
          centre_status_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          lodged_with?: string | null
          lodgement_date?: string | null
          lodgement_reference?: string | null
          partner_last_synced_at?: string | null
          partner_raw_payload?: Json | null
          partner_ref?: string | null
          partner_status?: string | null
          processing_stage?: string
          provider_key?: string | null
          receipt_document_id?: string | null
          returned_reason?: string | null
          route?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_processing_jobs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_jobs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_jobs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "visa_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_jobs_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "visa_application_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_jobs_receipt_document_id_fkey"
            columns: ["receipt_document_id"]
            isOneToOne: false
            referencedRelation: "visa_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_processing_notes: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_processing_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_processing_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_type_centres: {
        Row: {
          centre_id: string
          visa_type_id: string
        }
        Insert: {
          centre_id: string
          visa_type_id: string
        }
        Update: {
          centre_id?: string
          visa_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_type_centres_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "visa_application_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_type_centres_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_case_queue"
            referencedColumns: ["visa_type_id"]
          },
          {
            foreignKeyName: "visa_type_centres_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_types: {
        Row: {
          application_questions: Json
          cover_image: string | null
          created_at: string
          currency: string
          description: string | null
          destination_country_code: string
          eligibility_requirements: string | null
          entry_type: string
          id: string
          internal_sla_days: number
          is_featured: boolean
          name: string
          overview: string | null
          partner_provider_key: string | null
          passport_delivery_modes: string[]
          price: number
          processing_days_max: number | null
          processing_days_min: number | null
          processing_fee: number | null
          processing_mode: Database["public"]["Enums"]["visa_processing_mode"]
          required_documents: Json
          requires_appointment: boolean
          requires_biometrics: boolean
          requires_physical_passport: boolean
          status: Database["public"]["Enums"]["listing_status"]
          stay_days: number | null
          terms_and_conditions: string | null
          updated_at: string
          validity_days: number | null
          visa_category: string
        }
        Insert: {
          application_questions?: Json
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_country_code: string
          eligibility_requirements?: string | null
          entry_type?: string
          id?: string
          internal_sla_days?: number
          is_featured?: boolean
          name: string
          overview?: string | null
          partner_provider_key?: string | null
          passport_delivery_modes?: string[]
          price: number
          processing_days_max?: number | null
          processing_days_min?: number | null
          processing_fee?: number | null
          processing_mode?: Database["public"]["Enums"]["visa_processing_mode"]
          required_documents?: Json
          requires_appointment?: boolean
          requires_biometrics?: boolean
          requires_physical_passport?: boolean
          status?: Database["public"]["Enums"]["listing_status"]
          stay_days?: number | null
          terms_and_conditions?: string | null
          updated_at?: string
          validity_days?: number | null
          visa_category?: string
        }
        Update: {
          application_questions?: Json
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_country_code?: string
          eligibility_requirements?: string | null
          entry_type?: string
          id?: string
          internal_sla_days?: number
          is_featured?: boolean
          name?: string
          overview?: string | null
          partner_provider_key?: string | null
          passport_delivery_modes?: string[]
          price?: number
          processing_days_max?: number | null
          processing_days_min?: number | null
          processing_fee?: number | null
          processing_mode?: Database["public"]["Enums"]["visa_processing_mode"]
          required_documents?: Json
          requires_appointment?: boolean
          requires_biometrics?: boolean
          requires_physical_passport?: boolean
          status?: Database["public"]["Enums"]["listing_status"]
          stay_days?: number | null
          terms_and_conditions?: string | null
          updated_at?: string
          validity_days?: number | null
          visa_category?: string
        }
        Relationships: []
      }
    }
    Views: {
      visa_case_queue: {
        Row: {
          agency_id: string | null
          applicant_email: string | null
          applicant_name: string | null
          applicant_type: string | null
          application_ref: string | null
          appointment_attended: boolean | null
          assigned_to: string | null
          assignee_name: string | null
          attention: string | null
          centre_status: string | null
          created_at: string | null
          decision_outcome: string | null
          destination_country_code: string | null
          docs_pending: number | null
          docs_rejected: number | null
          docs_required: number | null
          docs_total: number | null
          docs_verified: number | null
          id: string | null
          last_activity_at: string | null
          next_appointment_at: string | null
          open_requests: number | null
          passports_outstanding: number | null
          passports_returned: number | null
          passports_total: number | null
          payment_state: string | null
          priority: string | null
          processing_stage: string | null
          requires_appointment: boolean | null
          requires_passport: boolean | null
          search_text: string | null
          sla_due_at: string | null
          stage_entered_at: string | null
          status: Database["public"]["Enums"]["visa_status"] | null
          submitted_at: string | null
          visa_type_id: string | null
          visa_type_name: string | null
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
            foreignKeyName: "visa_case_ops_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _allocate_hotel_booking: {
        Args: { b: Database["public"]["Tables"]["hotel_bookings"]["Row"] }
        Returns: string
      }
      _apply_order_cancellation: {
        Args: { reason?: string; target_order_id: string }
        Returns: undefined
      }
      _umrah_release_seats: {
        Args: { p_departure_id: string; p_seats: number }
        Returns: undefined
      }
      _umrah_reserve_seats: {
        Args: { p_departure_id: string; p_seats: number }
        Returns: undefined
      }
      _visa_apply_partner_status: {
        Args: {
          p_application_id: string
          p_status: Database["public"]["Enums"]["visa_status"]
        }
        Returns: Database["public"]["Enums"]["visa_status"]
      }
      _visa_appointment_label: { Args: { p_type: string }; Returns: string }
      _visa_appointment_when: {
        Args: { p_at: string; p_centre: string }
        Returns: string
      }
      _visa_assert_uploaded: {
        Args: {
          app: Database["public"]["Tables"]["visa_applications"]["Row"]
          p_storage_path: string
        }
        Returns: undefined
      }
      _visa_create_passports: {
        Args: { app: Database["public"]["Tables"]["visa_applications"]["Row"] }
        Returns: undefined
      }
      _visa_customer_blockers: {
        Args: { p_application_id: string }
        Returns: string
      }
      _visa_document_label: {
        Args: { p_application_id: string; p_document_type: string }
        Returns: string
      }
      _visa_insert_decision: {
        Args: {
          app: Database["public"]["Tables"]["visa_applications"]["Row"]
          p_authority: string
          p_decision_date: string
          p_letter_document_id: string
          p_notes: string
          p_outcome: string
          p_reason?: string
          p_reference: string
          p_source: string
          p_supersedes?: string
        }
        Returns: string
      }
      _visa_is_case_party: {
        Args: { app: Database["public"]["Tables"]["visa_applications"]["Row"] }
        Returns: boolean
      }
      _visa_log_event: {
        Args: {
          p_actor_kind?: string
          p_application_id: string
          p_customer_summary?: string
          p_data?: Json
          p_from?: Database["public"]["Enums"]["visa_status"]
          p_member?: string
          p_notify_customer?: boolean
          p_notify_staff?: boolean
          p_permission?: string
          p_reason?: string
          p_summary: string
          p_to?: Database["public"]["Enums"]["visa_status"]
          p_type: string
        }
        Returns: string
      }
      _visa_open_case: {
        Args: { p_application_id: string }
        Returns: {
          admin_notes: string | null
          agency_customer_id: string | null
          agency_id: string | null
          applicant_notes: string | null
          applicant_profile_id: string | null
          applicant_type: string
          application_ref: string
          contact_details: Json
          created_at: string
          currency: string
          current_step: number
          custom_answers: Json
          decided_at: string | null
          decided_by: string | null
          fee_amount: number
          id: string
          info_return_stage: Database["public"]["Enums"]["visa_status"] | null
          partner_last_synced_at: string | null
          partner_provider_key: string | null
          partner_raw_payload: Json | null
          partner_ref: string | null
          partner_status: string | null
          price: number
          resolved_documents: Json | null
          resolved_eligibility_requirements: string | null
          resolved_price: number | null
          resolved_processing_days_max: number | null
          resolved_processing_days_min: number | null
          resolved_processing_fee: number | null
          status: Database["public"]["Enums"]["visa_status"]
          submitted_at: string | null
          submitted_by: string
          travel_details: Json
          traveler_details: Json
          updated_at: string
          visa_type_id: string
          workflow: Json
        }
        SetofOptions: {
          from: "*"
          to: "visa_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _visa_request_customer_action: {
        Args: {
          app: Database["public"]["Tables"]["visa_applications"]["Row"]
          p_note: string
          p_permission: string
        }
        Returns: undefined
      }
      _visa_require: { Args: { p_perm: string }; Returns: undefined }
      _visa_required_slots: {
        Args: { p_application_id: string }
        Returns: {
          slot_key: string
          slot_label: string
        }[]
      }
      _visa_set_stage: {
        Args: {
          p_application_id: string
          p_bypass_map?: boolean
          p_customer_summary?: string
          p_note?: string
          p_notify?: boolean
          p_permission?: string
          p_to: Database["public"]["Enums"]["visa_status"]
        }
        Returns: Database["public"]["Enums"]["visa_status"]
      }
      _visa_submission_blocker: {
        Args: { p_application_id: string }
        Returns: string
      }
      _visa_trusted_writer: {
        Args: { p_application_id: string }
        Returns: boolean
      }
      add_hotel_manager: {
        Args: { p_email: string; p_hotel_id: string; p_permissions?: string[] }
        Returns: {
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          permissions: string[]
          profile_id: string
          status: Database["public"]["Enums"]["member_status"]
        }
        SetofOptions: {
          from: "*"
          to: "hotel_managers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_venue_manager: {
        Args: { p_email: string; p_permissions?: string[]; p_venue_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          permissions: string[]
          profile_id: string
          status: Database["public"]["Enums"]["member_status"]
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "venue_managers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_agent_leaderboard: {
        Args: { p_from: string; p_limit: number; p_to: string }
        Returns: Json
      }
      admin_bookings_by_type: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_dashboard_totals: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_nav_counts: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_order_activity: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_order_queue: {
        Args: {
          p_filter: string
          p_limit: number
          p_offset: number
          p_today: string
        }
        Returns: Json
      }
      admin_payout_queue_totals: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_signup_activity: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_top_hotels: { Args: { p_limit: number }; Returns: Json }
      admin_visa_status_counts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      agency_commission_report: {
        Args: {
          p_agency_id: string
          p_from?: string
          p_item_type?: string
          p_to?: string
        }
        Returns: Json
      }
      agency_customer_page: {
        Args: {
          p_agency_id: string
          p_limit: number
          p_offset: number
          p_search: string
          p_sort: string
        }
        Returns: Json
      }
      agency_earnings_summary: {
        Args: { target_agency_id: string }
        Returns: Json
      }
      agency_period_activity: {
        Args: { p_agency_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      applicant_can_edit: {
        Args: { p_status: string; p_submitted_at: string }
        Returns: boolean
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
      apply_umrah_stage_transition_internal: {
        Args: {
          p_actor?: string
          p_booking_id: string
          p_note?: string
          p_stage: Database["public"]["Enums"]["umrah_fulfillment_stage"]
        }
        Returns: Database["public"]["Enums"]["umrah_fulfillment_stage"]
      }
      apply_visa_partner_status_update: {
        Args: {
          p_application_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["visa_status"]
        }
        Returns: Database["public"]["Enums"]["visa_status"]
      }
      apply_visa_status_transition_internal: {
        Args: {
          p_actor?: string
          p_application_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["visa_status"]
        }
        Returns: Database["public"]["Enums"]["visa_status"]
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
      approve_venue_partner_application: {
        Args: { application_id: string; p_note?: string }
        Returns: string
      }
      assign_hotel_booking_room_unit: {
        Args: { p_booking_id: string; p_room_unit_id: string }
        Returns: undefined
      }
      audit_log_entity_types: {
        Args: Record<PropertyKey, never>
        Returns: {
          entity_type: string
        }[]
      }
      can_access_order: { Args: { target_order_id: string }; Returns: boolean }
      can_manage_hotel_managers: {
        Args: { p_hotel_id: string }
        Returns: boolean
      }
      can_manage_venue_managers: {
        Args: { p_venue_id: string }
        Returns: boolean
      }
      cancel_agency_topup: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      cancel_order: {
        Args: { reason?: string; target_order_id: string }
        Returns: undefined
      }
      clear_document_rejection: {
        Args: { p_application_id: string; p_doc_key: string; p_kind: string }
        Returns: undefined
      }
      convert_hold_to_checkout: {
        Args: { target_order_id: string }
        Returns: undefined
      }
      correct_visa_decision: {
        Args: {
          p_authority?: string
          p_decision_date?: string
          p_decision_id: string
          p_letter_document_id?: string
          p_outcome: string
          p_reason: string
          p_reference?: string
        }
        Returns: string
      }
      credit_agency_wallet_internal: {
        Args: {
          actor?: string
          target_agency_id: string
          target_order_id?: string
          tx_amount: number
          tx_note?: string
          tx_type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Returns: string
      }
      current_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      expire_stale_holds: { Args: Record<PropertyKey, never>; Returns: number }
      fail_agency_payout_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: undefined
      }
      fail_agency_topup: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      generate_affiliate_application_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_agency_application_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_agent_code: { Args: Record<PropertyKey, never>; Returns: string }
      generate_hall_booking_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_hotel_partner_application_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_umrah_request_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_venue_partner_application_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_visa_application_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_venue_occupied_ranges: {
        Args: { from_date: string; target_venue_id: string; to_date: string }
        Returns: {
          end_date: string
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      hall_booking_holds_venue: {
        Args: { p_status: Database["public"]["Enums"]["booking_status"] }
        Returns: boolean
      }
      hall_slots_overlap: {
        Args: {
          a_end: string
          a_from: string
          a_start: string
          a_to: string
          b_end: string
          b_from: string
          b_start: string
          b_to: string
        }
        Returns: boolean
      }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      complete_booking_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      hall_refund_quote: {
        Args: { p_as_of?: string; p_booking_id: string }
        Returns: {
          currency: string
          days_before: number
          deduction_percent: number
          paid_amount: number
          refund_amount: number
        }[]
      }
      hotel_guest_directory: {
        Args: { p_hotel_id: string }
        Returns: {
          booking_ids: string[]
          cancelled: number
          channel: string
          currency: string
          email: string
          first_stay: string
          full_name: string
          guest_key: string
          last_stay: string
          next_arrival: string
          no_shows: number
          phone: string
          room_nights: number
          stays: number
          total_spent: number
        }[]
      }
      hotel_nightly_rates: {
        Args: { p_from: string; p_room_ids: string[]; p_to: string }
        Returns: {
          night: string
          rate: number
          room_id: string
          rule_name: string
          source: string
        }[]
      }
      hotel_refund_quote: {
        Args: { p_as_of?: string; p_booking_id: string }
        Returns: {
          currency: string
          days_before: number
          deduction_percent: number
          paid_amount: number
          refund_amount: number
        }[]
      }
      my_affiliate_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      my_agency_admin_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_agency_booker_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_agency_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      my_hotel_partner_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_hotel_partner_owner_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_managed_hotel_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_managed_hotel_ids_with: { Args: { perm: string }; Returns: string[] }
      my_managed_venue_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_managed_venue_ids_with: { Args: { perm: string }; Returns: string[] }
      my_teammate_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      my_venue_partner_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      my_venue_partner_owner_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      resolve_hall_booking_request: {
        Args: {
          p_amount?: number
          p_decision: string
          p_note?: string
          p_request_id: string
        }
        Returns: undefined
      }
      resolve_hotel_booking_request: {
        Args: {
          p_amount?: number
          p_decision: string
          p_note?: string
          p_request_id: string
        }
        Returns: undefined
      }
      hotel_availability: {
        Args: {
          p_days?: number
          p_from: string
          p_hotel_id: string
          p_room_id?: string
        }
        Returns: {
          available: number
          b2b: number
          b2c: number
          booked: number
          capacity: number
          confirmed: number
          night: string
          pending: number
          price_override: number
          room_id: string
          room_name: string
          room_status: Database["public"]["Enums"]["listing_status"]
          room_total_units: number
        }[]
      }
      hotel_booking_front_desk_status: {
        Args: {
          p_as_of?: string
          p_check_in: string
          p_check_out: string
          p_checked_in_at: string
          p_checked_out_at: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: string
      }
      hotel_booking_holds_units: {
        Args: { p_status: Database["public"]["Enums"]["booking_status"] }
        Returns: boolean
      }
      hotel_manager_can_manage_bookings: {
        Args: { target_hotel_id: string }
        Returns: boolean
      }
      hotel_manager_can_manage_photos: {
        Args: { target_hotel_id: string }
        Returns: boolean
      }
      hotel_manager_has_permission: {
        Args: { perm: string; target_hotel_id: string }
        Returns: boolean
      }
      hotel_room_nights: {
        Args: {
          p_exclude_booking?: string
          p_from: string
          p_room_id: string
          p_to: string
        }
        Returns: {
          b2b: number
          b2c: number
          booked: number
          capacity: number
          confirmed: number
          night: string
          pending: number
          price_override: number
        }[]
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
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
      is_hotel_manager: { Args: { target_hotel_id: string }; Returns: boolean }
      is_hotel_partner_member: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      is_hotel_partner_owner: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      is_venue_manager: { Args: { target_venue_id: string }; Returns: boolean }
      is_venue_partner_member: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      is_venue_partner_owner: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      mark_agency_payout_sent: {
        Args: {
          p_method: string
          p_proof_path?: string
          p_reference?: string
          p_request_id: string
          p_sent_at?: string
        }
        Returns: undefined
      }
      my_operable_hotel_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      notify_admins_application_updated: {
        Args: { p_application_id: string; p_kind: string }
        Returns: undefined
      }
      partner_application_table: { Args: { p_kind: string }; Returns: string }
      promote_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      record_affiliate_commission_payout: {
        Args: {
          payout_amount: number
          payout_method?: string
          payout_ref?: string
          target_affiliate_id: string
          target_period_end?: string
          target_period_start?: string
        }
        Returns: string
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
      reject_venue_partner_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      remove_hotel_manager: {
        Args: { p_manager_id: string }
        Returns: undefined
      }
      remove_venue_manager: {
        Args: { p_manager_id: string }
        Returns: undefined
      }
      request_agency_markup_change: {
        Args: {
          p_action: string
          p_agency_id: string
          p_item_type?: string
          p_markup_type?: Database["public"]["Enums"]["markup_type"]
          p_value?: number
        }
        Returns: string
      }
      request_agency_payout: {
        Args: { p_agency_id: string; p_amount: number }
        Returns: string
      }
      request_agency_topup: {
        Args: {
          p_agency_id: string
          p_amount: number
          p_method: string
          p_note?: string
          p_proof_path?: string
          p_provider?: string
          p_rail: string
          p_reference?: string
        }
        Returns: string
      }
      reschedule_hotel_booking: {
        Args: {
          p_booking_id: string
          p_new_check_in: string
          p_new_check_out: string
        }
        Returns: string
      }
      resolve_visa_pricing: {
        Args: { p_nationality_code: string; p_visa_type_id: string }
        Returns: {
          eligibility_requirements: string
          price: number
          processing_days_max: number
          processing_days_min: number
          processing_fee: number
          required_documents: Json
        }[]
      }
      resolve_visa_processing_route: {
        Args: { p_visa_type_id: string }
        Returns: {
          provider_key: string
          route: string
        }[]
      }
      resubmit_kyc_document: {
        Args: {
          p_application_id: string
          p_doc_key: string
          p_expiry?: string
          p_file_name: string
          p_file_size: number
          p_kind: string
          p_label: string
          p_storage_path: string
        }
        Returns: undefined
      }
      review_agency_commission_entries: {
        Args: { p_decision: string; p_entry_ids: string[] }
        Returns: number
      }
      review_agency_markup_request: {
        Args: { p_decision: string; p_note?: string; p_request_id: string }
        Returns: undefined
      }
      review_agency_payout_request: {
        Args: { p_decision: string; p_note?: string; p_request_id: string }
        Returns: undefined
      }
      review_agency_topup: {
        Args: { p_decision: string; p_note?: string; p_request_id: string }
        Returns: undefined
      }
      room_units_left: {
        Args: { p_check_in: string; p_check_out: string; p_room_ids: string[] }
        Returns: {
          room_id: string
          units_left: number
        }[]
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
      set_umrah_booking_stage: {
        Args: {
          p_booking_id: string
          p_note?: string
          p_stage: Database["public"]["Enums"]["umrah_fulfillment_stage"]
        }
        Returns: Database["public"]["Enums"]["umrah_fulfillment_stage"]
      }
      settle_agency_payout_request: {
        Args: {
          p_method?: string
          p_paid_at?: string
          p_proof_path?: string
          p_reference?: string
          p_request_id: string
        }
        Returns: string
      }
      settle_agency_topup: {
        Args: { p_provider_ref?: string; p_request_id: string }
        Returns: string
      }
      shares_active_org_with: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      submit_visa_application: {
        Args: { p_application_id: string }
        Returns: {
          currency: string
          fee_amount: number
          price: number
        }[]
      }
      umrah_booking_holds_seats: {
        Args: {
          p_kind: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      update_hotel_manager_permissions: {
        Args: { p_manager_id: string; p_permissions: string[] }
        Returns: undefined
      }
      update_venue_manager_permissions: {
        Args: { p_manager_id: string; p_permissions: string[] }
        Returns: undefined
      }
      venue_manager_has_permission: {
        Args: { perm: string; target_venue_id: string }
        Returns: boolean
      }
      venue_slot_available: {
        Args: {
          p_end: string
          p_from?: string
          p_start: string
          p_to?: string
          p_venue_id: string
        }
        Returns: boolean
      }
      visa_application_outstanding_items: {
        Args: { p_application_id: string }
        Returns: string
      }
      visa_assign_case: {
        Args: { p_application_id: string; p_assignee: string }
        Returns: undefined
      }
      visa_attach_result_document: {
        Args: {
          p_application_id: string
          p_content_type?: string
          p_file_name?: string
          p_file_size?: number
          p_storage_path: string
        }
        Returns: string
      }
      visa_attach_staff_document: {
        Args: {
          p_application_id: string
          p_content_type?: string
          p_document_type: string
          p_file_name?: string
          p_file_size?: number
          p_storage_path: string
        }
        Returns: string
      }
      visa_book_appointment: {
        Args: {
          p_application_id: string
          p_biometrics_required?: boolean
          p_centre_id: string
          p_confirmation?: string
          p_member_id?: string
          p_scheduled_at: string
          p_type: string
        }
        Returns: string
      }
      visa_cancel_appointment: {
        Args: { p_appointment_id: string; p_reason: string }
        Returns: undefined
      }
      visa_cancel_case: {
        Args: { p_application_id: string; p_reason: string }
        Returns: undefined
      }
      visa_case_attention: {
        Args: { app: Database["public"]["Tables"]["visa_applications"]["Row"] }
        Returns: string
      }
      visa_case_readiness: {
        Args: { p_application_id: string }
        Returns: {
          applies: boolean
          detail: string
          key: string
          label: string
          ok: boolean
        }[]
      }
      visa_claim_case: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      visa_current_decision: {
        Args: { p_application_id: string }
        Returns: {
          application_id: string
          authority: string
          authority_reference: string | null
          correction_reason: string | null
          decision_date: string
          id: string
          letter_document_id: string | null
          notes: string | null
          outcome: string
          recorded_at: string
          recorded_by: string | null
          source: string
          supersedes_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "visa_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      visa_fulfil_document_request: {
        Args: {
          p_content_type?: string
          p_file_name?: string
          p_file_size?: number
          p_request_id: string
          p_storage_path: string
        }
        Returns: string
      }
      visa_log_document_access: {
        Args: { p_document_id: string }
        Returns: string
      }
      visa_mark_ready: {
        Args: { p_application_id: string; p_note?: string }
        Returns: undefined
      }
      visa_payment_state: {
        Args: { p_application_id: string }
        Returns: string
      }
      visa_queue_counts: { Args: Record<PropertyKey, never>; Returns: Json }
      visa_record_appointment_outcome: {
        Args: {
          p_appointment_id: string
          p_biometrics_completed?: boolean
          p_outcome: string
        }
        Returns: undefined
      }
      visa_record_decision: {
        Args: {
          p_application_id: string
          p_authority: string
          p_decision_date?: string
          p_letter_document_id?: string
          p_notes?: string
          p_outcome: string
          p_reference?: string
        }
        Returns: string
      }
      visa_record_partner_failure: {
        Args: {
          p_application_id: string
          p_provider_key: string
          p_reason: string
        }
        Returns: undefined
      }
      visa_record_partner_status: {
        Args: {
          p_application_id: string
          p_partner_status: string
          p_raw?: Json
        }
        Returns: undefined
      }
      visa_record_partner_submission: {
        Args: {
          p_application_id: string
          p_partner_ref: string
          p_partner_status?: string
          p_provider_key: string
        }
        Returns: string
      }
      visa_record_passport_event: {
        Args: {
          p_authorization_document_id?: string
          p_collector_name?: string
          p_delivery_mode?: string
          p_note?: string
          p_passport_id: string
          p_reference?: string
          p_to_status: string
        }
        Returns: undefined
      }
      visa_record_processing_update: {
        Args: {
          p_application_id: string
          p_customer_note?: string
          p_note?: string
          p_processing_stage: string
        }
        Returns: undefined
      }
      visa_record_submission: {
        Args: {
          p_application_id: string
          p_appointment_id?: string
          p_centre_id?: string
          p_lodged_with: string
          p_receipt_document_id?: string
          p_reference: string
          p_submitted_on?: string
        }
        Returns: string
      }
      visa_replace_document: {
        Args: {
          p_content_type?: string
          p_document_id: string
          p_file_name?: string
          p_file_size?: number
          p_storage_path: string
        }
        Returns: string
      }
      visa_request_document: {
        Args: {
          p_application_id: string
          p_description?: string
          p_due_date?: string
          p_requirement?: string
          p_title: string
        }
        Returns: string
      }
      visa_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_centre_id?: string
          p_confirmation?: string
          p_reason: string
          p_scheduled_at: string
        }
        Returns: string
      }
      visa_resolve_document_request: {
        Args: { p_reason?: string; p_request_id: string; p_resolution: string }
        Returns: undefined
      }
      visa_resume_case: {
        Args: { p_application_id: string; p_note?: string }
        Returns: Database["public"]["Enums"]["visa_status"]
      }
      visa_review_document: {
        Args: { p_decision: string; p_document_id: string; p_reason?: string }
        Returns: undefined
      }
      visa_send_message: {
        Args: { p_application_id: string; p_body: string }
        Returns: string
      }
      visa_set_case_priority: {
        Args: { p_application_id: string; p_priority: string }
        Returns: undefined
      }
      visa_staff_can: { Args: { p_perm: string }; Returns: boolean }
      visa_stage_label: {
        Args: { p_status: Database["public"]["Enums"]["visa_status"] }
        Returns: string
      }
      visa_start_review: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      visa_sync_partner_status: {
        Args: {
          p_application_id: string
          p_status: Database["public"]["Enums"]["visa_status"]
        }
        Returns: Database["public"]["Enums"]["visa_status"]
      }
      visa_update_submission: {
        Args: {
          p_application_id: string
          p_centre_status: string
          p_reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_language: "en" | "so" | "ar"
      account_status: "active" | "suspended" | "pending_verification"
      agency_member_role: "owner" | "staff"
      agency_role: "owner" | "admin" | "booking_staff" | "accountant" | "viewer"
      agency_status: "pending" | "active" | "suspended"
      app_role:
        | "customer"
        | "agent"
        | "hotel_partner"
        | "affiliate"
        | "admin"
        | "venue_partner"
        | "hotel_manager"
        | "venue_manager"
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
        | "waitlisted"
      commission_entry_status: "pending" | "confirmed" | "paid_out" | "reversed"
      conversion_status: "pending" | "approved" | "paid" | "reversed"
      deletion_request_status:
        "requested" | "in_review" | "completed" | "rejected" | "withdrawn"
      hotel_room_unit_status: "active" | "out_of_order" | "inactive"
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
        | "partially_paid"
      partner_account_status: "onboarding" | "live" | "suspended" | "offboarded"
      passenger_type: "adult" | "child" | "infant"
      payment_status:
        | "requires_action"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      payout_request_status:
        "pending" | "approved" | "processing" | "rejected" | "failed" | "paid"
      payout_status: "pending" | "processing" | "paid" | "failed"
      pilgrim_gender: "male" | "female"
      refund_request_status: "pending" | "approved" | "rejected"
      topup_status: "pending" | "approved" | "rejected" | "cancelled" | "failed"
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
      umrah_fulfillment_stage:
        | "booked"
        | "confirmed"
        | "visa_processing"
        | "visa_issued"
        | "travel_confirmed"
        | "documents_ready"
        | "completed"
      umrah_price_unit:
        "per_person" | "per_person_per_night" | "per_night" | "per_booking"
      umrah_service_category:
        | "hotel_makkah"
        | "hotel_madinah"
        | "flight"
        | "visa"
        | "transport"
        | "intercity"
        | "extra"
      umrah_tier: "basic" | "standard" | "premium"
      visa_processing_mode: "in_house" | "partner"
      visa_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "additional_info_required"
        | "ready_for_processing"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
      app_role: [
        "customer",
        "agent",
        "hotel_partner",
        "affiliate",
        "admin",
        "venue_partner",
        "hotel_manager",
        "venue_manager",
      ],
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
        "waitlisted",
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
      hotel_room_unit_status: ["active", "out_of_order", "inactive"],
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
        "partially_paid",
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
      payout_request_status: [
        "pending",
        "approved",
        "processing",
        "rejected",
        "failed",
        "paid",
      ],
      payout_status: ["pending", "processing", "paid", "failed"],
      pilgrim_gender: ["male", "female"],
      refund_request_status: ["pending", "approved", "rejected"],
      topup_status: ["pending", "approved", "rejected", "cancelled", "failed"],
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
      umrah_fulfillment_stage: [
        "booked",
        "confirmed",
        "visa_processing",
        "visa_issued",
        "travel_confirmed",
        "documents_ready",
        "completed",
      ],
      umrah_price_unit: [
        "per_person",
        "per_person_per_night",
        "per_night",
        "per_booking",
      ],
      umrah_service_category: [
        "hotel_makkah",
        "hotel_madinah",
        "flight",
        "visa",
        "transport",
        "intercity",
        "extra",
      ],
      umrah_tier: ["basic", "standard", "premium"],
      visa_processing_mode: ["in_house", "partner"],
      visa_status: [
        "draft",
        "submitted",
        "in_review",
        "additional_info_required",
        "ready_for_processing",
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
