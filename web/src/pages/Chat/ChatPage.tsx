import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, LogOut, Settings, Menu, BookOpen, AlertTriangle, BookMarked, Key, Check, X } from 'lucide-react';
import ChatSidebar from '../../components/ChatSidebar/ChatSidebar';
import ChatMessages from '../../components/ChatMessages/ChatMessages';
import ChatInput from '../../components/ChatInput/ChatInput';
import ArticlePanel from '../../components/ArticlePanel/ArticlePanel';
import LoginModal from '../../components/LoginModal/LoginModal';
import PayModal from '../../components/PayModal/PayModal';
import StreamRecoveryBanner from '../../components/StreamRecoveryBanner/StreamRecoveryBanner';
import { useAuthStore } from '../../stores/auth.store';
import { useUiStore } from '../../stores/ui.store';
import { useChatStore } from '../../stores/chat.store';
import { convApi } from '../../services/api';
import http from '../../services/api';
import streamManager, { type StreamCheckpoint } from '../../services/streamManager';

export default function ChatPage() {
  const { isLoggedIn, user, logout, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const {
    showLoginModal, showPayModal, setShowPayModal,
    setShowLoginModal,
    mobileMenuOpen, setMobileMenuOpen,
  } = useUiStore();
  const { currentConvId, setMessages, messages, setPendingRecovery, isStreaming, streamingMsgId } = useChatStore();

  // 当前对话是否正在流式生成中（区分全局 isStreaming 和当前对话是否是流式当事人）
  const isCurrentConvStreaming =
    isStreaming &&
    !!streamingMsgId &&
    !!(messages[currentConvId ?? ''] ?? []).find((m) => m.id === streamingMsgId);

  // 流式恢复 Banner 状态
  const [recoveryCheckpoint, setRecoveryCheckpoint] = useState<StreamCheckpoint | null>(null);

  // 首次登录改密弹窗
  const location = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePwdForm, setChangePwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [changingPwd, setChangingPwd] = useState(false);
  const [changePwdError, setChangePwdError] = useState('');

  useEffect(() => {
    if ((location.state as any)?.mustChangePassword) {
      setShowChangePassword(true);
      // 清除 state 防止刷新后再次弹出
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // 初始化
  useEffect(() => {
    if (isLoggedIn) fetchProfile();
  }, [isLoggedIn]);

  // 切换对话时检测未完成的 checkpoint
  useEffect(() => {
    if (!currentConvId) {
      setRecoveryCheckpoint(null);
      return;
    }
    const cp = streamManager.getCheckpoint(currentConvId);
    setRecoveryCheckpoint(cp);
  }, [currentConvId]);

  // 加载消息（仅当该对话消息尚未初始化时才拉取，避免覆盖新建对话的乐观展示消息）
  useEffect(() => {
    if (currentConvId && isLoggedIn && messages[currentConvId] === undefined) {
      convApi.getMessages(currentConvId).then((msgs: any) => {
        setMessages(currentConvId, msgs);
        // 注意：此处不做「假阳性校验」。
        // streamManager.complete() 在正常完成时会同时清除 checkpoint 和 beforeunload监听器，
        // 所以页面上存在的 checkpoint 必定是真实的中断信号，不需要额外校验。
      }).catch(() => {});
    }
  }, [currentConvId, isLoggedIn]);

  // 流式生成完成时重新检测 checkpoint：
  // 防止 SPA 内导航场景下，流完成后 React state 中的旧 recoveryCheckpoint 残留导致 Banner 错误闪现
  useEffect(() => {
    if (!isCurrentConvStreaming && currentConvId) {
      const cp = streamManager.getCheckpoint(currentConvId);
      setRecoveryCheckpoint(cp);
    }
  }, [isCurrentConvStreaming, currentConvId]);

  // 监听登出事件
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  // 修改密码
  const handleChangePassword = async () => {
    setChangePwdError('');
    if (!changePwdForm.old_password || !changePwdForm.new_password || !changePwdForm.confirm_password) {
      setChangePwdError('请填写所有字段');
      return;
    }
    if (changePwdForm.new_password !== changePwdForm.confirm_password) {
      setChangePwdError('两次输入的密码不一致');
      return;
    }
    if (changePwdForm.new_password.length < 6) {
      setChangePwdError('密码长度不能少于6位');
      return;
    }

    setChangingPwd(true);
    try {
      const res = await http.post('/api/auth/local/change-password', {
        old_password: changePwdForm.old_password,
        new_password: changePwdForm.new_password,
      }) as any;

      if (res.error) {
        setChangePwdError(res.error);
        return;
      }

      alert('密码修改成功！');
      setShowChangePassword(false);
      setChangePwdForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setChangePwdError(err.message || '修改失败');
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* 顶部导航 */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-brand-border bg-white shrink-0 z-10">
        {/* 左侧：移动端菜单 + 品牌 Logo */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 text-text-secondary hover:text-brand transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/ca/ca2.png"
              alt="AI 小夕"
              className="w-7 h-7 object-contain"
              draggable={false}
            />
            <img
              src="https://aibook.mvtable.com/cc/RAG%E7%9F%A5%E8%AF%86%E5%BA%93/rag1.png"
              alt="RAG 知识库"
              className="w-7 h-7 object-contain"
              draggable={false}
            />
            <span className="font-semibold text-sm text-text-primary">AI 小夕</span>
            <span className="hidden sm:inline-flex text-[10px] font-semibold text-brand bg-brand-light border border-brand/30 rounded-full px-1.5 py-0.5 leading-none tracking-wide">RAG知识库</span>
            {/* 免责声明 tag */}
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-700 text-[10px] font-medium rounded-full leading-none">
              <AlertTriangle size={10} className="shrink-0" />
              仅供个人学习研究，商业用途请
              <a
                href="https://aibook.mvtable.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-amber-900 transition-colors"
              >购买源码</a>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* RAG 知识库 */}
          <button
            onClick={() => navigate('/knowledge')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-btn text-xs font-medium hover:bg-purple-100 transition-colors"
          >
            <BookOpen size={13} />
            知识库
          </button>

          {/* 学习文档 */}
          <a
            href="https://chat.mvtable.com/tech/doc"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-btn text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            <BookMarked size={13} />
            学习文档
          </a>

          {/* Token 余量 */}
          {isLoggedIn && user && (
            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-bg-page rounded-full text-xs text-text-secondary border border-brand-border">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {(user.tokens_remaining / 10000).toFixed(1)}w tokens
            </span>
          )}

          {/* 升级按钮 */}
          {isLoggedIn && (
            <button
              onClick={() => setShowPayModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-btn text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Crown size={12} />
              升级会员
            </button>
          )}

          {/* 用户头像/登录 */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {user?.is_admin === 1 && (
                <a
                  href="/admin"
                  className="p-1.5 text-text-secondary hover:text-brand transition-colors"
                  title="管理后台"
                >
                  <Settings size={16} />
                </a>
              )}
              <div className="relative group">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-7 h-7 rounded-full cursor-pointer" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand-light border border-brand-border flex items-center justify-center cursor-pointer text-xs text-brand font-medium">
                    {user?.nickname?.[0] || 'U'}
                  </div>
                )}
                {/* 下拉菜单 */}
                <div className="absolute right-0 top-9 w-40 bg-white rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-brand-border p-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="px-3 py-2 border-b border-brand-border mb-1">
                    <p className="text-xs font-medium text-text-primary line-clamp-1">{user?.nickname}</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {user?.plan_type ? `${user.plan_type} 会员` : '免费版'}
                    </p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-all"
                  >
                    <LogOut size={12} />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              登录
            </button>
          )}
        </div>
      </header>

      {/* 主体：三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：对话侧边栏（移动端隐藏，内置移动端抽屉逻辑） */}
        <div className="hidden md:flex">
          <ChatSidebar />
        </div>

        {/* 移动端底部抽屉 */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            {/* 黑色避层 */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* 抽屉内容：从左滑入 */}
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-slide-in-left">
              <ChatSidebar onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* 中间：聊天区域 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatMessages />
          {/* 流式恢复 Banner */}
          {isCurrentConvStreaming && (
            <div className="px-4 mb-2">
              <div className="max-w-3xl mx-auto rounded-[12px] border border-brand/20 bg-brand-light/40 px-4 py-2.5 flex items-center gap-2 text-xs text-brand animate-fade-in">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                AI 正在生成中，请稍候…
              </div>
            </div>
          )}
          {!isCurrentConvStreaming && recoveryCheckpoint && recoveryCheckpoint.convId === currentConvId && (
            <StreamRecoveryBanner
              checkpoint={recoveryCheckpoint}
              onRegenerate={() => {
                setPendingRecovery({
                  userQuery: recoveryCheckpoint.userQuery,
                  contentType: recoveryCheckpoint.contentType,
                });
                streamManager.clearCheckpoint();
                setRecoveryCheckpoint(null);
              }}
              onDismiss={() => {
                streamManager.clearCheckpoint();
                setRecoveryCheckpoint(null);
              }}
            />
          )}
          <ChatInput />
        </div>

        {/* 右侧：长文生成面板（条件显示） */}
        <div className="hidden lg:flex">
          <ArticlePanel />
        </div>
        {/* 移动端长文面板：全屏 Modal */}
        <div className="lg:hidden">
          <ArticlePanel isMobileFullscreen />
        </div>
      </div>

      {/* 弹窗 */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showPayModal && <PayModal />}

      {/* 首次登录强制改密弹窗 */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] shadow-modal w-full max-w-md p-5 animate-fade-in">
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
              <Key size={16} className="text-amber-500" />
              首次登录，请修改密码
            </h3>
            <p className="text-xs text-text-secondary mb-4">为保障账号安全，首次登录必须修改初始密码</p>
            
            {changePwdError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 mb-3">
                <AlertTriangle size={14} />
                <span>{changePwdError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">当前密码</label>
                <input
                  type="password"
                  value={changePwdForm.old_password}
                  onChange={(e) => setChangePwdForm({ ...changePwdForm, old_password: e.target.value })}
                  placeholder="请输入管理员提供的初始密码"
                  className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">新密码</label>
                <input
                  type="password"
                  value={changePwdForm.new_password}
                  onChange={(e) => setChangePwdForm({ ...changePwdForm, new_password: e.target.value })}
                  placeholder="至少6位"
                  className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">确认新密码</label>
                <input
                  type="password"
                  value={changePwdForm.confirm_password}
                  onChange={(e) => setChangePwdForm({ ...changePwdForm, confirm_password: e.target.value })}
                  placeholder="再次输入新密码"
                  className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setChangePwdForm({ old_password: '', new_password: '', confirm_password: '' });
                  setChangePwdError('');
                }}
                className="flex-1 py-2.5 text-sm border border-brand-border rounded-[10px] text-text-secondary hover:bg-bg-hover transition-colors font-medium"
                disabled={changingPwd}
              >
                稍后修改
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPwd}
                className="flex-1 py-2.5 text-sm bg-amber-500 text-white rounded-[10px] hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {changingPwd ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    修改中...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    确认修改
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
