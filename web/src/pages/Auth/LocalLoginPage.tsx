import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../services/api';

function getAuthErrorMessage(error: any) {
  switch (error?.name) {
    case 'NotAuthorizedException': return '邮箱或密码错误。请使用注册时填写的邮箱登录。';
    case 'UserNotConfirmedException': return '邮箱尚未验证，请完成邮箱验证码确认。';
    case 'PasswordResetRequiredException': return '该账号需要重置密码后才能登录。';
    case 'UserAlreadyAuthenticatedException': return '当前已有登录会话，请刷新页面后重试。';
    default: return error?.message || '操作失败，请稍后重试。';
  }
}

export default function LocalLoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'confirm'>('login');
  const [code, setCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || (mode !== 'confirm' && !password) || (mode === 'confirm' && !code)) {
      setError(mode === 'confirm' ? '请输入邮箱和验证码' : '请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'register') {
        await authApi.register(username, password);
        setMode('confirm');
        setNotice('验证码已发送到邮箱，请填写后完成注册。');
        return;
      }
      if (mode === 'confirm') {
        await authApi.confirmRegistration(username, code);
        setMode('login');
        setNotice('邮箱已验证，请使用新账号登录。');
        return;
      }
      const res = await authApi.localLogin(username, password) as any;

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
      setError(getAuthErrorMessage(err));
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
            <img src="/ca/ca2.png" alt="知问" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">知问</h1>
          <p className="text-text-secondary text-sm">{mode === 'login' ? '使用注册邮箱登录' : mode === 'register' ? '注册新账号' : '验证邮箱'}</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-2xl shadow-lg border border-brand-border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            {notice && <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">{notice}</div>}

            {/* 账号 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                邮箱
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm border border-brand-border rounded-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all bg-bg-page"
              />
            </div>

            {/* 密码 */}
            {mode !== 'confirm' && <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位，含大小写字母、数字和符号"
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
            </div>}

            {mode === 'confirm' && <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">邮箱验证码</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入验证码" className="w-full px-3 py-2.5 text-sm border border-brand-border rounded-lg outline-none focus:border-brand bg-bg-page" autoComplete="one-time-code" />
            </div>}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#165DFF] to-[#044AE9] rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  {mode === 'login' ? '登录' : mode === 'register' ? '注册并发送验证码' : '确认注册'}
                </>
              )}
            </button>
          </form>

          {/* 登录模式切换 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-text-secondary">或</span>
            </div>
          </div>

          {/* 注册入口 */}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice(''); }}
            className="w-full py-2.5 text-sm font-medium text-brand border border-brand rounded-lg hover:bg-brand-light transition-all"
          >
            {mode === 'login' ? '注册新账号' : '返回登录'}
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
