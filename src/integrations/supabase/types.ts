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
      buildings: {
        Row: {
          city_id: string
          fractional_qty: number
          last_settled_at: string
          level: number
          resource: string
          user_id: string
        }
        Insert: {
          city_id: string
          fractional_qty?: number
          last_settled_at: string
          level?: number
          resource: string
          user_id: string
        }
        Update: {
          city_id?: string
          fractional_qty?: number
          last_settled_at?: string
          level?: number
          resource?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          eff_blue: number
          eff_green: number
          eff_red: number
          eff_yellow: number
          id: string
          lat: number
          lng: number
          name: string
          osm_id: string | null
          special: string | null
          tier: string
        }
        Insert: {
          eff_blue: number
          eff_green: number
          eff_red: number
          eff_yellow: number
          id: string
          lat: number
          lng: number
          name: string
          osm_id?: string | null
          special?: string | null
          tier?: string
        }
        Update: {
          eff_blue?: number
          eff_green?: number
          eff_red?: number
          eff_yellow?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          osm_id?: string | null
          special?: string | null
          tier?: string
        }
        Relationships: []
      }
      economist_score_events: {
        Row: {
          beneficiary_id: string
          claim_id: string
          contributor_id: string
          created_at: string
          id: string
          qty: number
          resource: string
          season_id: string
          verification: string
        }
        Insert: {
          beneficiary_id: string
          claim_id: string
          contributor_id: string
          created_at?: string
          id?: string
          qty: number
          resource: string
          season_id: string
          verification: string
        }
        Update: {
          beneficiary_id?: string
          claim_id?: string
          contributor_id?: string
          created_at?: string
          id?: string
          qty?: number
          resource?: string
          season_id?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "economist_score_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "poi_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economist_score_events_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_settings: {
        Row: {
          id: boolean
          testing_enabled: boolean
        }
        Insert: {
          id?: boolean
          testing_enabled?: boolean
        }
        Update: {
          id?: boolean
          testing_enabled?: boolean
        }
        Relationships: []
      }
      guilds: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      player_cities: {
        Row: {
          city_id: string
          explicitly_founded: boolean
          market_level: number
          unlocked_at: string
          user_id: string
          warehouse_level: number
        }
        Insert: {
          city_id: string
          explicitly_founded?: boolean
          market_level?: number
          unlocked_at?: string
          user_id: string
          warehouse_level?: number
        }
        Update: {
          city_id?: string
          explicitly_founded?: boolean
          market_level?: number
          unlocked_at?: string
          user_id?: string
          warehouse_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_cities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poi_claims: {
        Row: {
          created_at: string
          guild_id: string | null
          id: string
          poi_id: string
          resource: string
          resources_spent: number
          season_id: string
          user_id: string
          verification: string
        }
        Insert: {
          created_at?: string
          guild_id?: string | null
          id?: string
          poi_id: string
          resource: string
          resources_spent: number
          season_id: string
          user_id: string
          verification: string
        }
        Update: {
          created_at?: string
          guild_id?: string | null
          id?: string
          poi_id?: string
          resource?: string
          resources_spent?: number
          season_id?: string
          user_id?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "poi_claims_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poi_claims_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poi_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poi_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poi_visits: {
        Row: {
          created_at: string
          guild_id: string | null
          id: string
          poi_id: string
          season_id: string
          user_id: string
          verification: string
        }
        Insert: {
          created_at?: string
          guild_id?: string | null
          id?: string
          poi_id: string
          season_id: string
          user_id: string
          verification: string
        }
        Update: {
          created_at?: string
          guild_id?: string | null
          id?: string
          poi_id?: string
          season_id?: string
          user_id?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "poi_visits_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poi_visits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poi_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pois: {
        Row: {
          category: string
          elevation: number | null
          id: string
          lat: number
          lng: number
          name: string
          osm_id: string
          osm_tags: string | null
        }
        Insert: {
          category: string
          elevation?: number | null
          id: string
          lat: number
          lng: number
          name: string
          osm_id: string
          osm_tags?: string | null
        }
        Update: {
          category?: string
          elevation?: number | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          osm_id?: string
          osm_tags?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          color: string
          created_at: string
          current_city_id: string | null
          economy_migrated_at: string | null
          founded_count: number
          guild_id: string | null
          guild_joined_at: string | null
          home_city_id: string | null
          home_verified_at: string | null
          id: string
          sp_balance: number
          sp_spent: number
          spent_steps: number
          step_remainder: number
          steps_total: number
          test_steps: number
          time_offset_seconds: number
          username: string | null
          walked_verified: number
          wallet_steps: number
        }
        Insert: {
          color?: string
          created_at?: string
          current_city_id?: string | null
          economy_migrated_at?: string | null
          founded_count?: number
          guild_id?: string | null
          guild_joined_at?: string | null
          home_city_id?: string | null
          home_verified_at?: string | null
          id: string
          sp_balance?: number
          sp_spent?: number
          spent_steps?: number
          step_remainder?: number
          steps_total?: number
          test_steps?: number
          time_offset_seconds?: number
          username?: string | null
          walked_verified?: number
          wallet_steps?: number
        }
        Update: {
          color?: string
          created_at?: string
          current_city_id?: string | null
          economy_migrated_at?: string | null
          founded_count?: number
          guild_id?: string | null
          guild_joined_at?: string | null
          home_city_id?: string | null
          home_verified_at?: string | null
          id?: string
          sp_balance?: number
          sp_spent?: number
          spent_steps?: number
          step_remainder?: number
          steps_total?: number
          test_steps?: number
          time_offset_seconds?: number
          username?: string | null
          walked_verified?: number
          wallet_steps?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_city_id_fkey"
            columns: ["current_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_lots: {
        Row: {
          city_id: string
          holder_id: string
          location: string
          origin_user_id: string
          qty: number
          resource: string
        }
        Insert: {
          city_id?: string
          holder_id: string
          location: string
          origin_user_id: string
          qty: number
          resource: string
        }
        Update: {
          city_id?: string
          holder_id?: string
          location?: string
          origin_user_id?: string
          qty?: number
          resource?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_lots_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          ends_at: string
          id: string
          is_active: boolean
          name: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          cost_steps: number
          created_at: string
          from_city: string
          id: string
          qty: number
          recipient_id: string
          request_id: string | null
          resource: string
          sender_id: string
          sp_cost: number
          status: string
          to_city: string
        }
        Insert: {
          cost_steps?: number
          created_at?: string
          from_city: string
          id?: string
          qty: number
          recipient_id: string
          request_id?: string | null
          resource: string
          sender_id: string
          sp_cost: number
          status?: string
          to_city: string
        }
        Update: {
          cost_steps?: number
          created_at?: string
          from_city?: string
          id?: string
          qty?: number
          recipient_id?: string
          request_id?: string | null
          resource?: string
          sender_id?: string
          sp_cost?: number
          status?: string
          to_city?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_from_city_fkey"
            columns: ["from_city"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_to_city_fkey"
            columns: ["to_city"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      starter_lots: {
        Row: {
          city_id: string
          holder_id: string
          location: string
          qty: number
          resource: string
        }
        Insert: {
          city_id?: string
          holder_id: string
          location: string
          qty: number
          resource: string
        }
        Update: {
          city_id?: string
          holder_id?: string
          location?: string
          qty?: number
          resource?: string
        }
        Relationships: [
          {
            foreignKeyName: "starter_lots_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      step_transactions: {
        Row: {
          created_at: string
          delta_steps: number
          id: string
          kind: string
          note: string | null
          simulated: boolean
          sp: number
          steps: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_steps?: number
          id?: string
          kind: string
          note?: string | null
          simulated?: boolean
          sp: number
          steps?: number
          user_id: string
        }
        Update: {
          created_at?: string
          delta_steps?: number
          id?: string
          kind?: string
          note?: string | null
          simulated?: boolean
          sp?: number
          steps?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travels: {
        Row: {
          completed_at: string | null
          created_at: string
          distance_km: number
          from_city: string
          id: string
          paid_steps: number
          required_steps: number
          sp_paid: number
          sp_required: number
          status: string
          to_city: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          distance_km: number
          from_city: string
          id?: string
          paid_steps?: number
          required_steps?: number
          sp_paid?: number
          sp_required: number
          status?: string
          to_city: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          distance_km?: number
          from_city?: string
          id?: string
          paid_steps?: number
          required_steps?: number
          sp_paid?: number
          sp_required?: number
          status?: string
          to_city?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travels_from_city_fkey"
            columns: ["from_city"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travels_to_city_fkey"
            columns: ["to_city"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_step_events: {
        Row: {
          credited_steps: number
          event_key: string
          id: string
          source: string
          updated_at: string
          user_id: string
          walked_day: string
        }
        Insert: {
          credited_steps?: number
          event_key: string
          id?: string
          source: string
          updated_at?: string
          user_id: string
          walked_day: string
        }
        Update: {
          credited_steps?: number
          event_key?: string
          id?: string
          source?: string
          updated_at?: string
          user_id?: string
          walked_day?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_step_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _active_season: { Args: never; Returns: string }
      _add_lot: {
        Args: {
          p_city: string
          p_holder: string
          p_loc: string
          p_origin: string
          p_qty: number
          p_res: string
        }
        Returns: undefined
      }
      _add_starter: {
        Args: {
          p_city: string
          p_loc: string
          p_qty: number
          p_res: string
          p_uid: string
        }
        Returns: undefined
      }
      _haversine_km: {
        Args: { a_lat: number; a_lng: number; b_lat: number; b_lng: number }
        Returns: number
      }
      _market_capacity: {
        Args: { p_city: string; p_uid: string }
        Returns: number
      }
      _market_used: { Args: { p_city: string; p_uid: string }; Returns: number }
      _me: {
        Args: never
        Returns: {
          color: string
          created_at: string
          current_city_id: string | null
          economy_migrated_at: string | null
          founded_count: number
          guild_id: string | null
          guild_joined_at: string | null
          home_city_id: string | null
          home_verified_at: string | null
          id: string
          sp_balance: number
          sp_spent: number
          spent_steps: number
          step_remainder: number
          steps_total: number
          test_steps: number
          time_offset_seconds: number
          username: string | null
          walked_verified: number
          wallet_steps: number
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _require_testing: { Args: never; Returns: undefined }
      _res_label: { Args: { r: string }; Returns: string }
      _settle: { Args: { p_city: string; p_uid: string }; Returns: undefined }
      _spend_sp: {
        Args: {
          p_amount: number
          p_kind: string
          p_note: string
          p_uid: string
        }
        Returns: undefined
      }
      _spend_steps: {
        Args: {
          p_amount: number
          p_kind: string
          p_note: string
          p_uid: string
        }
        Returns: undefined
      }
      _take: {
        Args: {
          p_city: string
          p_holder: string
          p_loc: string
          p_qty: number
          p_res: string
        }
        Returns: Json
      }
      _take_supply: {
        Args: {
          p_city: string
          p_loc: string
          p_qty: number
          p_res: string
          p_uid: string
        }
        Returns: Json
      }
      _used_capacity: {
        Args: { p_city: string; p_uid: string }
        Returns: number
      }
      _virtual_km: { Args: { a: string; b: string }; Returns: number }
      _wh_cap: { Args: { p_city: string; p_uid: string }; Returns: number }
      build_or_upgrade: {
        Args: { p_city: string; p_resource: string }
        Returns: Json
      }
      cancel_travel: { Args: never; Returns: undefined }
      claim_poi: {
        Args: {
          p_accuracy: number
          p_lat: number
          p_lng: number
          p_mode: string
          p_poi: string
        }
        Returns: Json
      }
      complete_onboarding: {
        Args: { p_city: string; p_color?: string; p_username: string }
        Returns: undefined
      }
      complete_onboarding_test: {
        Args: { p_city: string; p_color: string; p_username: string }
        Returns: undefined
      }
      complete_onboarding_verified: {
        Args: {
          p_accuracy: number
          p_city: string
          p_color: string
          p_lat: number
          p_lng: number
          p_username: string
        }
        Returns: undefined
      }
      create_guild: { Args: { p_name: string }; Returns: Json }
      credit_verified_steps: {
        Args: {
          p_cumulative_steps: number
          p_day: string
          p_event_key: string
          p_source: string
          p_user: string
        }
        Returns: number
      }
      dev_advance_day: { Args: never; Returns: undefined }
      dev_grant_steps: { Args: { p_steps: number }; Returns: Json }
      dev_reset: { Args: never; Returns: undefined }
      found_settlement: { Args: { p_city: string }; Returns: Json }
      fund_travel: { Args: { p_amount: number }; Returns: Json }
      game_config: { Args: never; Returns: Json }
      get_guild: { Args: never; Returns: Json }
      get_guild_settlements: { Args: never; Returns: Json }
      get_leaderboards: {
        Args: { p_category: string; p_verification: string }
        Returns: Json
      }
      get_poi_detail: { Args: { p_poi: string }; Returns: Json }
      get_state: { Args: never; Returns: Json }
      join_guild: { Args: { p_code: string }; Returns: Json }
      leave_guild: { Args: never; Returns: undefined }
      prepare_expedition: {
        Args: { p_city: string; p_qty: number; p_resource: string }
        Returns: undefined
      }
      prepare_expedition_gps: {
        Args: {
          p_accuracy: number
          p_amounts: Json
          p_city: string
          p_lat: number
          p_lng: number
        }
        Returns: undefined
      }
      prepare_expedition_test: {
        Args: { p_amounts: Json; p_city: string }
        Returns: undefined
      }
      quote_shipment: {
        Args: { p_from: string; p_qty: number; p_to: string }
        Returns: number
      }
      send_shipment: {
        Args: {
          p_from: string
          p_qty: number
          p_recipient: string
          p_resource: string
          p_to: string
        }
        Returns: Json
      }
      send_shipment_safe: {
        Args: {
          p_from: string
          p_qty: number
          p_recipient: string
          p_request_id: string
          p_resource: string
          p_to: string
        }
        Returns: Json
      }
      set_player_color: { Args: { p_color: string }; Returns: undefined }
      set_testing_mode: { Args: { p_enabled: boolean }; Returns: undefined }
      start_travel: { Args: { p_city: string }; Returns: Json }
      testing_enabled: { Args: never; Returns: boolean }
      upgrade_facility: {
        Args: { p_city: string; p_kind: string }
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
