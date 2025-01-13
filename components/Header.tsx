'use client';

import { useState, useEffect } from 'react';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import AuthModal from '@/components/AuthModal';
import { createClient } from '@/utils/supabase/client';
import { useAuthModal } from '@/components/AuthModalProvider';

const Header = () => {
  const { openAuthModal } = useAuthModal();
  const [user, setUser] = useState<any>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const supabase = createClient();
  useEffect(() => {
    // 初始化时检查用户状态
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('登出失败:', error);
      messageApi.error('退出登录失败，请重试');
    } else {
      messageApi.success('已退出登录');
    }
  };

  const dropdownItems: MenuProps['items'] = [
    {
      key: 'logout',
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <>
      {contextHolder}
      <header className="w-full px-6 py-4 sticky top-0 z-50 bg-black/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-white">
              CopyCoder
            </Link>
            <nav className="hidden md:flex space-x-6">
              <Link 
                href="/" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Products
              </Link>
              <Link 
                href="/pricing" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Pricing
              </Link>
            </nav>
          </div>
          
          {user ? (
            <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
              <button className="px-4 py-2 bg-[#1A1F2E] rounded-lg text-gray-300 hover:bg-[#2A2F3E] transition-all duration-300">
                {user.email}
              </button>
            </Dropdown>
          ) : (
            <button 
              onClick={openAuthModal}
              className="px-4 py-2 bg-[#1A1F2E] rounded-lg text-gray-300 hover:bg-[#2A2F3E] transition-all duration-300"
            >
              登录
            </button>
          )}
        </div>

        {/* <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        /> */}
      </header>
    </>
  );
};

export default Header; 