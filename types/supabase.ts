export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      usage_limits: {
        Row: {
          id: string
          user_id: string
          subscription_tier: string
          total_limit: number
          used_count: number
          reset_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_tier?: string
          total_limit?: number
          used_count?: number
          reset_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription_tier?: string
          total_limit?: number
          used_count?: number
          reset_date?: string
          created_at?: string
        }
      }
    }
  }
} 