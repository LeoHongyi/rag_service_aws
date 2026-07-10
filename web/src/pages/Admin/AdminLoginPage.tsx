import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pwdRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请填写账号和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.adminLogin(username.trim(), password) as any;
      if (res.error) {
        setError(res.error);
        return;
      }
      setToken(res.accessToken);
      setUser(res.user);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || '登录失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center px-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* 返回首页 */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand transition-colors mb-8"
        >
          <ArrowLeft size={15} />
          返回首页
        </Link>

        {/* 登录卡片 */}
        <div className="bg-white rounded-[20px] shadow-[0_8px_40px_rgba(22,93,255,0.08)] border border-brand-border p-8">
          {/* Logo + 标题 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-[#165DFF] to-[#044AE9] rounded-2xl flex items-center justify-center mb-4 shadow-[0_6px_20px_rgba(22,93,255,0.3)]">
              <ShieldCheck size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-text-primary">管理员登录</h1>
            <p className="text-sm text-text-secondary mt-1">AI 小夕 · 后台管理系统</p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 账号 */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                管理员账号
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && pwdRef.current?.focus()}
                placeholder="请输入账号"
                className="w-full px-3.5 py-2.5 text-sm border border-brand-border rounded-[10px] outline-none
                           focus:border-brand focus:shadow-[0_0_0_3px_rgba(22,93,255,0.1)]
                           bg-bg-page transition-all placeholder:text-text-secondary/50"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                登录密码
              </label>
              <div className="relative">
                <input
                  ref={pwdRef}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="请输入密码"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm border border-brand-border rounded-[10px] outline-none
                             focus:border-brand focus:shadow-[0_0_0_3px_rgba(22,93,255,0.1)]
                             bg-bg-page transition-all placeholder:text-text-secondary/50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-brand transition-colors"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-[10px] text-sm text-red-500">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#165DFF] to-[#044AE9]
                         text-white rounded-[10px] text-sm font-medium
                         hover:opacity-90 active:scale-[0.98] transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(22,93,255,0.3)]"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} />
              )}
              {loading ? '登录中...' : '登录后台'}
            </button>
          </form>

          {/* 提示信息 */}
          <p className="text-center text-[11px] text-text-secondary mt-6 leading-relaxed">
            账号密码在服务器 <code className="font-mono bg-bg-page px-1 py-0.5 rounded text-brand">.env</code> 中配置<br />
            <span className="opacity-60">ADMIN_USERNAME / ADMIN_PASSWORD</span>
          </p>
        </div>
      </div>
    </div>
  );
}
