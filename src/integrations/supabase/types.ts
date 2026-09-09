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
      banners: {
        Row: {
          active: boolean
          created_at: string
          cta: string | null
          id: string
          image_url: string
          link: string | null
          price_list: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta?: string | null
          id?: string
          image_url: string
          link?: string | null
          price_list?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta?: string | null
          id?: string
          image_url?: string
          link?: string | null
          price_list?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          close_time: string | null
          created_at: string
          delivery_radius_km: number
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          manager: string | null
          name: string
          open_time: string | null
          phone: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          close_time?: string | null
          created_at?: string
          delivery_radius_km?: number
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          manager?: string | null
          name: string
          open_time?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          close_time?: string | null
          created_at?: string
          delivery_radius_km?: number
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          manager?: string | null
          name?: string
          open_time?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      catch_broadcasts: {
        Row: {
          harbour_source: string
          id: string
          is_active: boolean
          message: string
          sent_at: string
          sent_by: string | null
          target_category: string | null
          title: string
        }
        Insert: {
          harbour_source?: string
          id?: string
          is_active?: boolean
          message: string
          sent_at?: string
          sent_by?: string | null
          target_category?: string | null
          title: string
        }
        Update: {
          harbour_source?: string
          id?: string
          is_active?: boolean
          message?: string
          sent_at?: string
          sent_by?: string | null
          target_category?: string | null
          title?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          name: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: []
      }
      customer_suspensions: {
        Row: {
          phone: string
          reason: string | null
          suspended_at: string
        }
        Insert: {
          phone: string
          reason?: string | null
          suspended_at?: string
        }
        Update: {
          phone?: string
          reason?: string | null
          suspended_at?: string
        }
        Relationships: []
      }
      customer_wallets: {
        Row: {
          balance: number
          created_at: string
          referral_code: string
          referred_by: string | null
          total_earned: number
          total_redeemed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          referral_code: string
          referred_by?: string | null
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          referral_code?: string
          referred_by?: string | null
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_windows: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          cutoff_minutes: number
          end_time: string
          id: string
          label: string
          sort_order: number
          start_time: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          cutoff_minutes?: number
          end_time: string
          id?: string
          label: string
          sort_order?: number
          start_time: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          cutoff_minutes?: number
          end_time?: string
          id?: string
          label?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      driver_cash_settlements: {
        Row: {
          amount_collected: number
          amount_settled: number
          balance_remaining: number
          created_at: string
          driver_id: string | null
          driver_name: string
          driver_phone: string | null
          id: string
          notes: string | null
          order_ids: string[] | null
          orders_count: number
          payment_mode: string
          settled_at: string
          settled_by_id: string | null
          settled_by_name: string
          settlement_number: string
        }
        Insert: {
          amount_collected: number
          amount_settled: number
          balance_remaining?: number
          created_at?: string
          driver_id?: string | null
          driver_name: string
          driver_phone?: string | null
          id?: string
          notes?: string | null
          order_ids?: string[] | null
          orders_count?: number
          payment_mode?: string
          settled_at?: string
          settled_by_id?: string | null
          settled_by_name: string
          settlement_number: string
        }
        Update: {
          amount_collected?: number
          amount_settled?: number
          balance_remaining?: number
          created_at?: string
          driver_id?: string | null
          driver_name?: string
          driver_phone?: string | null
          id?: string
          notes?: string | null
          order_ids?: string[] | null
          orders_count?: number
          payment_mode?: string
          settled_at?: string
          settled_by_id?: string | null
          settled_by_name?: string
          settlement_number?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          device_type: string
          id: string
          role: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string
          id?: string
          role?: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string
          id?: string
          role?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      function_bookings: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string
          event_date: string
          event_type: string | null
          guest_count: number
          id: string
          items: Json
          notes: string | null
          status: string
          total_estimate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone: string
          event_date: string
          event_type?: string | null
          guest_count?: number
          id?: string
          items?: Json
          notes?: string | null
          status?: string
          total_estimate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string
          event_date?: string
          event_type?: string | null
          guest_count?: number
          id?: string
          items?: Json
          notes?: string | null
          status?: string
          total_estimate?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_accounts: {
        Row: {
          created_at: string
          id: string
          lifetime_points: number
          name: string | null
          phone: string
          points: number
          referral_code: string | null
          referred_by: string | null
          tier: string
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime_points?: number
          name?: string | null
          phone: string
          points?: number
          referral_code?: string | null
          referred_by?: string | null
          tier?: string
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lifetime_points?: number
          name?: string | null
          phone?: string
          points?: number
          referral_code?: string | null
          referred_by?: string | null
          tier?: string
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_delivery_pins: {
        Row: {
          attempts: number
          created_at: string
          customer_id: string | null
          max_attempts: number
          order_id: string
          pin_code: string
          pin_hash: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_id?: string | null
          max_attempts?: number
          order_id: string
          pin_code: string
          pin_hash: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_id?: string | null
          max_attempts?: number
          order_id?: string
          pin_code?: string
          pin_hash?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_pins_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_templates: {
        Row: {
          created_at: string
          created_by: string
          id: string
          items: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          items?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          items?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          actual_payment_method: string | null
          actual_payment_ref: string | null
          additional_charge_label: string | null
          additional_charges: number
          branch_id: string | null
          branch_name: string | null
          cancel_reason: string | null
          cancelled_by: string | null
          cod_settled: boolean
          complaint: string | null
          coupon_code: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_date: string | null
          delivery_fee: number
          delivery_note: string | null
          delivery_slot: string | null
          discount: number
          driver_id: string | null
          driver_name: string | null
          eta_minutes: number | null
          fulfillment_type: string
          gst_amount: number
          gst_percent: number | null
          id: string
          items: Json
          location_lat: number | null
          location_lng: number | null
          map_link: string | null
          notes: string | null
          order_number: string | null
          paid_to_bank_directly: boolean
          payment_method: string
          payment_status: string
          pos_amount_tendered: number | null
          pos_cashier_id: string | null
          pos_cashier_name: string | null
          pos_change_due: number | null
          pos_scale_weight_kg: number | null
          promotion_id: string | null
          referral_code: string | null
          refund_amount: number
          refunded_at: string | null
          settled_at: string | null
          settlement_id: string | null
          status: string
          status_history: Json
          stripe_refund_id: string | null
          stripe_session_id: string | null
          subtotal: number
          total: number
          updated_at: string
          upi_paid: boolean
          user_id: string | null
          whatsapp_sent: boolean
        }
        Insert: {
          actual_payment_method?: string | null
          actual_payment_ref?: string | null
          additional_charge_label?: string | null
          additional_charges?: number
          branch_id?: string | null
          branch_name?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          cod_settled?: boolean
          complaint?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_fee?: number
          delivery_note?: string | null
          delivery_slot?: string | null
          discount?: number
          driver_id?: string | null
          driver_name?: string | null
          eta_minutes?: number | null
          fulfillment_type?: string
          gst_amount?: number
          gst_percent?: number | null
          id?: string
          items?: Json
          location_lat?: number | null
          location_lng?: number | null
          map_link?: string | null
          notes?: string | null
          order_number?: string | null
          paid_to_bank_directly?: boolean
          payment_method?: string
          payment_status?: string
          pos_amount_tendered?: number | null
          pos_cashier_id?: string | null
          pos_cashier_name?: string | null
          pos_change_due?: number | null
          pos_scale_weight_kg?: number | null
          promotion_id?: string | null
          referral_code?: string | null
          refund_amount?: number
          refunded_at?: string | null
          settled_at?: string | null
          settlement_id?: string | null
          status?: string
          status_history?: Json
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          upi_paid?: boolean
          user_id?: string | null
          whatsapp_sent?: boolean
        }
        Update: {
          actual_payment_method?: string | null
          actual_payment_ref?: string | null
          additional_charge_label?: string | null
          additional_charges?: number
          branch_id?: string | null
          branch_name?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          cod_settled?: boolean
          complaint?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_fee?: number
          delivery_note?: string | null
          delivery_slot?: string | null
          discount?: number
          driver_id?: string | null
          driver_name?: string | null
          eta_minutes?: number | null
          fulfillment_type?: string
          gst_amount?: number
          gst_percent?: number | null
          id?: string
          items?: Json
          location_lat?: number | null
          location_lng?: number | null
          map_link?: string | null
          notes?: string | null
          order_number?: string | null
          paid_to_bank_directly?: boolean
          payment_method?: string
          payment_status?: string
          pos_amount_tendered?: number | null
          pos_cashier_id?: string | null
          pos_cashier_name?: string | null
          pos_change_due?: number | null
          pos_scale_weight_kg?: number | null
          promotion_id?: string | null
          referral_code?: string | null
          refund_amount?: number
          refunded_at?: string | null
          settled_at?: string | null
          settlement_id?: string | null
          status?: string
          status_history?: Json
          stripe_refund_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          upi_paid?: boolean
          user_id?: string | null
          whatsapp_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "orders_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "driver_cash_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_credentials: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          provider: string
          secret_key: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          provider?: string
          secret_key?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          provider?: string
          secret_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_ai_benefits: {
        Row: {
          benefits_en: Json
          benefits_hi: Json
          benefits_ta: Json
          calories_per_100g: string
          cooking_tips: Json
          disclaimer: string
          generated_at: string
          id: string
          model_used: string
          omega3_level: string
          product_id: string
          product_name: string
          protein_per_100g: string
        }
        Insert: {
          benefits_en?: Json
          benefits_hi?: Json
          benefits_ta?: Json
          calories_per_100g?: string
          cooking_tips?: Json
          disclaimer?: string
          generated_at?: string
          id?: string
          model_used?: string
          omega3_level?: string
          product_id: string
          product_name: string
          protein_per_100g?: string
        }
        Update: {
          benefits_en?: Json
          benefits_hi?: Json
          benefits_ta?: Json
          calories_per_100g?: string
          cooking_tips?: Json
          disclaimer?: string
          generated_at?: string
          id?: string
          model_used?: string
          omega3_level?: string
          product_id?: string
          product_name?: string
          protein_per_100g?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ai_benefits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          product_name: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          product_name: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          product_name?: string
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          allow_custom_qty: boolean
          benefits: string[] | null
          best_for: string | null
          branch_id: string | null
          calories: number | null
          catch_date: string | null
          category: string | null
          created_at: string
          description: string | null
          gst_included: boolean
          gst_percent: number
          id: string
          image_url: string | null
          is_available: boolean
          is_bestseller: boolean
          is_featured: boolean
          lab_tested: boolean
          low_stock_threshold: number | null
          name: string
          name_tamil: string | null
          old_price: number | null
          origin: string | null
          price: number
          protein: string | null
          rating: number
          recipe_steps: string | null
          recipe_title: string | null
          source_origin: string | null
          stock: number
          storage: string | null
          tags: string[] | null
          traceability: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          allow_custom_qty?: boolean
          benefits?: string[] | null
          best_for?: string | null
          branch_id?: string | null
          calories?: number | null
          catch_date?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          gst_included?: boolean
          gst_percent?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_bestseller?: boolean
          is_featured?: boolean
          lab_tested?: boolean
          low_stock_threshold?: number | null
          name: string
          name_tamil?: string | null
          old_price?: number | null
          origin?: string | null
          price: number
          protein?: string | null
          rating?: number
          recipe_steps?: string | null
          recipe_title?: string | null
          source_origin?: string | null
          stock?: number
          storage?: string | null
          tags?: string[] | null
          traceability?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          allow_custom_qty?: boolean
          benefits?: string[] | null
          best_for?: string | null
          branch_id?: string | null
          calories?: number | null
          catch_date?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          gst_included?: boolean
          gst_percent?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_bestseller?: boolean
          is_featured?: boolean
          lab_tested?: boolean
          low_stock_threshold?: number | null
          name?: string
          name_tamil?: string | null
          old_price?: number | null
          origin?: string | null
          price?: number
          protein?: string | null
          rating?: number
          recipe_steps?: string | null
          recipe_title?: string | null
          source_origin?: string | null
          stock?: number
          storage?: string | null
          tags?: string[] | null
          traceability?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          description: string | null
          discount_type: string
          id: string
          min_order: number
          name: string
          one_time_per_customer: boolean
          special_day: string | null
          target_phone: string | null
          type: string
          updated_at: string
          used_phones: string[]
          valid_from: string | null
          valid_to: string | null
          value: number
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string
          id?: string
          min_order?: number
          name: string
          one_time_per_customer?: boolean
          special_day?: string | null
          target_phone?: string | null
          type?: string
          updated_at?: string
          used_phones?: string[]
          valid_from?: string | null
          valid_to?: string | null
          value?: number
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string
          id?: string
          min_order?: number
          name?: string
          one_time_per_customer?: boolean
          special_day?: string | null
          target_phone?: string | null
          type?: string
          updated_at?: string
          used_phones?: string[]
          valid_from?: string | null
          valid_to?: string | null
          value?: number
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          balance_due: number
          catch_date: string
          created_at: string
          harbour_location: string | null
          id: string
          items: Json
          notes: string | null
          paid_amount: number
          payment_method: string
          payment_status: string
          supplier_id: string | null
          supplier_name: string
          total_amount: number
          voucher_number: string
        }
        Insert: {
          balance_due?: number
          catch_date?: string
          created_at?: string
          harbour_location?: string | null
          id?: string
          items?: Json
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          payment_status?: string
          supplier_id?: string | null
          supplier_name: string
          total_amount?: number
          voucher_number: string
        }
        Update: {
          balance_due?: number
          catch_date?: string
          created_at?: string
          harbour_location?: string | null
          id?: string
          items?: Json
          notes?: string | null
          paid_amount?: number
          payment_method?: string
          payment_status?: string
          supplier_id?: string | null
          supplier_name?: string
          total_amount?: number
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          active: boolean
          admin_reply: string | null
          comment: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          order_id: string | null
          photo_url: string | null
          product_id: string
          product_name: string | null
          rating: number
          updated_at: string
          verified: boolean
        }
        Insert: {
          active?: boolean
          admin_reply?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_id?: string | null
          photo_url?: string | null
          product_id: string
          product_name?: string | null
          rating?: number
          updated_at?: string
          verified?: boolean
        }
        Update: {
          active?: boolean
          admin_reply?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_id?: string | null
          photo_url?: string | null
          product_id?: string
          product_name?: string | null
          rating?: number
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          accent_color: string
          additional_charge_label: string
          additional_charge_value: number
          address_line: string | null
          allow_preorders_when_closed: boolean | null
          announcement: string | null
          base_delivery_fee: number
          block_during_lunch: boolean
          block_on_holidays: boolean
          business_vertical: string
          cashback_percent: number
          close_time: string | null
          closed_message: string | null
          cod_enabled: boolean
          complaint_window_hours: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          custom_holidays: Json | null
          default_gst_percent: number
          delivery_enabled: boolean
          delivery_fee: number
          delivery_radius_km: number
          express_delivery_enabled: boolean
          express_delivery_fee: number
          express_sla_mins: number
          facebook_url: string | null
          fcm_project_id: string | null
          fcm_server_key: string | null
          footer_about: string | null
          free_delivery_over: number
          fssai_number: string | null
          google_review_link: string | null
          gst_enabled: boolean
          gst_percent: number
          gstin: string | null
          harbour_alert_message: string | null
          harbour_alert_title: string | null
          harbour_source_name: string | null
          holiday_dates: string[]
          holidays: string | null
          home_show_allproducts: boolean
          home_show_banner: boolean
          home_show_bestsellers: boolean
          home_show_categories: boolean
          home_show_featured: boolean
          home_show_hero: boolean
          home_show_trust: boolean
          id: string
          instagram_url: string | null
          is_open: boolean
          live_alerts_enabled: boolean
          logo_url: string | null
          low_stock_threshold: number
          lunch_end: string | null
          lunch_start: string | null
          max_delivery_radius_km: number
          max_wallet_burn_percent: number
          min_order_value: number
          online_enabled: boolean
          open_time: string | null
          payment_gateway: string | null
          per_km_charge: number
          pickup_enabled: boolean
          primary_color: string
          printer_auto_cut: boolean
          printer_footer_text: string
          printer_header_line1: string
          printer_header_line2: string
          printer_open_drawer: boolean
          printer_paper_width: string
          privacy_content: string | null
          referral_reward_referee: number
          referral_reward_referrer: number
          refund_content: string | null
          require_online_payment: boolean | null
          serviceable_pincodes: string[]
          shop_lat: number | null
          shop_lng: number | null
          shop_logo: string | null
          show_stock_to_customers: boolean
          social_facebook: string | null
          social_instagram: string | null
          social_whatsapp: string | null
          social_x: string | null
          stock_urgency_threshold: number
          store_address: string | null
          store_lat: number | null
          store_lng: number | null
          store_map_link: string | null
          store_name: string
          support_email: string | null
          support_phone: string | null
          support_whatsapp: string | null
          tagline: string | null
          terms_and_conditions: string | null
          terms_content: string | null
          theme_color: string | null
          twitter_url: string | null
          updated_at: string
          upi_id: string | null
          upi_name: string
          vertical_badge_text: string | null
          vertical_banner_url: string | null
          vertical_tagline: string | null
          wallet_enabled: boolean
          weekly_holidays: string[]
          whatsapp_number: string | null
          working_days: Json | null
        }
        Insert: {
          accent_color?: string
          additional_charge_label?: string
          additional_charge_value?: number
          address_line?: string | null
          allow_preorders_when_closed?: boolean | null
          announcement?: string | null
          base_delivery_fee?: number
          block_during_lunch?: boolean
          block_on_holidays?: boolean
          business_vertical?: string
          cashback_percent?: number
          close_time?: string | null
          closed_message?: string | null
          cod_enabled?: boolean
          complaint_window_hours?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_holidays?: Json | null
          default_gst_percent?: number
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_radius_km?: number
          express_delivery_enabled?: boolean
          express_delivery_fee?: number
          express_sla_mins?: number
          facebook_url?: string | null
          fcm_project_id?: string | null
          fcm_server_key?: string | null
          footer_about?: string | null
          free_delivery_over?: number
          fssai_number?: string | null
          google_review_link?: string | null
          gst_enabled?: boolean
          gst_percent?: number
          gstin?: string | null
          harbour_alert_message?: string | null
          harbour_alert_title?: string | null
          harbour_source_name?: string | null
          holiday_dates?: string[]
          holidays?: string | null
          home_show_allproducts?: boolean
          home_show_banner?: boolean
          home_show_bestsellers?: boolean
          home_show_categories?: boolean
          home_show_featured?: boolean
          home_show_hero?: boolean
          home_show_trust?: boolean
          id?: string
          instagram_url?: string | null
          is_open?: boolean
          live_alerts_enabled?: boolean
          logo_url?: string | null
          low_stock_threshold?: number
          lunch_end?: string | null
          lunch_start?: string | null
          max_delivery_radius_km?: number
          max_wallet_burn_percent?: number
          min_order_value?: number
          online_enabled?: boolean
          open_time?: string | null
          payment_gateway?: string | null
          per_km_charge?: number
          pickup_enabled?: boolean
          primary_color?: string
          printer_auto_cut?: boolean
          printer_footer_text?: string
          printer_header_line1?: string
          printer_header_line2?: string
          printer_open_drawer?: boolean
          printer_paper_width?: string
          privacy_content?: string | null
          referral_reward_referee?: number
          referral_reward_referrer?: number
          refund_content?: string | null
          require_online_payment?: boolean | null
          serviceable_pincodes?: string[]
          shop_lat?: number | null
          shop_lng?: number | null
          shop_logo?: string | null
          show_stock_to_customers?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          stock_urgency_threshold?: number
          store_address?: string | null
          store_lat?: number | null
          store_lng?: number | null
          store_map_link?: string | null
          store_name?: string
          support_email?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          terms_content?: string | null
          theme_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          upi_id?: string | null
          upi_name?: string
          vertical_badge_text?: string | null
          vertical_banner_url?: string | null
          vertical_tagline?: string | null
          wallet_enabled?: boolean
          weekly_holidays?: string[]
          whatsapp_number?: string | null
          working_days?: Json | null
        }
        Update: {
          accent_color?: string
          additional_charge_label?: string
          additional_charge_value?: number
          address_line?: string | null
          allow_preorders_when_closed?: boolean | null
          announcement?: string | null
          base_delivery_fee?: number
          block_during_lunch?: boolean
          block_on_holidays?: boolean
          business_vertical?: string
          cashback_percent?: number
          close_time?: string | null
          closed_message?: string | null
          cod_enabled?: boolean
          complaint_window_hours?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_holidays?: Json | null
          default_gst_percent?: number
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_radius_km?: number
          express_delivery_enabled?: boolean
          express_delivery_fee?: number
          express_sla_mins?: number
          facebook_url?: string | null
          fcm_project_id?: string | null
          fcm_server_key?: string | null
          footer_about?: string | null
          free_delivery_over?: number
          fssai_number?: string | null
          google_review_link?: string | null
          gst_enabled?: boolean
          gst_percent?: number
          gstin?: string | null
          harbour_alert_message?: string | null
          harbour_alert_title?: string | null
          harbour_source_name?: string | null
          holiday_dates?: string[]
          holidays?: string | null
          home_show_allproducts?: boolean
          home_show_banner?: boolean
          home_show_bestsellers?: boolean
          home_show_categories?: boolean
          home_show_featured?: boolean
          home_show_hero?: boolean
          home_show_trust?: boolean
          id?: string
          instagram_url?: string | null
          is_open?: boolean
          live_alerts_enabled?: boolean
          logo_url?: string | null
          low_stock_threshold?: number
          lunch_end?: string | null
          lunch_start?: string | null
          max_delivery_radius_km?: number
          max_wallet_burn_percent?: number
          min_order_value?: number
          online_enabled?: boolean
          open_time?: string | null
          payment_gateway?: string | null
          per_km_charge?: number
          pickup_enabled?: boolean
          primary_color?: string
          printer_auto_cut?: boolean
          printer_footer_text?: string
          printer_header_line1?: string
          printer_header_line2?: string
          printer_open_drawer?: boolean
          printer_paper_width?: string
          privacy_content?: string | null
          referral_reward_referee?: number
          referral_reward_referrer?: number
          refund_content?: string | null
          require_online_payment?: boolean | null
          serviceable_pincodes?: string[]
          shop_lat?: number | null
          shop_lng?: number | null
          shop_logo?: string | null
          show_stock_to_customers?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          stock_urgency_threshold?: number
          store_address?: string | null
          store_lat?: number | null
          store_lng?: number | null
          store_map_link?: string | null
          store_name?: string
          support_email?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          terms_content?: string | null
          theme_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          upi_id?: string | null
          upi_name?: string
          vertical_badge_text?: string | null
          vertical_banner_url?: string | null
          vertical_tagline?: string | null
          wallet_enabled?: boolean
          weekly_holidays?: string[]
          whatsapp_number?: string | null
          working_days?: Json | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string
          frequency: string
          fulfillment_type: string
          id: string
          items: Json
          next_delivery_date: string
          notes: string | null
          payment_method: string
          status: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          frequency?: string
          fulfillment_type?: string
          id?: string
          items?: Json
          next_delivery_date: string
          notes?: string | null
          payment_method?: string
          status?: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          frequency?: string
          fulfillment_type?: string
          id?: string
          items?: Json
          next_delivery_date?: string
          notes?: string | null
          payment_method?: string
          status?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          balance_due: number
          contact_person: string | null
          created_at: string
          email: string | null
          gstin: string | null
          harbour: string | null
          id: string
          name: string
          phone: string
          updated_at: string
          upi_id: string | null
          whatsapp: string | null
        }
        Insert: {
          balance_due?: number
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          harbour?: string | null
          id?: string
          name: string
          phone: string
          updated_at?: string
          upi_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          balance_due?: number
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          harbour?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
          upi_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      trust_badges: {
        Row: {
          active: boolean
          created_at: string
          icon: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "customer_wallets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      waste_entries: {
        Row: {
          action_taken: string
          cost_loss: number
          created_at: string
          entry_number: string
          id: string
          logged_by: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          reason: string
          unit: string
        }
        Insert: {
          action_taken?: string
          cost_loss?: number
          created_at?: string
          entry_number: string
          id?: string
          logged_by?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          reason: string
          unit?: string
        }
        Update: {
          action_taken?: string
          cost_loss?: number
          created_at?: string
          entry_number?: string
          id?: string
          logged_by?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      settle_driver_cod_orders_atomic: {
        Args: {
          p_amount_collected: number
          p_amount_settled: number
          p_balance_remaining: number
          p_driver_id: string
          p_driver_name: string
          p_driver_phone: string
          p_notes: string
          p_order_ids: string[]
          p_payment_mode: string
          p_settled_by_id: string
          p_settled_by_name: string
          p_settlement_number: string
        }
        Returns: Json
      }
      verify_and_deliver_order: {
        Args: {
          p_entered_pin: string
          p_is_admin_override?: boolean
          p_order_id: string
          p_override_reason?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "driver" | "user"
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
      app_role: ["admin", "staff", "driver", "user"],
    },
  },
} as const
