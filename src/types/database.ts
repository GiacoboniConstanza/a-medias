export type ViewMode = 'friendly' | 'accounting'
export type ContributionMode = 'free' | 'percentage'

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
          created_at: string
        },
        {
          id?: string
          user_id: string
          name: string
          emoji: string
          icon: string
          target_amount: number
          created_at?: string
        },
        { name?: string; emoji?: string; icon?: string; target_amount?: number }
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
          created_at?: string
        },
        { title?: string; amount?: number; is_shared?: boolean }
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
          created_at?: string
        },
        { title?: string; expected_amount?: number; due_day?: number }
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
    }
    Views: Record<string, never>
    Functions: {
      create_household: { Args: Record<string, never>; Returns: string }
      join_household: { Args: { invite: string }; Returns: string }
    }
  }
}
