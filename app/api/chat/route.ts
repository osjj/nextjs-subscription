import { NextRequest } from 'next/server';

// 调试函数
const debug = (data: any, label: string = '') => {
  console.log('\n====================');
  console.log(`🔍 DEBUG ${label}:`, data);
  console.log('====================\n');
};

// API 配置
const API_CONFIG = {
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  apiKey: 'ff7ce380-ce30-47c1-a863-cae39f2cfecc'
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, images, options } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: '请提供至少一张图片' }), 
        { status: 400 }
      );
    }

    // 准备图片消息
    const imageMessages = images.map(base64Image => ({
      type: 'image_url',
      image_url: base64Image,
    }));

    // 创建请求体
    const requestBody = {
      model: 'ep-20241225133507-l76bb',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant specialized in analyzing images and providing detailed frontend implementation suggestions.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || '分析这些图片的设计和布局，并提供详细的前端实现建议' },
            ...imageMessages,
          ],
        }
      ],
      stream: true  // 启用流式响应
    };

    // 发送请求
    const response = await fetch(API_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    // 返回流式响应
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: '调用 AI 服务时出错: ' + (error instanceof Error ? error.message : '未知错误') 
      }),
      { status: 500 }
    );
  }
}

// 处理其他 HTTP 方法
export async function GET() {
    // return NextResponse.json(
    //     { error: '不支持的请求方法' },
    //     { status: 405 }
    // );
} 