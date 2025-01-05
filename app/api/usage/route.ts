import { createClient } from '@/utils/supabase/server'
import { getSession } from '@/utils/supabase/auth'

export async function GET(req: Request) {
  const supabase = createClient()
  const session = await getSession()
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const { data, error } = await supabase
    .from('usage_limits')
    .select('*')
    .eq('user_id', session.user.id)
    .single()
    
  if (error) {
    return new Response('Error fetching usage data', { status: 500 })
  }
  
  return new Response(JSON.stringify(data))
} 