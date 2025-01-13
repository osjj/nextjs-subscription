'use client';

import { useEffect, useState, useRef } from 'react';
import {createClient} from '@/utils/supabase/client';
import { message } from 'antd';
import { Session } from '@supabase/supabase-js';
import { useAuthModal } from '@/components/AuthModalProvider';

interface AnalysisResponse {
  message: string;
  error?: string;
}

// 添加新的接口
interface UploadedImage {
  path: string;
  url: string;
}

interface UsageData {
  prompt_count: number;
  max_prompts: number;
  subscription_tier: string;
}


const HeroSection = () => {
  const { openAuthModal } = useAuthModal();
  const supabase = createClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedFiles, setSelectedFiles] = useState<File[]>(() => []);
  const [promptCount, setPromptCount] = useState<number>(() => 0);
  const [maxPrompts, setMaxPrompts] = useState<number>(() => 10);
  const [isLoading, setIsLoading] = useState<boolean>(() => false);
  const [analysisResult, setAnalysisResult] = useState<string>(() => '');
  const [error, setError] = useState<string>(() => '');
  const [isMounted, setIsMounted] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState<string>(() => 'free');
  const resultContainerRef = useRef<HTMLDivElement>(null);
  const [userSession, setUserSession] = useState<Session | null>(null);

  // 获取使用量数据
  const fetchUsageData = async () => {
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log(session,22)
      setUserSession(session);
      // 只有在用户登录时才获取使用量
      if (session) {
       
        const response = await fetch('/api/usage');
        console.log(response,22)
        if (!response.ok) {
          throw new Error('获取使用量数据失败');
        }
        const data: UsageData = await response.json();
        setPromptCount(data.prompt_count);
        setMaxPrompts(data.max_prompts);
        setSubscriptionTier(data.subscription_tier);
      } else {
        // 未登录时重置使用量数据
        setPromptCount(0);
        setMaxPrompts(10);
        setSubscriptionTier('free');
      }
    } catch (error) {
      
      console.error('获取使用量数据失败:', error);
      messageApi.error('获取使用量数据失败');
      debugger
    }
  };

  // 更新使用量
  const updateUsage = async () => {
    try {
      const response = await fetch('/api/usage', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('更新使用量失败');
      }
      await fetchUsageData(); // 重新获取最新数据
    } catch (error) {
      console.error('更新使用量失败:', error);
      messageApi.error('更新使用量失败');
    }
  };

  useEffect(() => {
    setIsMounted(true);
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserSession(session);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchUsageData();
      }
    });

    // 初始加载时获取使用量数据
   fetchUsageData();

    // 清理订阅
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 添加自动滚动效果
  useEffect(() => {
    if (resultContainerRef.current) {
      resultContainerRef.current.scrollTop = resultContainerRef.current.scrollHeight;
    }
  }, [streamingContent]);

  if (!isMounted) {
    return <div className="w-full min-h-[calc(100vh-180px)] bg-[#0A0F1C]"></div>;
  }

  // 将文件转换为 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // 直接返回完整的 base64 字符串，包括前缀
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 处理流式响应
  const readStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码并处理数据
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              setStreamingContent(prev => prev + content);
            } catch (e) {
              console.error('解析响应数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('读取流失败:', error);
      throw error;
    }
  };

  // 上传图片到 Supabase Storage
  const uploadToSupabase = async (file: File): Promise<UploadedImage> => {
    try {
      
      // 检查用户是否已登录
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('请先登录后再上传图片');
      }
      
      // 生成唯一文件名
      const fileExt = file.name.split('.').pop();
      const originalName = file.name.split('.')[0];
      const fileName = `${Date.now()}_${originalName}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`; // 添加用户ID到路径

      // 上传文件
      const { error: uploadError, data } = await supabase.storage
        .from('uploadImg')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        if (uploadError.message.includes('security')) {
          throw new Error('没有权限上传文件，请确保已登录');
        }
        throw uploadError;
      }

      // 获取公共 URL
      const { data: { publicUrl } } = supabase.storage
        .from('uploadImg')
        .getPublicUrl(filePath);

      return {
        path: filePath,
        url: publicUrl
      };

    } catch (error) {
      console.error('上传文件失败:', error);
      throw error;
    }
  };

  // 修改文件处理函数
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          messageApi.error('请先登录后再上传图片');
          return;
        }

        const newFiles = Array.from(event.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
        
        // 上传所有新文件
        const uploadPromises = newFiles.map(file => uploadToSupabase(file));
        const uploadedFiles = await Promise.all(uploadPromises);

        setUploadedImages(prev => [...prev, ...uploadedFiles]);
        messageApi.success('图片上传成功');

      } catch (error) {
        console.error('处理文件失败:', error);
        messageApi.error(error instanceof Error ? error.message : '图片上传失败');
      }
    }
  };

  // 修改拖放处理函数
  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      try {
        const newFiles = Array.from(event.dataTransfer.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);

        // 上传所有新文件
        const uploadPromises = newFiles.map(file => uploadToSupabase(file));
        const uploadedFiles = await Promise.all(uploadPromises);

        setUploadedImages(prev => [...prev, ...uploadedFiles]);
        messageApi.success('图片上传成功');

      } catch (error) {
        console.error('处理文件失败:', error);
        messageApi.error('图片上传失败');
      }
    }
  };

  // 修改移除文件函数
  const handleRemoveFile = async (index: number) => {
    try {
      // 从 Supabase Storage 删除文件
      const imageToRemove = uploadedImages[index];
      if (imageToRemove) {
        const { error } = await supabase.storage
          .from('uploadImg')
          .remove([imageToRemove.path]);

        if (error) throw error;
      }

      // 更新状态
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
      
      messageApi.success('图片删除成功');

    } catch (error) {
      console.error('删除文件失败:', error);
      messageApi.error('图片删除失败');
    }   
  };

  // 修改分析处理函数
  const handleAnalysis = async () => {
    if (selectedFiles.length === 0) {
      setError('请先选择图片');
      return;
    }

    if (promptCount >= maxPrompts) {
      setError('您已达到本月提示次数上限');
      return;
    }

    setIsLoading(true);
    setError('');
    setStreamingContent('');

    try {
      // 添加图片大小和格式检查
      for (const file of selectedFiles) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`文件 ${file.name} 太大，请选择小于 10MB 的图片`);
        }
        if (!file.type.startsWith('image/')) {
          throw new Error(`文件 ${file.name} 不是有效的图片格式`);
        }
      }

      // 转换所有图片为 base64
      const base64Images = await Promise.all(
        selectedFiles.map(file => fileToBase64(file))
      );

      const requestBody = {
        prompt: "分析这些图片的设计和布局，并提供详细的前端实现建议",
        images: base64Images,
        options: {
          temperature: 0.7,
          maxTokens: 1024
        }
      };
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('分析请求失败');
      }

      if (!response.body) {
        throw new Error('没有响应数据');
      }

      const reader = response.body.getReader();
      await readStream(reader);
      
      // 分析成功后更新使用量
      await updateUsage();
      
      setSelectedFiles([]);
      
    } catch (err) {
      console.error('分析过程出错:', err);
      setError(err instanceof Error ? err.message : '分析过程中发生错误');
    } finally {
      setIsLoading(false);
    }
  };
  const handleClick = () => {
    console.log('Button clicked');
    if(userSession){
      console.log('用户已登录');
    }else{
      openAuthModal();
    }
  };
  return (
    <>
      {contextHolder}
      <section className="w-full min-h-[calc(100vh-180px)] bg-[#0A0F1C] px-6 py-12">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div className="text-white space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Create powerful prompts for Cursor, Bolt, v0 & more..
            </h1>
            <p className="text-gray-300 text-lg">
              Built for the next generation of AI coders. Upload images of full applications, 
              UI mockups, or custom designs and use our generated prompts to build your apps faster.
            </p>
            <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold hover:opacity-90 transition-all duration-300">
              View Demo
            </button>
            <div className="pt-8">
              <p className="text-gray-400 mb-4">Our front-end frameworks</p>
              <div className="flex space-x-6">
                {/* Framework Icons */}
                <div className="w-12 h-12 bg-[#1A1F2E] rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6.036c-2.667 0-4.333 1.325-5 3.976 1-1.325 2.167-1.822 3.5-1.491.761.189 1.305.738 1.91 1.345 0.982.98 2.124 2.115 4.59 2.115 2.667 0 4.333-1.325 5-3.976-1 1.325-2.166 1.822-3.5 1.491-.761-.189-1.305-.738-1.91-1.345-.981-.98-2.123-2.115-4.59-2.115zM7 12.036c-2.667 0-4.333 1.325-5 3.976 1-1.326 2.167-1.822 3.5-1.491.761.189 1.305.738 1.91 1.345.982.98 2.124 2.115 4.59 2.115 2.667 0 4.333-1.325 5-3.976-1 1.325-2.166 1.822-3.5 1.491-.761-.189-1.305-.738-1.91-1.345-.981-.98-2.123-2.115-4.59-2.115z"/>
                  </svg>
                </div>
                <div className="w-12 h-12 bg-[#1A1F2E] rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"/>
                  </svg>
                </div>
                <div className="w-12 h-12 bg-[#1A1F2E] rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.5-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="bg-[#1A1F2E] p-8 rounded-2xl">
            <div 
              className="border-2 border-dashed border-gray-600 rounded-xl p-8 mb-6 text-center"
              onDrop={handleDrop}
              onClick={handleClick}
              onDragOver={(e) => e.preventDefault()}
            >
              <p className="text-gray-300 mb-4">
                Drag & drop images of websites, Figma designs, or UI mockups here
              </p>
              <p className="text-gray-500 text-sm mb-4">or</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  multiple
                  disabled={!userSession}
                />
                <span className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Choose images
                </span>
              </label>
              <p className="text-gray-500 text-xs mt-4">
                You can upload multiple images at once
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-gray-300 mb-3">Selected Files:</h3>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-[#0A0F1C] p-2 rounded">
                      <span className="text-gray-300 truncate">{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Choose analysis focus:</label>
                <select className="w-full bg-[#0A0F1C] text-gray-300 px-4 py-2 rounded-lg border border-gray-600">
                  <option value="web">Web applications</option>
                  <option value="mobile">Mobile applications</option>
                  <option value="desktop">Desktop applications</option>
                </select>
              </div>

              <button 
                onClick={handleAnalysis}
                disabled={isLoading || selectedFiles.length === 0}
                className={`w-full py-3 bg-blue-500 text-white rounded-lg font-semibold 
                  ${isLoading || selectedFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'} 
                  transition-colors flex items-center justify-center space-x-2`}
              >
                <span>{isLoading ? 'Analyzing...' : 'Generate prompt'}</span>
                {!isLoading && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </button>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              {(streamingContent || isLoading) && (
                <div className="mt-4 p-4 bg-[#0A0F1C] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-300 font-semibold">Analysis Result:</h3>
                    {isLoading && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                      </div>
                    )}
                  </div>
                  <div 
                    ref={resultContainerRef}
                    className="max-h-[400px] overflow-y-auto custom-scrollbar"
                  >
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">{streamingContent}</p>
                  </div>
                </div>
              )}

              {/* 只在用户登录时显示使用量信息 */}
              {userSession && (
                <p className="text-center text-gray-500 text-sm">
                  提示次数: {promptCount} / {maxPrompts} ({subscriptionTier} 套餐)
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
     
    </>
  );
};

export default HeroSection; 