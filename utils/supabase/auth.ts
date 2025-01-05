import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
} 