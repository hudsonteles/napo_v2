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
      auditoria: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          motivo: string | null
          profile_id: string | null
          registro_id: string
          tabela: string
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          motivo?: string | null
          profile_id?: string | null
          registro_id: string
          tabela: string
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          motivo?: string | null
          profile_id?: string | null
          registro_id?: string
          tabela?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          eh_massa: boolean
          id: string
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eh_massa?: boolean
          id?: string
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eh_massa?: boolean
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ceps: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string
          created_at: string
          fonte: string
          logradouro: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade: string
          created_at?: string
          fonte: string
          logradouro?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string
          created_at?: string
          fonte?: string
          logradouro?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      config_operacao: {
        Row: {
          buffer_cutoff_min: number
          capacidade_freezer: number
          created_at: string
          fator_distancia_estimada: number
          frete_gratis_centavos: number
          horizonte_semanas: number
          id: string
          lat_cozinha: number
          limite_ajuste_pin_m: number
          limite_ocupacao_massa_pct: number
          lng_cozinha: number
          pagamento_minutos: number
          raio_km: number
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
          fator_distancia_estimada?: number
          frete_gratis_centavos?: number
          horizonte_semanas?: number
          id?: string
          lat_cozinha?: number
          limite_ajuste_pin_m?: number
          limite_ocupacao_massa_pct?: number
          lng_cozinha?: number
          pagamento_minutos?: number
          raio_km?: number
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
          fator_distancia_estimada?: number
          frete_gratis_centavos?: number
          horizonte_semanas?: number
          id?: string
          lat_cozinha?: number
          limite_ajuste_pin_m?: number
          limite_ocupacao_massa_pct?: number
          lng_cozinha?: number
          pagamento_minutos?: number
          raio_km?: number
          reserva_minutos?: number
          sub_teto_massa_dia?: number
          tempo_preparo_horas?: number
          teto_forno_dia?: number
          updated_at?: string
        }
        Relationships: []
      }
      consentimentos: {
        Row: {
          aceito_em: string
          created_at: string
          id: string
          ip: unknown | null
          profile_id: string
          tipo: Database["public"]["Enums"]["tipo_consentimento"]
          updated_at: string
          versao: string
        }
        Insert: {
          aceito_em?: string
          created_at?: string
          id?: string
          ip?: unknown | null
          profile_id: string
          tipo: Database["public"]["Enums"]["tipo_consentimento"]
          updated_at?: string
          versao: string
        }
        Update: {
          aceito_em?: string
          created_at?: string
          id?: string
          ip?: unknown | null
          profile_id?: string
          tipo?: Database["public"]["Enums"]["tipo_consentimento"]
          updated_at?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimentos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      enderecos: {
        Row: {
          apelido: string
          atendido: boolean
          ativo: boolean
          bairro: string | null
          cep: string
          cidade: string
          complemento: string | null
          created_at: string
          distancia_estimada: boolean
          distancia_km: number | null
          id: string
          lat: number
          lat_geocode: number | null
          lng: number
          lng_geocode: number | null
          logradouro: string
          motivo_nao_atendido: string | null
          numero: string
          padrao: boolean
          precisa_conferencia: boolean
          profile_id: string
          referencia: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          apelido: string
          atendido?: boolean
          ativo?: boolean
          bairro?: string | null
          cep: string
          cidade: string
          complemento?: string | null
          created_at?: string
          distancia_estimada?: boolean
          distancia_km?: number | null
          id?: string
          lat: number
          lat_geocode?: number | null
          lng: number
          lng_geocode?: number | null
          logradouro: string
          motivo_nao_atendido?: string | null
          numero: string
          padrao?: boolean
          precisa_conferencia?: boolean
          profile_id: string
          referencia?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          apelido?: string
          atendido?: boolean
          ativo?: boolean
          bairro?: string | null
          cep?: string
          cidade?: string
          complemento?: string | null
          created_at?: string
          distancia_estimada?: boolean
          distancia_km?: number | null
          id?: string
          lat?: number
          lat_geocode?: number | null
          lng?: number
          lng_geocode?: number | null
          logradouro?: string
          motivo_nao_atendido?: string | null
          numero?: string
          padrao?: boolean
          precisa_conferencia?: boolean
          profile_id?: string
          referencia?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      excecoes_area: {
        Row: {
          cep_prefixo: string
          created_at: string
          id: string
          motivo: string
          tipo: Database["public"]["Enums"]["tipo_excecao_area"]
          updated_at: string
        }
        Insert: {
          cep_prefixo: string
          created_at?: string
          id?: string
          motivo: string
          tipo: Database["public"]["Enums"]["tipo_excecao_area"]
          updated_at?: string
        }
        Update: {
          cep_prefixo?: string
          created_at?: string
          id?: string
          motivo?: string
          tipo?: Database["public"]["Enums"]["tipo_excecao_area"]
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
      faixas_frete: {
        Row: {
          created_at: string
          id: string
          km_ate: number
          km_de: number
          updated_at: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          id?: string
          km_ate: number
          km_de: number
          updated_at?: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          id?: string
          km_ate?: number
          km_de?: number
          updated_at?: string
          valor_centavos?: number
        }
        Relationships: []
      }
      faixas_preco: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          preco_centavos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          preco_centavos: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          preco_centavos?: number
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
        Relationships: [
          {
            foreignKeyName: "lotes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_eventos: {
        Row: {
          corpo: Json | null
          created_at: string
          detalhe: string | null
          id: string
          mp_payment_id: string | null
          pedido_id: string | null
          resultado: Database["public"]["Enums"]["resultado_evento_pagamento"]
          updated_at: string
        }
        Insert: {
          corpo?: Json | null
          created_at?: string
          detalhe?: string | null
          id?: string
          mp_payment_id?: string | null
          pedido_id?: string | null
          resultado: Database["public"]["Enums"]["resultado_evento_pagamento"]
          updated_at?: string
        }
        Update: {
          corpo?: Json | null
          created_at?: string
          detalhe?: string | null
          id?: string
          mp_payment_id?: string | null
          pedido_id?: string | null
          resultado?: Database["public"]["Enums"]["resultado_evento_pagamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_eventos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          custo_unitario_snapshot: number | null
          id: string
          nome_snapshot: string
          pedido_id: string
          preco_unitario_snapshot: number
          produto_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_unitario_snapshot?: number | null
          id?: string
          nome_snapshot: string
          pedido_id: string
          preco_unitario_snapshot: number
          produto_id: string
          quantidade: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_unitario_snapshot?: number | null
          id?: string
          nome_snapshot?: string
          pedido_id?: string
          preco_unitario_snapshot?: number
          produto_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          atividade_fiscal: Database["public"]["Enums"]["atividade_fiscal"]
          canal: Database["public"]["Enums"]["canal_pedido"]
          created_at: string
          dia_entrega: string
          endereco_id: string | null
          endereco_snapshot: Json
          expira_em: string
          forma_pagamento: string | null
          frete_centavos: number
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          numero: number
          pago_em: string | null
          profile_id: string
          reserva_id: string | null
          status: Database["public"]["Enums"]["status_pedido"]
          subtotal_centavos: number
          total_centavos: number
          updated_at: string
          veredito: Database["public"]["Enums"]["veredito_viabilidade"] | null
        }
        Insert: {
          atividade_fiscal?: Database["public"]["Enums"]["atividade_fiscal"]
          canal?: Database["public"]["Enums"]["canal_pedido"]
          created_at?: string
          dia_entrega: string
          endereco_id?: string | null
          endereco_snapshot: Json
          expira_em: string
          forma_pagamento?: string | null
          frete_centavos: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          numero?: number
          pago_em?: string | null
          profile_id: string
          reserva_id?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          subtotal_centavos: number
          total_centavos: number
          updated_at?: string
          veredito?: Database["public"]["Enums"]["veredito_viabilidade"] | null
        }
        Update: {
          atividade_fiscal?: Database["public"]["Enums"]["atividade_fiscal"]
          canal?: Database["public"]["Enums"]["canal_pedido"]
          created_at?: string
          dia_entrega?: string
          endereco_id?: string | null
          endereco_snapshot?: Json
          expira_em?: string
          forma_pagamento?: string | null
          frete_centavos?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          numero?: number
          pago_em?: string | null
          profile_id?: string
          reserva_id?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          subtotal_centavos?: number
          total_centavos?: number
          updated_at?: string
          veredito?: Database["public"]["Enums"]["veredito_viabilidade"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "producao_planejada_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          alergenos_contem: Database["public"]["Enums"]["alergeno"][]
          alergenos_pode_conter: Database["public"]["Enums"]["alergeno"][]
          ativo: boolean
          categoria_id: string
          conservacao: string | null
          created_at: string
          denominacao_venda: string | null
          descricao: string | null
          diametro_cm: number | null
          faixa_preco_id: string
          id: string
          nome: string
          ordem: number
          peso_liquido_g: number | null
          porcoes: number | null
          preco_override_centavos: number | null
          preparo: string | null
          ranking_mais_pedidas: number | null
          slug: string
          updated_at: string
          validade_dias: number | null
        }
        Insert: {
          alergenos_contem?: Database["public"]["Enums"]["alergeno"][]
          alergenos_pode_conter?: Database["public"]["Enums"]["alergeno"][]
          ativo?: boolean
          categoria_id: string
          conservacao?: string | null
          created_at?: string
          denominacao_venda?: string | null
          descricao?: string | null
          diametro_cm?: number | null
          faixa_preco_id: string
          id?: string
          nome: string
          ordem?: number
          peso_liquido_g?: number | null
          porcoes?: number | null
          preco_override_centavos?: number | null
          preparo?: string | null
          ranking_mais_pedidas?: number | null
          slug: string
          updated_at?: string
          validade_dias?: number | null
        }
        Update: {
          alergenos_contem?: Database["public"]["Enums"]["alergeno"][]
          alergenos_pode_conter?: Database["public"]["Enums"]["alergeno"][]
          ativo?: boolean
          categoria_id?: string
          conservacao?: string | null
          created_at?: string
          denominacao_venda?: string | null
          descricao?: string | null
          diametro_cm?: number | null
          faixa_preco_id?: string
          id?: string
          nome?: string
          ordem?: number
          peso_liquido_g?: number | null
          porcoes?: number | null
          preco_override_centavos?: number | null
          preparo?: string | null
          ranking_mais_pedidas?: number | null
          slug?: string
          updated_at?: string
          validade_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_faixa_preco_id_fkey"
            columns: ["faixa_preco_id"]
            isOneToOne: false
            referencedRelation: "faixas_preco"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "reservas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telefone_verificacoes: {
        Row: {
          codigo_hash: string
          created_at: string
          expira_em: string
          id: string
          invalidado_em: string | null
          ip: unknown | null
          profile_id: string
          telefone: string
          tentativas: number
          updated_at: string
          validado_em: string | null
        }
        Insert: {
          codigo_hash: string
          created_at?: string
          expira_em: string
          id?: string
          invalidado_em?: string | null
          ip?: unknown | null
          profile_id: string
          telefone: string
          tentativas?: number
          updated_at?: string
          validado_em?: string | null
        }
        Update: {
          codigo_hash?: string
          created_at?: string
          expira_em?: string
          id?: string
          invalidado_em?: string | null
          ip?: unknown | null
          profile_id?: string
          telefone?: string
          tentativas?: number
          updated_at?: string
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telefone_verificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_versoes: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          publicado_em: string
          tipo: Database["public"]["Enums"]["tipo_consentimento"]
          updated_at: string
          versao: string
          vigente: boolean
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          publicado_em?: string
          tipo: Database["public"]["Enums"]["tipo_consentimento"]
          updated_at?: string
          versao: string
          vigente?: boolean
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          publicado_em?: string
          tipo?: Database["public"]["Enums"]["tipo_consentimento"]
          updated_at?: string
          versao?: string
          vigente?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      exigir_admin_e_motivo: {
        Args: {
          motivo: string
        }
        Returns: string
      }
      horario_servidor: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_equipe: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      promover_usuario: {
        Args: {
          alvo: string
          novo_role: Database["public"]["Enums"]["user_role"]
          motivo: string
        }
        Returns: undefined
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
      validar_telefone_manual: {
        Args: {
          alvo: string
          telefone_e164: string
          motivo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      alergeno:
        | "gluten"
        | "leite"
        | "ovos"
        | "soja"
        | "amendoim"
        | "castanhas"
        | "avela"
        | "peixe"
        | "crustaceos"
      atividade_fiscal: "congelado_industrializado" | "fresca_balcao"
      canal_pedido: "site" | "balcao" | "whatsapp"
      resultado_evento_pagamento:
        | "confirmado"
        | "duplicado"
        | "assinatura_invalida"
        | "valor_divergente"
        | "pagamento_nao_aprovado"
        | "pedido_desconhecido"
        | "erro"
      status_pedido:
        | "aguardando_pagamento"
        | "pago"
        | "expirado"
        | "em_producao"
        | "pronto"
        | "em_rota"
        | "entregue"
        | "cancelado"
        | "estornado"
      status_reserva: "ativa" | "consumida" | "expirada" | "cancelada"
      tipo_consentimento: "termos" | "privacidade" | "marketing"
      tipo_excecao_area: "bloqueio" | "liberacao"
      tipo_excecao_calendario: "sem_producao" | "sem_entrega" | "entrega_extra"
      user_role: "cliente" | "atendente" | "cozinha" | "gerente" | "admin"
      veredito_viabilidade: "viavel" | "cutoff_vencido" | "sem_vaga"
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

