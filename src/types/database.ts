export type ViewMode = 'friendly' | 'accounting'
export type ContributionMode = 'free' | 'percentage'
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
          view_mode: ViewMode
          created_at: string
        },
        {
          id: string
          household_id?: string | null
          display_name: string
          view_mode?: ViewMode
          created_at?: string
        },
        { household_id?: string | null; display_name?: string; view_mode?: ViewMode }
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
      monthly_incomes: Table<
        {
          id: string
          user_id: string
          household_id: string
          month: string
          base_amount: number
        },
        {
          id?: string
          user_id: string
          household_id: string
          month: string
          base_amount: number
        },
        { base_amount?: number }
      >
      income_extras: Table<
        {
          id: string
          user_id: string
          household_id: string
          amount: number
          label: string
          received_on: string
          created_at: string
        },
        {
          id?: string
          user_id: string
          household_id: string
          amount: number
          label: string
          received_on: string
          created_at?: string
        },
        { label?: string; amount?: number }
      >
      savings_funds: Table<
        {
          id: string
          user_id: string
          name: string
          emoji: string
          icon: string
          target_amount: number
          target_date: string | null
          created_at: string
        },
        {
          id?: string
          user_id: string
          name: string
          emoji: string
          icon: string
          target_amount: number
          target_date?: string | null
          created_at?: string
        },
        { name?: string; emoji?: string; icon?: string; target_amount?: number; target_date?: string | null }
      >
      bag_movements: Table<
        {
          id: string
          user_id: string
          kind: string
          fund_id: string | null
          expense_id: string | null
          amount: number
          label: string
          happened_on: string
          created_at: string
        },
        {
          id?: string
          user_id: string
          kind: string
          fund_id?: string | null
          expense_id?: string | null
          amount: number
          label?: string
          happened_on: string
          created_at?: string
        },
        { label?: string; amount?: number }
      >
      extra_allocations: Table<
        {
          id: string
          extra_id: string
          user_id: string
          fund_id: string | null
          amount: number
        },
        {
          id?: string
          extra_id: string
          user_id: string
          fund_id: string | null
          amount: number
        },
        { amount?: number }
      >
      categories: Table<
        {
          id: string
          household_id: string
          owner_id: string | null
          name: string
          emoji: string
          icon: string
          created_at: string
        },
        {
          id?: string
          household_id: string
          owner_id: string | null
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
          category_id: string
          title: string
          amount: number
          spent_on: string
          is_shared: boolean
          paid_from_bag: boolean
          created_at: string
        },
        {
          id?: string
          household_id: string
          owner_id: string
          payer_id: string
          category_id: string
          title: string
          amount: number
          spent_on: string
          is_shared: boolean
          paid_from_bag?: boolean
          created_at?: string
        },
        { title?: string; amount?: number; is_shared?: boolean; paid_from_bag?: boolean }
      >
      shared_goals: Table<
        {
          id: string
          household_id: string
          name: string
          emoji: string
          icon: string
          target_amount: number
          target_date: string | null
          created_at: string
        },
        {
          id?: string
          household_id: string
          name: string
          emoji: string
          icon: string
          target_amount: number
          target_date?: string | null
          created_at?: string
        },
        { name?: string; emoji?: string; icon?: string; target_amount?: number; target_date?: string | null }
      >
      goal_contributions: Table<
        {
          id: string
          goal_id: string
          user_id: string
          amount: number
          mode: ContributionMode
          created_at: string
        },
        {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          mode: ContributionMode
          created_at?: string
        },
        { amount?: number }
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
          protein_g: number
          carbs_g: number | null
          fat_g: number | null
          kcal: number | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          owner_id: string
          eaten_on: string
          meal_type: string
          name: string
          protein_g: number
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          created_at?: string
          updated_at?: string
        },
        {
          eaten_on?: string
          meal_type?: string
          name?: string
          protein_g?: number
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
          updated_at?: string
        }
      >
      saved_foods: Table<
        {
          id: string
          owner_id: string
          name: string
          protein_g: number
          carbs_g: number | null
          fat_g: number | null
          kcal: number | null
        },
        {
          id?: string
          owner_id: string
          name: string
          protein_g: number
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
        },
        {
          name?: string
          protein_g?: number
          carbs_g?: number | null
          fat_g?: number | null
          kcal?: number | null
        }
      >
    }
    Views: Record<string, never>
    Functions: {
      create_household: { Args: Record<string, never>; Returns: string }
      join_household: { Args: { invite: string }; Returns: string }
      spend_from_gustos: {
        Args: { expense_title: string; category_id: string; expense_amount: number; spent_on: string }
        Returns: string
      }
      move_bag_money: {
        Args: {
          movement_kind: string
          target_fund: string
          movement_amount: number
          happened_on: string
          movement_label: string
        }
        Returns: string
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
    }
  }
}
