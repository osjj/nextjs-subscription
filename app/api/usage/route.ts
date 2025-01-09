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

  // 首先尝试获取记录
  let { data, error } = await supabase
    .from('usage_limits')
    .select('total_limit, used_count, subscription_tier')
    .eq('user_id', user.id)
    .single()
    
  // 如果没有找到记录，创建一条新记录
  if (error?.code === 'PGRST116') {
    const { data: newData, error: insertError } = await supabase
      .from('usage_limits')
      .insert([
        { 
          user_id: user.id,
          subscription_tier: 'free',
          total_limit: 10,
          used_count: 0,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating usage record:', insertError)
      return new Response('Error creating usage record', { status: 500 })
    }

    data = newData
  } else if (error) {
    console.error('Error fetching usage data:', error)
    return new Response('Error fetching usage data', { status: 500 })
  }
  
  return new Response(JSON.stringify({
    prompt_count: data?.used_count || 0,
    max_prompts: data?.total_limit || 10,
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

  // 首先尝试获取记录
  let { data: currentData, error: fetchError } = await supabase
    .from('usage_limits')
    .select('total_limit, used_count')
    .eq('user_id', user.id)
    .single()

  // 如果没有找到记录，创建一条新记录
  if (fetchError?.code === 'PGRST116') {
    const { data: newData, error: insertError } = await supabase
      .from('usage_limits')
      .insert([
        { 
          user_id: user.id,
          subscription_tier: 'free',
          total_limit: 50,
          used_count: 1, // 直接设置为1，因为这是第一次使用
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating usage record:', insertError)
      return new Response('Error creating usage record', { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }))
  } else if (fetchError) {
    console.error('Error fetching usage data:', fetchError)
    return new Response('Error fetching usage data', { status: 500 })
  }

  // 如果找到记录，更新计数
  const { error: updateError } = await supabase
    .from('usage_limits')
    .update({ 
      used_count: (currentData.used_count || 0) + 1 
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error updating usage count:', updateError)
    return new Response('Error updating usage count', { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }))
} 