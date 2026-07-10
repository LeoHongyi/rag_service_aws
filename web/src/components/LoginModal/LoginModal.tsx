import { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw, Smartphone } from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { API_BASE } from '../../constants';

interface Props {
  onClose: () => void;
}

const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function LoginModal({ onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'expired' | 'done'>('loading');
  const pollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { setToken, setUser, fetchProfile } = useAuthStore();

  const initQr = useCallback(async () => {
    setStatus('loading');
    setQrDataUrl('');
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await authApi.getSsoQr(redirectUri) as any;
      setQrDataUrl(res.qrDataUrl);
      setState(res.state);
      setStatus('ready');
    } catch {
      setStatus('expired');
    }
  }, []);

  // 轮询扫码状态
  useEffect(() => {
    if (status !== 'ready' || !state) return;

    pollTimer.current = setInterval(async () => {
      try {
        const res = await authApi.pollSso(state) as any;
        if (res.expired) {
          clearInterval(pollTimer.current);
          setStatus('expired');
          return;
        }
        if (res.done && res.token) {
          clearInterval(pollTimer.current);
          setStatus('done');
          // 验证 token，获取本地 JWT
          try {
            const verifyRes = await authApi.verifySsoToken(res.token) as any;
            setToken(verifyRes.accessToken);
            setUser(verifyRes.user);
            onClose();
          } catch {
            setStatus('expired');
          }
        }
      } catch {
        // 忽略网络错误
      }
    }, 2000);

    return () => clearInterval(pollTimer.current);
  }, [status, state, setToken, setUser, onClose]);

  useEffect(() => {
    if (isMobile()) {
      // 移动端直接跳转授权
      const redirectUri = `${window.location.origin}/auth/callback`;
      window.location.href = `${API_BASE}/api/auth/sso/mobile?redirect_uri=${encodeURIComponent(redirectUri)}`;
    } else {
      initQr();
    }
  }, [initQr]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-bg-hover hover:bg-brand-border transition-colors"
        >
          <X size={16} className="text-text-secondary" />
        </button>

        <div className="text-center">
          {/* Logo */}
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-4 border border-brand-border shadow-sm">
            <img src="/ca/ca2.png" alt="AI 小夕" className="w-full h-full object-contain" draggable={false} />
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-1">微信扫码登录</h2>
          <p className="text-sm text-text-secondary mb-6">扫码后自动完成登录，安全便捷</p>

          {/* 二维码区域 */}
          <div className="relative w-[200px] h-[200px] mx-auto mb-4 rounded-[12px] overflow-hidden border border-brand-border">
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-page">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {(status === 'ready' || status === 'scanning') && qrDataUrl && (
              <img src={qrDataUrl} alt="微信登录二维码" className="w-full h-full object-cover" />
            )}
            {status === 'expired' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm gap-2">
                <p className="text-sm text-text-secondary">二维码已过期</p>
                <button
                  onClick={initQr}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-btn text-sm hover:bg-brand-dark transition-colors"
                >
                  <RefreshCw size={14} />
                  刷新
                </button>
              </div>
            )}
          </div>

          {/* 状态文字 */}
          <p className="text-sm text-text-secondary mb-4">
            {status === 'loading' && '加载中...'}
            {status === 'ready' && '请用微信扫描二维码'}
            {status === 'scanning' && '扫码成功，请在手机上确认'}
            {status === 'expired' && '二维码已过期，请刷新'}
            {status === 'done' && '登录成功！'}
          </p>

          {/* 移动端提示 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-page rounded-[8px] text-xs text-text-secondary">
            <Smartphone size={14} />
            <span>移动端访问时将自动跳转微信授权</span>
          </div>
        </div>
      </div>
    </div>
  );
}
