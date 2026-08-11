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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      config_operacao: {
        Row: {
          buffer_cutoff_min: number
          capacidade_freezer: number
          created_at: string
          horizonte_semanas: number
          id: string
          limite_ocupacao_massa_pct: number
          reserva_minutos: number
          sub_teto_massa_dia: number
          tempo_preparo_horas: number
          teto_forno_dia: number
          updated_at: string
        }
        Insert: {
          buffer_cutoff_min?: number
          capacidade_freezer?: number
          created_at?: string
          horizonte_semanas?: number
          id?: string
          limite_ocupacao_massa_pct?: number
          reserva_minutos?: number
          sub_teto_massa_dia?: number
          tempo_preparo_horas?: number
          teto_forno_dia?: number
          updated_at?: string
        }
        Update: {
          buffer_cutoff_min?: number
          capacidade_freezer?: number
          created_at?: string
          horizonte_semanas?: number
          id?: string
          limite_ocupacao_massa_pct?: number
          reserva_minutos?: number
          sub_teto_massa_dia?: number
          tempo_preparo_horas?: number
          teto_forno_dia?: number
          updated_at?: string
        }
        Relationships: []
      }
      dias_semana_entrega: {
        Row: {
          created_at: string
          dia_semana: number
          entrega: boolean
          id: string
          janela_fim: string
          janela_inicio: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          entrega?: boolean
          id?: string
          janela_fim: string
          janela_inicio: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          entrega?: boolean
          id?: string
          janela_fim?: string
          janela_inicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      dias_semana_producao: {
        Row: {
          created_at: string
          dia_semana: number
          id: string
          produz: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          id?: string
          produz?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          id?: string
          produz?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      excecoes_calendario: {
        Row: {
          created_at: string
          data: string
          id: string
          motivo: string | null
          tipo: Database["public"]["Enums"]["tipo_excecao_calendario"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          motivo?: string | null
          tipo: Database["public"]["Enums"]["tipo_excecao_calendario"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          motivo?: string | null
          tipo?: Database["public"]["Enums"]["tipo_excecao_calendario"]
          updated_at?: string
        }
        Relationships: []
      }
      lotes: {
        Row: {
          ativo: boolean
          created_at: string
          dia_entrega_alocado: string | null
          id: string
          produto_id: string
          produzido_em: string
          quantidade: number
          updated_at: string
          validade: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_entrega_alocado?: string | null
          id?: string
          produto_id: string
          produzido_em: string
          quantidade: number
          updated_at?: string
          validade: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_entrega_alocado?: string | null
          id?: string
          produto_id?: string
          produzido_em?: string
          quantidade?: number
          updated_at?: string
          validade?: string
        }
        Relationships: []
      }
      producao_planejada: {
        Row: {
          created_at: string
          data: string
          id: string
          produto_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          produto_id: string
          quantidade: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          produto_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["user_role"]
          telefone: string | null
          telefone_validado_em: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          telefone_validado_em?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          telefone_validado_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservas: {
        Row: {
          created_at: string
          dia_entrega: string
          expira_em: string
          id: string
          pedido_id: string | null
          produto_id: string
          profile_id: string
          quantidade: number
          status: Database["public"]["Enums"]["status_reserva"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_entrega: string
          expira_em: string
          id?: string
          pedido_id?: string | null
          produto_id: string
          profile_id: string
          quantidade: number
          status?: Database["public"]["Enums"]["status_reserva"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_entrega?: string
          expira_em?: string
          id?: string
          pedido_id?: string | null
          produto_id?: string
          profile_id?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["status_reserva"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_profile_id_fkey"
            columns: ["profile_id"]
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
      horario_servidor: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      reservar_capacidade: {
        Args: {
          p_dia: string
          p_produto: string
          p_quantidade: number
          p_profile: string
          p_limite: number
        }
        Returns: {
          created_at: string
          dia_entrega: string
          expira_em: string
          id: string
          pedido_id: string | null
          produto_id: string
          profile_id: string
          quantidade: number
          status: Database["public"]["Enums"]["status_reserva"]
          updated_at: string
        }
      }
      vagas_ocupadas: {
        Args: {
          p_dia: string
          p_produto: string
        }
        Returns: number
      }
    }
    Enums: {
      status_reserva: "ativa" | "consumida" | "expirada" | "cancelada"
      tipo_excecao_calendario: "sem_producao" | "sem_entrega" | "entrega_extra"
      user_role: "cliente" | "atendente" | "cozinha" | "gerente" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

