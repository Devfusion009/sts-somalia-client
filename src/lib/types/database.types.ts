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
      affiliate_applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          notes: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
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
          commission_rate: number
          contact_email: string
          contact_phone: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          credit_balance: number
          credit_limit: number
          id: string
          legal_name: string | null
          name: string
          registration_number: string | null
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
          credit_balance?: number
          credit_limit?: number
          id?: string
          legal_name?: string | null
          name: string
          registration_number?: string | null
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
          credit_balance?: number
          credit_limit?: number
          id?: string
          legal_name?: string | null
          name?: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["agency_status"]
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
        ]
      }
      agency_applications: {
        Row: {
          agency_name: string
          applicant_id: string
          business_details: Json
          created_at: string
          document_refs: Json
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          agency_name: string
          applicant_id: string
          business_details?: Json
          created_at?: string
          document_refs?: Json
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          agency_name?: string
          applicant_id?: string
          business_details?: Json
          created_at?: string
          document_refs?: Json
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
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
            foreignKeyName: "agency_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          role_in_agency: Database["public"]["Enums"]["agency_member_role"]
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          profile_id: string
          role_in_agency?: Database["public"]["Enums"]["agency_member_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          role_in_agency?: Database["public"]["Enums"]["agency_member_role"]
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
          business_details: Json
          business_name: string
          created_at: string
          document_refs: Json
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant_id: string
          business_details?: Json
          business_name: string
          created_at?: string
          document_refs?: Json
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant_id?: string
          business_details?: Json
          business_name?: string
          created_at?: string
          document_refs?: Json
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
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
            isOneToOne: false
            referencedRelation: "orders"
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
          affiliate_id: string | null
          agency_id: string | null
          booked_by: string
          created_at: string
          currency: string
          customer_id: string
          discount_total: number
          id: string
          notes: string | null
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          affiliate_id?: string | null
          agency_id?: string | null
          booked_by: string
          created_at?: string
          currency?: string
          customer_id: string
          discount_total?: number
          id?: string
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          affiliate_id?: string | null
          agency_id?: string | null
          booked_by?: string
          created_at?: string
          currency?: string
          customer_id?: string
          discount_total?: number
          id?: string
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
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
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          provider: string
          provider_customer_id: string | null
          provider_payment_method_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          provider: string
          provider_customer_id?: string | null
          provider_payment_method_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_payment_method_id?: string
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
          method_id: string | null
          order_id: string
          provider: string
          provider_payment_intent_id: string | null
          raw_payload: Json
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method_id?: string | null
          order_id: string
          provider: string
          provider_payment_intent_id?: string | null
          raw_payload?: Json
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method_id?: string | null
          order_id?: string
          provider?: string
          provider_payment_intent_id?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
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
          metadata?: Json
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
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
      umrah_packages: {
        Row: {
          base_price: number
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          hotel_madinah_id: string | null
          hotel_makkah_id: string | null
          id: string
          images: Json
          includes: Json
          name: string
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_days: number
          hotel_madinah_id?: string | null
          hotel_makkah_id?: string | null
          id?: string
          images?: Json
          includes?: Json
          name: string
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          hotel_madinah_id?: string | null
          hotel_makkah_id?: string | null
          id?: string
          images?: Json
          includes?: Json
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "umrah_packages_hotel_madinah_id_fkey"
            columns: ["hotel_madinah_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umrah_packages_hotel_makkah_id_fkey"
            columns: ["hotel_makkah_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          id: string
          price: number
          status: Database["public"]["Enums"]["visa_status"]
          submitted_by: string
          traveler_details: Json
          updated_at: string
          visa_type_id: string
        }
        Insert: {
          admin_notes?: string | null
          agency_id?: string | null
          applicant_notes?: string | null
          applicant_profile_id?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          price: number
          status?: Database["public"]["Enums"]["visa_status"]
          submitted_by: string
          traveler_details?: Json
          updated_at?: string
          visa_type_id: string
        }
        Update: {
          admin_notes?: string | null
          agency_id?: string | null
          applicant_notes?: string | null
          applicant_profile_id?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          price?: number
          status?: Database["public"]["Enums"]["visa_status"]
          submitted_by?: string
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
      visa_documents: {
        Row: {
          application_id: string
          created_at: string
          document_type: string
          id: string
          storage_path: string
          uploaded_by: string
          verified: boolean
        }
        Insert: {
          application_id: string
          created_at?: string
          document_type: string
          id?: string
          storage_path: string
          uploaded_by: string
          verified?: boolean
        }
        Update: {
          application_id?: string
          created_at?: string
          document_type?: string
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
      visa_types: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          destination_country_code: string
          id: string
          name: string
          price: number
          processing_days_max: number | null
          processing_days_min: number | null
          required_documents: Json
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          destination_country_code: string
          id?: string
          name: string
          price: number
          processing_days_max?: number | null
          processing_days_min?: number | null
          required_documents?: Json
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          destination_country_code?: string
          id?: string
          name?: string
          price?: number
          processing_days_max?: number | null
          processing_days_min?: number | null
          required_documents?: Json
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_affiliate_application: {
        Args: { application_id: string }
        Returns: string
      }
      approve_agency_application: {
        Args: { application_id: string }
        Returns: string
      }
      approve_hotel_partner_application: {
        Args: { application_id: string }
        Returns: string
      }
      can_access_order: { Args: { target_order_id: string }; Returns: boolean }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_affiliate_owner: {
        Args: { target_affiliate_id: string }
        Returns: boolean
      }
      is_agency_member: { Args: { target_agency_id: string }; Returns: boolean }
      is_agency_owner: { Args: { target_agency_id: string }; Returns: boolean }
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
      reject_affiliate_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      reject_agency_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      reject_hotel_partner_application: {
        Args: { application_id: string; notes?: string }
        Returns: undefined
      }
      set_account_status: {
        Args: {
          new_status: Database["public"]["Enums"]["account_status"]
          target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "pending_verification"
      agency_member_role: "owner" | "staff"
      agency_status: "pending" | "active" | "suspended"
      app_role: "customer" | "agent" | "hotel_partner" | "affiliate" | "admin"
      application_status: "pending" | "approved" | "rejected"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "refunded"
        | "no_show"
        | "failed"
      conversion_status: "pending" | "approved" | "paid" | "reversed"
      invoice_status: "draft" | "issued" | "paid" | "void"
      listing_status: "draft" | "pending_review" | "published" | "suspended"
      member_status: "active" | "invited" | "removed"
      order_item_type: "hotel" | "flight" | "visa" | "umrah"
      order_status:
        | "pending_payment"
        | "paid"
        | "processing"
        | "completed"
        | "cancelled"
        | "refunded"
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
      trip_type: "one_way" | "round_trip" | "multi_city"
      visa_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "additional_info_required"
        | "approved"
        | "rejected"
        | "issued"
        | "cancelled"
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
      account_status: ["active", "suspended", "pending_verification"],
      agency_member_role: ["owner", "staff"],
      agency_status: ["pending", "active", "suspended"],
      app_role: ["customer", "agent", "hotel_partner", "affiliate", "admin"],
      application_status: ["pending", "approved", "rejected"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "refunded",
        "no_show",
        "failed",
      ],
      conversion_status: ["pending", "approved", "paid", "reversed"],
      invoice_status: ["draft", "issued", "paid", "void"],
      listing_status: ["draft", "pending_review", "published", "suspended"],
      member_status: ["active", "invited", "removed"],
      order_item_type: ["hotel", "flight", "visa", "umrah"],
      order_status: [
        "pending_payment",
        "paid",
        "processing",
        "completed",
        "cancelled",
        "refunded",
      ],
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
      trip_type: ["one_way", "round_trip", "multi_city"],
      visa_status: [
        "draft",
        "submitted",
        "in_review",
        "additional_info_required",
        "approved",
        "rejected",
        "issued",
        "cancelled",
      ],
    },
  },
} as const

