import { useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../api/client';
import logoMark from '../assets/logo-mark.png';

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();

  async function handleSubmit(values: LoginFormValues) {
    setSubmitting(true);
    try {
      const result = await loginAdmin(values.email, values.password);
      localStorage.setItem('accessToken', result.accessToken);
      navigate('/dashboard');
    } catch {
      message.error('Identifiants incorrects');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <Form<LoginFormValues>
        layout="vertical"
        onFinish={handleSubmit}
        style={{ width: 320 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <img src={logoMark} alt="" style={{ width: 32, height: 32 }} />
          <h2 style={{ margin: 0 }}>CampusRide Admin</h2>
        </div>
        <Form.Item
          label="Email"
          name="email"
          rules={[{ required: true, type: 'email' }]}
        >
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item
          label="Mot de passe"
          name="password"
          rules={[{ required: true }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            Se connecter
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
