'use client';

import { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { createClient } from '@/utils/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const supabase = createClient();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  // 发送验证码
  const handleSendCode = async () => {
    try {
      // 验证邮箱
      await form.validateFields(['email']);
      const email = form.getFieldValue('email');
      
      setSendingCode(true);
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // 如果用户不存在，自动创建
        },
      });

      if (error) {
        throw error;
      }

      messageApi.success('验证码已发送到您的邮箱');
      
      // 开始倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      console.error('发送验证码失败:', error);
      messageApi.error(error instanceof Error ? error.message : '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { error, data } = await supabase.auth.verifyOtp({
        email: values.email,
        token: values.code,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      // 获取用户信息
      const { data: { user } } = await supabase.auth.getUser();
      console.log('登录用户信息:', user);

      // 存储用户信息到 localStorage
      localStorage.setItem('user', JSON.stringify(user));

      messageApi.success(`欢迎回来，${user?.email?.split('@')[0]}`);
      onClose();
      form.resetFields();
      
    } catch (error) {
      console.error('验证失败:', error);
      messageApi.error(error instanceof Error ? error.message : '验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="登录/注册"
        open={isOpen}
        onCancel={onClose}
        footer={null}
        width={400}
        centered
        styles={{ backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.5)' }}
        className="auth-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入邮箱"
              size="large"
              className="bg-[#0A0F1C] border-gray-600 text-white placeholder-gray-400"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="code"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' }
            ]}
          >
            <div className="flex gap-2">
              <Input
                prefix={<SafetyCertificateOutlined />}
                placeholder="请输入验证码"
                size="large"
                className="bg-[#0A0F1C] border-gray-600 text-white placeholder-gray-400"
                disabled={loading}
              />
              <Button
                onClick={handleSendCode}
                disabled={countdown > 0 || loading || sendingCode}
                loading={sendingCode}
                className="min-w-[120px]"
              >
                {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
              </Button>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="w-full h-10 bg-blue-500 hover:bg-blue-600"
              loading={loading}
            >
              验证并登录
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AuthModal; 