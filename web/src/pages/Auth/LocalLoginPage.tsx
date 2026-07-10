import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import http from '../../services/api';

export default function LocalLoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await http.post('/api/auth/local/login', {
        username,
        password,
      }) as any;

      if (res.error) {
        setError(res.error);
        return;
      }

      // 登录成功，保存 token 和用户信息
      localStorage.setItem('access_token', res.accessToken);
      setToken(res.accessToken);
      setUser(res.user);

      // 检查是否需要修改密码
      if (res.mustChangePassword) {
        // 跳转到首页并携带改密标志
        navigate('/', { state: { mustChangePassword: true } });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#165DFF] to-[#044AE9] shadow-lg mb-4">
            <img src="/ca/ca2.png" alt="AI 小夕" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">AI 小夕</h1>
          <p className="text-text-secondary text-sm">账号密码登录</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-2xl shadow-lg border border-brand-border p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* 账号 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                登录账号
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入账号"
                className="w-full px-3 py-2.5 text-sm border border-brand-border rounded-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all bg-bg-page"
                autoComplete="username"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-brand-border rounded-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all bg-bg-page"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-brand transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#165DFF] to-[#044AE9] rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  登录
                </>
              )}
            </button>
          </form>

          {/* 分割线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-text-secondary">或</span>
            </div>
          </div>

          {/* SSO 登录入口 */}
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 text-sm font-medium text-brand border border-brand rounded-lg hover:bg-brand-light transition-all"
          >
            使用微信扫码登录
          </button>
        </div>

        {/* 底部提示 */}
        <p className="text-center text-xs text-text-secondary mt-6">
          忘记密码？请联系管理员重置
        </p>
      </div>
    </div>
  );
}
