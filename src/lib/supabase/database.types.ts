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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      administrative_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_state: string
          previous_state: string | null
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_state: string
          previous_state?: string | null
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_state?: string
          previous_state?: string | null
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          address_id: string | null
          address_snapshot: Json
          cancelled_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string
          id: string
          idempotency_key: string
          preferred_date: string
          service_id: string
          service_name: string
          status: string
          time_window: string
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          address_snapshot: Json
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string
          id?: string
          idempotency_key: string
          preferred_date: string
          service_id: string
          service_name: string
          status?: string
          time_window: string
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          address_snapshot?: Json
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string
          id?: string
          idempotency_key?: string
          preferred_date?: string
          service_id?: string
          service_name?: string
          status?: string
          time_window?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string
          city: string
          created_at: string
          customer_id: string
          id: string
          label: string
          landmark: string
          locality: string
          phone: string
          postal_code: string
          recipient_name: string
          state: string
          updated_at: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string
          city: string
          created_at?: string
          customer_id?: string
          id?: string
          label: string
          landmark?: string
          locality: string
          phone: string
          postal_code: string
          recipient_name: string
          state: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string
          city?: string
          created_at?: string
          customer_id?: string
          id?: string
          label?: string
          landmark?: string
          locality?: string
          phone?: string
          postal_code?: string
          recipient_name?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_profiles: {
        Row: {
          approved_image_reference: string | null
          biography: string
          created_at: string
          display_name: string
          experience_description: string
          public_visible: boolean
          qualifications_description: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_image_reference?: string | null
          biography?: string
          created_at?: string
          display_name?: string
          experience_description?: string
          public_visible?: boolean
          qualifications_description?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_image_reference?: string | null
          biography?: string
          created_at?: string
          display_name?: string
          experience_description?: string
          public_visible?: boolean
          qualifications_description?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_service_areas: {
        Row: {
          approved_at: string
          approved_by: string
          professional_id: string
          service_area_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          professional_id: string
          service_area_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          professional_id?: string
          service_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_service_areas_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "professional_service_areas_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          approved_at: string
          approved_by: string
          professional_id: string
          service_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          professional_id: string
          service_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_verifications: {
        Row: {
          created_at: string
          internal_notes: string
          professional_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          internal_notes?: string
          professional_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          internal_notes?: string
          professional_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_verifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professional_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string
          created_at: string
          currency: string
          detailed_description: string
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean
          is_published: boolean
          name: string
          price_minor: number | null
          short_description: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          currency?: string
          detailed_description?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          name: string
          price_minor?: number | null
          short_description?: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          currency?: string
          detailed_description?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          name?: string
          price_minor?: number | null
          short_description?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      booking_request_options: {
        Args: never
        Returns: {
          booking_horizon_days: number
          end_time: string
          label: string
          start_time: string
          window_key: string
        }[]
      }
      cancel_pending_booking_request: {
        Args: { p_booking_id: string }
        Returns: string
      }
      change_user_role: {
        Args: { new_role: string; reason?: string; target_user: string }
        Returns: undefined
      }
      ensure_own_profile: {
        Args: { new_full_name?: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_public_professionals: {
        Args: never
        Returns: {
          approved_image_reference: string
          biography: string
          display_name: string
          experience_description: string
          professional_id: string
          qualifications_description: string
        }[]
      }
      own_professional_verification: {
        Args: never
        Returns: {
          reviewed_at: string
          status: string
        }[]
      }
      review_professional: {
        Args: {
          make_public: boolean
          new_image_reference?: string
          new_internal_notes?: string
          new_status: string
          reason?: string
          target_user: string
        }
        Returns: undefined
      }
      submit_booking_request: {
        Args: {
          p_address_id: string
          p_customer_notes?: string
          p_idempotency_key: string
          p_preferred_date: string
          p_service_id: string
          p_time_window: string
        }
        Returns: string
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
