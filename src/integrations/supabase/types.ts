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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_modules: {
        Row: {
          account_id: string
          id: string
          is_enabled: boolean
          module_id: string
        }
        Insert: {
          account_id: string
          id?: string
          is_enabled?: boolean
          module_id: string
        }
        Update: {
          account_id?: string
          id?: string
          is_enabled?: boolean
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_modules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "service_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      account_settings: {
        Row: {
          account_id: string
          id: string
          updated_at: string
          vacation_days_per_year: number
          work_days: string[]
          work_end_time: string
          work_start_time: string
        }
        Insert: {
          account_id: string
          id?: string
          updated_at?: string
          vacation_days_per_year?: number
          work_days?: string[]
          work_end_time?: string
          work_start_time?: string
        }
        Update: {
          account_id?: string
          id?: string
          updated_at?: string
          vacation_days_per_year?: number
          work_days?: string[]
          work_end_time?: string
          work_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          postal_code: string | null
          tax_id: string | null
          type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          type: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          type?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          account_id: string
          check_in: string | null
          check_out: string | null
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          phone_number: string | null
          source: string
          user_id: string
          work_date: string
        }
        Insert: {
          account_id: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          phone_number?: string | null
          source?: string
          user_id: string
          work_date: string
        }
        Update: {
          account_id?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          phone_number?: string | null
          source?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_clients: {
        Row: {
          account_id: string
          address: string | null
          auto_journal_entry: boolean | null
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          city: string | null
          country: string | null
          created_at: string
          default_vat_percentage: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          plan_id: string | null
          postal_code: string | null
          status: string
          tax_id: string
          website: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          auto_journal_entry?: boolean | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_vat_percentage?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          postal_code?: string | null
          status?: string
          tax_id: string
          website?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          auto_journal_entry?: boolean | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_vat_percentage?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          postal_code?: string | null
          status?: string
          tax_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "client_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          account_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          account_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          position: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          position?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_plans: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          features: string[] | null
          id: string
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          account_id: string
          error_message: string | null
          id: string
          invoice_id: string
          recipient: string
          sent_at: string
          status: string
          type: string
        }
        Insert: {
          account_id: string
          error_message?: string | null
          id?: string
          invoice_id: string
          recipient: string
          sent_at?: string
          status?: string
          type?: string
        }
        Update: {
          account_id?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          recipient?: string
          sent_at?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          account_id: string
          category: string
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          id: string
          name: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          account_id: string
          category?: string
          created_at?: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          name: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          account_id?: string
          category?: string
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          name?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          account_id: string
          address: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          dni: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          position: string | null
          postal_code: string | null
          social_security_number: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          address?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          dni?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          postal_code?: string | null
          social_security_number?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          address?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          dni?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          postal_code?: string | null
          social_security_number?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_delete_requests: {
        Row: {
          account_id: string
          created_at: string
          id: string
          invoice_id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          invoice_id: string
          reason?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_delete_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_delete_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          amount_net: number
          amount_total: number
          amount_vat: number
          attachment_name: string | null
          attachment_path: string | null
          client_id: string
          concept: string
          created_at: string
          description: string | null
          id: string
          invoice_number: string | null
          issue_date: string
          status: string
          type: string
          vat_percentage: number
        }
        Insert: {
          account_id: string
          amount_net: number
          amount_total: number
          amount_vat: number
          attachment_name?: string | null
          attachment_path?: string | null
          client_id: string
          concept?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          issue_date: string
          status?: string
          type: string
          vat_percentage: number
        }
        Update: {
          account_id?: string
          amount_net?: number
          amount_total?: number
          amount_vat?: number
          attachment_name?: string | null
          attachment_path?: string | null
          client_id?: string
          concept?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          status?: string
          type?: string
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          date: string
          description: string
          entry_number: string | null
          id: string
          invoice_id: string | null
          status: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          date: string
          description?: string
          entry_number?: string | null
          id?: string
          invoice_id?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          entry_number?: string | null
          id?: string
          invoice_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_delete_requests: {
        Row: {
          account_id: string
          created_at: string
          entry_id: string
          id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          account_id: string
          created_at?: string
          entry_id: string
          id?: string
          reason?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_delete_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_delete_requests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          chart_account_id: string
          credit: number
          debit: number
          description: string
          entry_id: string
          id: string
        }
        Insert: {
          chart_account_id: string
          credit?: number
          debit?: number
          description?: string
          entry_id: string
          id?: string
        }
        Update: {
          chart_account_id?: string
          credit?: number
          debit?: number
          description?: string
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          account_id: string
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          reference_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_id: string
          category: string
          cost_price: number
          created_at: string
          current_stock: number
          description: string | null
          id: string
          is_active: boolean
          min_stock: number
          name: string
          sale_price: number
          sku: string
          unit: string
          updated_at: string
        }
        Insert: {
          account_id: string
          category?: string
          cost_price?: number
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          sale_price?: number
          sku: string
          unit?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          category?: string
          cost_price?: number
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          sale_price?: number
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_requests: {
        Row: {
          account_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          estimated_date: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          estimated_date?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          estimated_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          account_id: string
          amount_net: number
          amount_total: number
          amount_vat: number
          client_id: string
          concept: string
          created_at: string
          created_by: string
          frequency: string
          id: string
          is_active: boolean
          last_generated_at: string | null
          next_run_date: string
          type: string
          updated_at: string
          vat_percentage: number
        }
        Insert: {
          account_id: string
          amount_net: number
          amount_total: number
          amount_vat: number
          client_id: string
          concept?: string
          created_at?: string
          created_by: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          next_run_date: string
          type?: string
          updated_at?: string
          vat_percentage?: number
        }
        Update: {
          account_id?: string
          amount_net?: number
          amount_total?: number
          amount_vat?: number
          client_id?: string
          concept?: string
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          next_run_date?: string
          type?: string
          updated_at?: string
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          is_completed: boolean
          remind_at: string
          title: string
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          is_completed?: boolean
          remind_at: string
          title: string
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          is_completed?: boolean
          remind_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          id: string
        }
        Insert: {
          code: string
          id?: string
        }
        Update: {
          code?: string
          id?: string
        }
        Relationships: []
      }
      service_modules: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reason: string
          type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reason?: string
          type: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reason?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_accounts: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          role_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_accounts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          event: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_enabled: boolean
          phone_number_id: string
          updated_at: string
          verify_token: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          phone_number_id?: string
          updated_at?: string
          verify_token?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          phone_number_id?: string
          updated_at?: string
          verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_default_folders: {
        Args: { _account_id: string; _created_by: string; _user_id: string }
        Returns: undefined
      }
      get_user_account_id: { Args: { _user_id: string }; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
