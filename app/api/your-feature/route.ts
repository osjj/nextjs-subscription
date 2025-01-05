import { checkAndUpdateUsageLimit } from '@/utils/supabase/admin'
import { getSession } from '@/utils/supabase/auth'

export async function POST(req: Request) {
  const session = await getSession() // 获取当前用户会话
  
  try {
    // 检查用户是否可以使用该功能
    const canUse = await checkAndUpdateUsageLimit(session.user.id)
    
    if (!canUse) {
      return new Response('Usage limit exceeded', { status: 403 })
    }
    
    // 继续处理请求...
    
  } catch (error) {
    console.error('Error checking usage limits:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
} 