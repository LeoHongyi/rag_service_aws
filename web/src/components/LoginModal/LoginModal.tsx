import { LogIn, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props { onClose: () => void; }

/** Cognito replaces the reference application's server-managed WeChat SSO flow. */
export default function LoginModal({ onClose }: Props) {
  const navigate = useNavigate();
  const openLogin = () => { onClose(); navigate('/login'); };
  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-content max-w-sm relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-bg-hover hover:bg-brand-border"><X size={16} /></button>
        <img src="/ca/ca2.png" alt="AI 小夕" className="w-16 h-16 object-contain mx-auto mb-4" />
        <h2 className="text-xl font-bold text-text-primary">登录 AI 小夕</h2>
        <p className="text-sm text-text-secondary mt-2 mb-6">使用已创建的 Cognito 邮箱账号登录。</p>
        <button onClick={openLogin} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"><LogIn size={16} />邮箱登录</button>
      </div>
    </div>
  );
}
