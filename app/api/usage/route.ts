import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const cookieStore = cookies()
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const { data, error } = await supabase
    .from('usage_limits')
    .select('total_limit, used_count, subscription_tier')
    .eq('user_id', user.id)
    .single()
    
  if (error) {
    console.error('Error fetching usage data:', error)
    // 如果是权限错误，返回 403
    if (error.code === '42501') {
      return new Response('Permission denied', { status: 403 })
    }
    return new Response('Error fetching usage data', { status: 500 })
  }
  
  return new Response(JSON.stringify({
    prompt_count: data?.used_count || 0,
    max_prompts: data?.total_limit || 50,
    subscription_tier: data?.subscription_tier || 'free'
  }))
}

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 首先获取当前使用量
  const { data: currentData, error: fetchError } = await supabase
    .from('usage_limits')
    .select('total_limit, used_count')
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    console.error('Error fetching usage data:', fetchError)
    // 如果是权限错误，返回 403
    if (fetchError.code === '42501') {
      return new Response('Permission denied', { status: 403 })
    }
    return new Response('Error fetching usage data', { status: 500 })
  }

  // 更新计数
  const { error: updateError } = await supabase
    .from('usage_limits')
    .update({ 
      used_count: (currentData.used_count || 0) + 1 
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error updating usage count:', updateError)
    // 如果是权限错误，返回 403
    if (updateError.code === '42501') {
      return new Response('Permission denied', { status: 403 })
    }
    return new Response('Error updating usage count', { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }))
} 