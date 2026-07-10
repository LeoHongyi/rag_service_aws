import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const state = params.get('state');

    // 防 CSRF 检查
    const savedState = sessionStorage.getItem('sso_state');
    if (savedState && state !== savedState) {
      navigate('/?error=state_mismatch');
      return;
    }

    if (!token) {
      navigate('/?error=no_token');
      return;
    }

    authApi.verifySsoToken(token)
      .then((res: any) => {
        setToken(res.accessToken);
        setUser(res.user);
        navigate('/');
      })
      .catch(() => {
        navigate('/?error=verify_failed');
      });
  }, []);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">正在完成登录...</p>
      </div>
    </div>
  );
}
