export type AppModule = 'finanzas' | 'habitos' | 'comidas' | 'memos'

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      households: Table<
        { id: string; invite_code: string; created_by: string; created_at: string },
        { id?: string; invite_code: string; created_by: string; created_at?: string },
        { invite_code?: string }
      >
      profiles: Table<
        {
          id: string
          household_id: string | null
          display_name: string
          created_at: string
        },
        {
          id: string
          household_id?: string | null
          display_name: string
          created_at?: string
        },
        { household_id?: string | null; display_name?: string }
      >
      base_salaries: Table<
        {
          id: string
          user_id: string
          amount: number
          effective_from: string
          created_at: string
        },
        {
          id?: string
          user_id: string
          amount: number
          effective_from: string
          created_at?: string
        },
        { amount?: number; effective_from?: string }
      >
      split_notices: Table<
        {
          id: string
          recipient_id: string
          effective_from: string
          recipient_percent: number
          partner_percent: number
          created_at: string
        },
        {
          id?: string
          recipient_id: string
          effective_from: string
          recipient_percent: number
          partner_percent: number
          created_at?: string
        },
        { recipient_percent?: number; partner_percent?: number }
      >
      income_extras: Table<
        {
          id: string
          user_id: string
          household_id: string
          amount: number
          label: string
          received_on: string
          notes: string | null
          mp_operation_id: string | null
          created_at: string
        },
        {
          id?: string
          user_id: string
          household_id: string
          amount: number
          label: string
          received_on: string
          notes?: string | null
          mp_operation_id?: string | null
          created_at?: string
        },
        { label?: string; amount?: number; notes?: string | null; mp_operation_id?: string | null }
      >
      categories: Table<
        {
          id: string
          household_id: string
          name: string
          emoji: string
          icon: string
          created_at: string
        },
        {
          id?: string
          household_id: string
          name: string
          emoji: string
          icon: string
          created_at?: string
        },
        { name?: string; emoji?: string; icon?: string }
      >
      expenses: Table<
        {
          id: string
          household_id: string
          owner_id: string
          payer_id: string
          category_id: string | null
          title: string | null
          amount: number
          spent_on: string
          period: string
          is_shared: boolean
          paid_from_bag: boolean
          notes: string | null
          mp_operation_id: string | null
          created_at: string
        },
        {
          id?: string
          household_id: string
          owner_id: string
          payer_id: string
          category_id?: string | null
          title?: string | null
          amount: number
          spent_on: string
          period?: string
          is_shared: boolean
          paid_from_bag?: boolean
          notes?: string | null
          mp_operation_id?: string | null
          created_at?: string
        },
        {
          title?: string | null
          amount?: number
          spent_on?: string
          period?: string
          payer_id?: string
          category_id?: string | null
          is_shared?: boolean
          paid_from_bag?: boolean
          notes?: string | null
          mp_operation_id?: string | null
        }
      >
      savings: Table<
        {
          id: string
          household_id: string
          name: string
          emoji: string
          icon: string
          target_amount: number | null
          target_date: string | null
          is_shared: boolean
          owner_id: string | null
          archived_at: string | null
          created_at: string
        },
        {
          id?: string
          household_id: string
          name: string
          emoji: string
          icon: string
          target_amount?: number | null
          target_date?: string | null
          is_shared: boolean
          owner_id?: string | null
          archived_at?: string | null
          created_at?: string
        },
        {
          name?: string
          emoji?: string
          icon?: string
          target_amount?: number | null
          target_date?: string | null
          archived_at?: string | null
        }
      >
      saving_opening_balances: Table<
        {
          saving_id: string
          user_id: string
          amount: number
        },
        {
          saving_id: string
          user_id: string
          amount: number
        },
        { amount?: number }
      >
      saving_moves: Table<
        {
          id: string
          saving_id: string
          household_id: string
          user_id: string
          kind: 'aporte' | 'retiro'
          amount: number
          spent_on: string
          period: string
          title: string | null
          notes: string | null
          created_at: string
        },
        {
          id?: string
          saving_id: string
          household_id: string
          user_id: string
          kind: 'aporte' | 'retiro'
          amount: number
          spent_on: string
          period?: string
          title?: string | null
          notes?: string | null
          created_at?: string
        },
        {
          saving_id?: string
          amount?: number
          spent_on?: string
          period?: string
          title?: string | null
          notes?: string | null
        }
      >
      fixed_expenses: Table<
        {
          id: string
          household_id: string
          owner_id: string | null
          category_id: string | null
          title: string
          emoji: string
          icon: string
          expected_amount: number
          due_day: number
          is_shared: boolean
          remind_days_before: number
          remind: boolean
          paused_at: string | null
          notes: string | null
          mp_source: 'credito_mp' | null
          updated_at: string | null
          updated_by: string | null
          created_at: string
        },
        {
          id?: string
          household_id: string
          owner_id: string | null
          category_id?: string | null
          title: string
          emoji: string
          icon: string
          expected_amount: number
          due_day: number
          is_shared: boolean
          remind_days_before?: number
          remind?: boolean
          paused_at?: string | null
          notes?: string | null
          mp_source?: 'credito_mp' | null
          created_at?: string
        },
        {
          title?: string
          emoji?: string
          icon?: string
          owner_id?: string | null
          category_id?: string | null
          expected_amount?: number
          due_day?: number
          is_shared?: boolean
          remind_days_before?: number
          remind?: boolean
          paused_at?: string | null
          notes?: string | null
          updated_by?: string | null
        }
      >
      fixed_expense_amounts: Table<
        {
          id: string
          fixed_expense_id: string
          amount: number
          effective_from: string
          created_by: string
          created_at: string
        },
        {
          id?: string
          fixed_expense_id: string
          amount: number
          effective_from: string
          created_by: string
          created_at?: string
        },
        { amount?: number; created_by?: string }
      >
      reminder_preferences: Table<
        {
          user_id: string
          enabled: boolean
          first_time: string
          second_time: string
          ask_times: string[]
          due_lead_days: number
          notify_shared: boolean
          sunday_summary: boolean
          push_enabled: boolean
          reviewed_on: string | null
          hidden_until: string | null
          updated_at: string
        },
        {
          user_id: string
          enabled?: boolean
          first_time?: string
          second_time?: string
          ask_times?: string[]
          due_lead_days?: number
          notify_shared?: boolean
          sunday_summary?: boolean
          push_enabled?: boolean
          reviewed_on?: string | null
          hidden_until?: string | null
          updated_at?: string
        },
        {
          enabled?: boolean
          first_time?: string
          second_time?: string
          ask_times?: string[]
          due_lead_days?: number
          notify_shared?: boolean
          sunday_summary?: boolean
          push_enabled?: boolean
          reviewed_on?: string | null
          hidden_until?: string | null
          updated_at?: string
        }
      >
      daily_statuses: Table<
        {
          user_id: string
          day: string
          kind: 'logged' | 'clear'
          updated_at: string
        },
        {
          user_id: string
          day: string
          kind: 'logged' | 'clear'
          updated_at?: string
        },
        {
          kind?: 'logged' | 'clear'
          updated_at?: string
        }
      >
      fixed_payments: Table<
        {
          id: string
          fixed_expense_id: string
          month: string
          paid_on: string
          payer_id: string
          amount: number
          expense_id: string | null
        },
        {
          id?: string
          fixed_expense_id: string
          month: string
          paid_on: string
          payer_id: string
          amount: number
          expense_id?: string | null
        },
        { paid_on?: string; amount?: number }
      >
      settlements: Table<
        {
          id: string
          household_id: string
          month: string
          debtor_id: string
          creditor_id: string
          amount: number
          settled_by: string
          settled_at: string
        },
        {
          id?: string
          household_id: string
          month: string
          debtor_id: string
          creditor_id: string
          amount: number
          settled_by: string
          settled_at?: string
        },
        { amount?: number }
      >
      push_subscriptions: Table<
        {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          daily_enabled: boolean
          dues_enabled: boolean
          created_at: string
        },
        {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          daily_enabled?: boolean
          dues_enabled?: boolean
          created_at?: string
        },
        { daily_enabled?: boolean; dues_enabled?: boolean }
      >
      user_modules: Table<
        { user_id: string; module: AppModule; enabled: boolean; updated_at: string },
        { user_id: string; module: AppModule; enabled?: boolean; updated_at?: string },
        { enabled?: boolean; updated_at?: string }
      >
      memos: Table<
        {
          id: string
          owner_id: string
          household_id: string
          text: string
          done: boolean
          shared: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          owner_id: string
          household_id: string
          text: string
          done?: boolean
          shared?: boolean
          created_at?: string
          updated_at?: string
        },
        { text?: string; done?: boolean; shared?: boolean; updated_at?: string }
      >
      habits: Table<
        {
          id: string
          owner_id: string
          name: string
          icon_name: string
          days_of_week: number[]
          archived: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          owner_id: string
          name: string
          icon_name?: string
          days_of_week: number[]
          archived?: boolean
          created_at?: string
          updated_at?: string
        },
        { name?: string; icon_name?: string; days_of_week?: number[]; archived?: boolean; updated_at?: string }
      >
      habit_checks: Table<
        { habit_id: string; day: string; done_at: string },
        { habit_id: string; day: string; done_at?: string },
        { done_at?: string }
      >
      nutrition_goals: Table<
        {
          owner_id: string
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          kcal: number | null
          updated_at: string
        },
        {
          owner_id: string
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          updated_at?: string
        },
        {
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          updated_at?: string
        }
      >
      meals: Table<
        {
          id: string
          owner_id: string
          eaten_on: string
          meal_type: string
          name: string
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          kcal: number | null
          portion_label: string | null
          portion_qty: number | null
          portion_grams: number | null
          food_source: string | null
          food_ref: string | null
          brand: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          owner_id: string
          eaten_on: string
          meal_type: string
          name: string
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          portion_label?: string | null
          portion_qty?: number | null
          portion_grams?: number | null
          food_source?: string | null
          food_ref?: string | null
          brand?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          eaten_on?: string
          meal_type?: string
          name?: string
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          portion_label?: string | null
          portion_qty?: number | null
          portion_grams?: number | null
          food_source?: string | null
          food_ref?: string | null
          brand?: string | null
          updated_at?: string
        }
      >
      saved_foods: Table<
        {
          id: string
          owner_id: string
          name: string
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          kcal: number | null
          portion_label: string | null
          portion_qty: number | null
          portion_grams: number | null
          food_source: string | null
          food_ref: string | null
          brand: string | null
          protein_per_100g: number | null
          carbs_per_100g: number | null
          fat_per_100g: number | null
          kcal_per_100g: number | null
          portions: unknown
        },
        {
          id?: string
          owner_id: string
          name: string
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          portion_label?: string | null
          portion_qty?: number | null
          portion_grams?: number | null
          food_source?: string | null
          food_ref?: string | null
          brand?: string | null
          protein_per_100g?: number | null
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          kcal_per_100g?: number | null
          portions?: unknown
        },
        {
          name?: string
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          portion_label?: string | null
          portion_qty?: number | null
          portion_grams?: number | null
          food_source?: string | null
          food_ref?: string | null
          brand?: string | null
          protein_per_100g?: number | null
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          kcal_per_100g?: number | null
          portions?: unknown
        }
      >
      common_foods: Table<
        {
          id: string
          name: string
          search_name: string
          protein_per_100g: number | null
          carbs_per_100g: number | null
          fat_per_100g: number | null
          kcal_per_100g: number | null
          portions: unknown
          source: string
          created_at: string
        },
        {
          id?: string
          name: string
          search_name: string
          protein_per_100g?: number | null
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          kcal_per_100g?: number | null
          portions?: unknown
          source?: string
          created_at?: string
        },
        {
          name?: string
          search_name?: string
          protein_per_100g?: number | null
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          kcal_per_100g?: number | null
          portions?: unknown
          source?: string
        }
      >
      transfers: Table<
        {
          id: string
          from_id: string
          to_id: string
          amount: number
          transferred_on: string
          period: string
          notes: string | null
          mp_operation_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          from_id: string
          to_id: string
          amount: number
          transferred_on: string
          period?: string
          notes?: string | null
          mp_operation_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        },
        {
          amount?: number
          transferred_on?: string
          period?: string
          notes?: string | null
          mp_operation_id?: string | null
        }
      >
      mp_counterpart_aliases: Table<
        {
          owner_id: string
          normalized_name: string
          user_id: string | null
        },
        {
          owner_id: string
          normalized_name: string
          user_id?: string | null
        },
        { user_id?: string | null }
      >
      mp_merchant_prefs: Table<
        {
          owner_id: string
          merchant_key: string
          category_id: string | null
          is_shared: boolean
          title: string | null
        },
        {
          owner_id: string
          merchant_key: string
          category_id?: string | null
          is_shared?: boolean
          title?: string | null
        },
        { category_id?: string | null; is_shared?: boolean; title?: string | null }
      >
    }
    Views: Record<string, never>
    Functions: {
      create_household: { Args: Record<string, never>; Returns: string }
      join_household: { Args: { invite: string }; Returns: string }
      import_mp_movements: {
        Args: {
          rows: unknown
          aliases?: unknown
          merchant_prefs?: unknown
          create_credito_mp?: boolean
        }
        Returns: { inserted: number; skipped: number }
      }
      delete_movements: {
        Args: {
          p_month: string
          expense_ids?: string[]
          extra_ids?: string[]
          transfer_ids?: string[]
          saving_move_ids?: string[]
        }
        Returns: { deleted: number }
      }
      household_split_percents: {
        Args: { target_month: string }
        Returns: { user_id: string; percent: number }[]
      }
      household_split_is_even: {
        Args: { target_month: string }
        Returns: boolean
      }
      year_balance: {
        Args: { target_year: number }
        Returns: Record<string, unknown>
      }
      preview_salary_split: {
        Args: { new_amount: number; effective_from: string; replacing: boolean }
        Returns: {
          my_old_percent: number
          my_new_percent: number
          partner_old_percent: number
          partner_new_percent: number
          shared_total: number
        }[]
      }
      settle_shared_month: {
        Args: {
          p_month: string
          p_debtor: string
          p_creditor: string
          p_amount: number
          p_expense_amount: number
          p_expense_debtor: string | null
        }
        Returns: string
      }
      undo_shared_month: {
        Args: { p_settlement: string }
        Returns: undefined
      }
    }
  }
}
