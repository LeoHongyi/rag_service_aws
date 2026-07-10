import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Send, Square, Paperclip, X, Check,
  MessageCircle, Image, Globe, Briefcase, ChevronDown,
  Zap, Brain, GraduationCap, HardDrive, FileText, Loader2, Layers, BookOpen, Lock, Plus,
} from 'lucide-react';
import { useChatStore } from '../../stores/chat.store';
import { useAuthStore } from '../../stores/auth.store';
import { useUiStore } from '../../stores/ui.store';
import { streamChat, fileApi, convApi, imageApi, streamMultimodal, knowledgeApi } from '../../services/api';
import streamManager from '../../services/streamManager';
import { CHAT_MODES, type ChatMode } from '../../constants';

function uuidv4() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// ── 云盘文件选择面板 ────────────────────────────────────────────
function CloudFilePicker({
  onSelect,
  onClose,
}: {
  onSelect: (file: { id: number; filename: string; parsedContent?: string }) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fileApi.list().then((res: any) => {
      setFiles(Array.isArray(res) ? res : []);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSelect = async (file: any) => {
    setSelecting(file.id);
    try {
      const token = localStorage.getItem('access_token');
      const detail = await fetch(`/api/files/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      onSelect({ id: file.id, filename: file.filename, parsedContent: detail.parsed_content });
      onClose();
    } catch {
      setSelecting(null);
    }
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1.5 w-72 bg-white border border-brand-border rounded-[12px] shadow-modal z-50 overflow-hidden animate-fade-in"
    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-brand-border">
        <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
          <HardDrive size={12} className="text-brand" />
          选择云盘文件
        </span>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
          <X size={13} />
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            加载中...
          </div>
        ) : files.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-secondary">云盘暂无文件</div>
        ) : (
          files.map((f) => (
            <button
              key={f.id}
              onClick={() => handleSelect(f)}
              disabled={selecting !== null}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-light transition-colors text-left disabled:opacity-60"
            >
              {selecting === f.id ? (
                <Loader2 size={14} className="animate-spin text-brand shrink-0" />
              ) : (
                <FileText size={14} className="text-text-secondary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-primary truncate">{f.filename}</div>
                <div className="text-[10px] text-text-secondary mt-0.5">
                  {f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : ''}
                  {f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString('zh-CN')}` : ''}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── 知识库选择面板 ───────────────────────────────────────────────
function KbPicker({
  selected,
  onChange,
  onClose,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [bases, setBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    knowledgeApi.listBases().then((res: any) => {
      setBases(Array.isArray(res) ? res : []);
    }).catch(() => setBases([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1.5 w-72 bg-white border border-brand-border rounded-[12px] shadow-modal z-50 overflow-hidden animate-fade-in"
    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-brand-border">
        <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
          <BookOpen size={12} className="text-brand" />
          选择知识库
        </span>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
          <X size={13} />
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            加载中...
          </div>
        ) : bases.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-secondary">
            <p>暂无知识库</p>
            <a href="/knowledge" className="text-brand hover:underline mt-1 block">
              去创建知识库 →
            </a>
          </div>
        ) : (
          bases.map((kb) => {
            const isSelected = selected.includes(kb.id);
            return (
              <button
                key={kb.id}
                onClick={() => toggle(kb.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-light transition-colors text-left ${
                  isSelected ? 'bg-brand-light' : ''
                }`}
              >
                <span className="shrink-0">
                  {kb.is_public
                    ? <Globe size={13} className="text-blue-400" />
                    : <Lock size={13} className="text-gray-400" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary truncate">{kb.name}</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">
                    {kb.doc_count} 文档 · {kb.chunk_count} 块
                  </div>
                </div>
                {isSelected && <Check size={13} className="text-brand shrink-0" />}
              </button>
            );
          })
        )}
      </div>
      {selected.length > 0 && (
        <div className="px-3 py-2 border-t text-xs text-brand bg-brand-light">
          已选 {selected.length} 个知识库，发消息时将自动检索相关内容
        </div>
      )}
      <div className="px-3 py-2 border-t border-brand-border">
        <a
          href="/knowledge"
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-brand transition-colors"
        >
          <Plus size={12} />
          新建知识库
        </a>
      </div>
    </div>
  );
}

// 模式选择下拉组件
const MODE_COLORS: Record<ChatMode, string> = {
  fast:   'text-orange-500',
  think:  'text-purple-500',
  expert: 'text-blue-600',
};
const MODE_BG: Record<ChatMode, string> = {
  fast:   'bg-orange-50 border-orange-200',
  think:  'bg-purple-50 border-purple-200',
  expert: 'bg-blue-50 border-blue-200',
};
// 模式 SVG 图标映射
type LucideIcon = React.ComponentType<{ size?: number; className?: string }>;
const MODE_ICONS: Record<ChatMode, LucideIcon> = {
  fast:   Zap,
  think:  Brain,
  expert: GraduationCap,
};

function ModeDropdown({
  mode, onChange,
}: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = CHAT_MODES.find((m) => m.key === mode)!;
  const CurrentIcon = MODE_ICONS[mode];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          open ? MODE_BG[mode] : 'border-transparent hover:bg-bg-hover'
        } ${MODE_COLORS[mode]}`}
        title="切换对话模式"
      >
        <CurrentIcon size={13} />
        <span>{current.label}</span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 上弹面板 */}
      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 w-52 bg-white border border-brand-border rounded-[12px] shadow-modal z-50 overflow-hidden animate-fade-in">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-text-secondary tracking-wider">对话模式</div>
          {CHAT_MODES.map((m) => {
            const isActive = m.key === mode;
            const ItemIcon = MODE_ICONS[m.key as ChatMode];
            return (
              <button
                key={m.key}
                onClick={() => { onChange(m.key as ChatMode); setOpen(false); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-xs text-left transition-colors ${
                  isActive ? MODE_BG[m.key as ChatMode] : 'hover:bg-bg-hover'
                }`}
              >
                <ItemIcon
                  size={14}
                  className={`shrink-0 mt-0.5 ${
                    isActive ? MODE_COLORS[m.key as ChatMode] : 'text-text-secondary'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${
                    isActive ? MODE_COLORS[m.key as ChatMode] : 'text-text-primary'
                  }`}>{m.label}模式</div>
                  <div className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{m.desc}</div>
                </div>
                {isActive && <Check size={12} className={MODE_COLORS[m.key as ChatMode]} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ContentType = 'text' | 'image' | 'webdesign' | 'career' | 'multimodal';

const CONTENT_TYPES: { key: ContentType; label: string; icon: React.ReactNode; placeholder: string; badge?: string }[] = [
  { key: 'text',       label: 'AI 对话',   icon: <MessageCircle size={13} />, placeholder: '发送消息，Enter 发送，Shift+Enter 换行...' },
  { key: 'image',      label: '图片生成',  icon: <Image size={13} />,         placeholder: '描述你想生成的图片，如：一只橙色的猫坐在月球上...' },
  { key: 'multimodal', label: '多模态AI', icon: <Layers size={13} />,       placeholder: '描述想生成的图文内容，如：分析AI发展趋势并生成图文报告...', badge: '新' },
  { key: 'webdesign',  label: '网页设计',  icon: <Globe size={13} />,         placeholder: '描述你想要的网页，如：设计一个 Notion 风格的笔记应用主页...', badge: '新' },
  { key: 'career',     label: '求职助手',  icon: <Briefcase size={13} />,   placeholder: '说说你的求职目标，或需要哪方面的帮助...', badge: '新' },
];

// 移动端内容类型下拉组件
function ContentTypeDropdown({ value, onChange }: { value: ContentType; onChange: (t: ContentType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = CONTENT_TYPES.find((t) => t.key === value)!;

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          value !== 'text'
            ? 'bg-gradient-to-r from-[#165DFF] to-[#044AE9] text-white shadow-sm'
            : 'text-text-secondary hover:text-brand hover:bg-brand-light border border-brand-border'
        }`}
        title="切换生成类型"
      >
        {current.icon}
        <span>{current.label}</span>
        <ChevronDown size={11} className={`transition-transform duration-150 ${ open ? 'rotate-180' : '' }`} />
      </button>

      {/* 上弹面板 */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 w-44 bg-white border border-brand-border rounded-[12px] shadow-modal z-50 overflow-hidden animate-fade-in">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-text-secondary tracking-wider">生成类型</div>
          {CONTENT_TYPES.map((ct) => {
            const isActive = ct.key === value;
            return (
              <button
                key={ct.key}
                onClick={() => { onChange(ct.key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  isActive ? 'bg-brand-light' : 'hover:bg-bg-hover'
                }`}
              >
                <span className={isActive ? 'text-brand' : 'text-text-secondary'}>{ct.icon}</span>
                <span className={`flex-1 ${ isActive ? 'text-brand font-medium' : 'text-text-primary' }`}>
                  {ct.label}
                </span>
                {ct.badge && !isActive && (
                  <span className="text-[9px] bg-orange-400 text-white rounded-full px-1 leading-tight">新</span>
                )}
                {isActive && <Check size={12} className="text-brand shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChatInput() {
  const [text, setText] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [attachment, setAttachment] = useState<{ id: number; filename: string; parsedContent?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);
  const [kbPickerOpen, setKbPickerOpen] = useState(false);
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stopFnRef = useRef<(() => void) | null>(null);
  /** 始终指向最新的 handleSend，解决 pendingRecovery useEffect 中闭包过期问题 */
  const handleSendRef = useRef<() => void>(() => {});

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const {
    currentConvId, currentModelId, currentUserModel,
    isStreaming, setStreaming,
    appendMessage, appendChunk, appendReasoning, finalizeMessage, replaceImagePlaceholder, cleanImagePlaceholders,
    addConversation, setCurrentConv, setMessages,
    draftText, setDraftText,
    currentMode, setCurrentMode,
    stopStreaming, setStopStreaming,
    pendingRecovery, setPendingRecovery,
    setMessageSources,
  } = useChatStore();
  const { isLoggedIn } = useAuthStore();
  const { setShowLoginModal, setShowPayModal, setWebPreview, setInputContentType, setMultimodalPhase } = useUiStore();

  // 监听 draftText （快捷建议词填充）
  useEffect(() => {
    if (draftText) {
      setText(draftText);
      setDraftText('');
      textareaRef.current?.focus();
    }
  }, [draftText]);

  // 监听 pendingRecovery（流式恢复：用户点击 Banner「重新生成」后自动触发）
  useEffect(() => {
    if (!pendingRecovery || isStreaming) return;
    const { userQuery, contentType: recoveryContentType } = pendingRecovery;
    setPendingRecovery(null);
    setText(userQuery);
    setContentType(recoveryContentType as ContentType);
    // 下一个 tick 触发发送（等 state 更新完毕）
    setTimeout(() => {
      handleSendRef.current();
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecovery]);

  // 自动调整高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [text]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await fileApi.upload(file) as any;
      const detail = await fetch(`/api/files/${res.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      }).then((r) => r.json());
      setAttachment({ id: res.id, filename: res.filename, parsedContent: detail.parsed_content });
    } catch {
      alert('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 切换内容类型：同步 ui.store，并对特殊功能注入欢迎消息
  const handleContentTypeChange = useCallback((type: ContentType) => {
    setContentType(type);
    setInputContentType(type);

    if ((type === 'webdesign' || type === 'career' || type === 'multimodal') && currentConvId) {
      const welcomeMsg = type === 'webdesign'
        ? `👋 您好！我是**网页设计助手**。请描述您想要的网页效果，例如：\n\n- 「设计一个 Notion 风格的笔记应用主页」\n- 「做一个极简的 SaaS 产品落地页，参考 Stripe 风格」\n- 「创建一个深色主题的 AI 工具介绍页」\n\n我会根据您的需求，自动匹配最合适的设计风格，生成**完整可预览的网页**，在右侧面板中实时展示 ✨`
        : type === 'career'
        ? `👋 您好！我是**求职助手小夕**，您的专属职业发展顾问。我可以帮您：\n\n- <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg> **简历优化** — 量身定制、突出亮点\n- <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> **面试辅导** — 模拟面试、技巧提升\n- <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg> **职业规划** — 方向分析、路径设计\n- <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> **求职信撰写** — 专业打动 HR\n\n请告诉我您的求职目标或遇到的问题，我来为您提供专业建议！`
        : `👋 我是**多模态AI助手**，可以一键生成**图文图表并茂**的富媒体内容 🎨\n\n我会协调 3 个智能 Agent 协作完成您的需求：\n\n- 🧠 **意图分析 Agent** — 深度理解您的需求，规划内容结构\n- 🖼️ **图片生成 Agent** — 自动生成高质量配图\n- 📊 **图表生成 Agent** — 生成专业 Mermaid 流程图/架构图\n\n**示例提问：**\n- 「分析 AI 发展趋势，生成图文报告」\n- 「介绍微服务架构，配上架构图和流程图」\n- 「制作一份产品发布周报，包含数据图表」\n\n请描述您想生成的内容，我来为您打造专属的富媒体报告 ✨`;

      appendMessage(currentConvId, {
        id: uuidv4(),
        conversation_id: currentConvId,
        role: 'assistant',
        content: welcomeMsg,
        content_type: 'text',
        created_at: new Date().toISOString(),
      });
    }
  }, [currentConvId, setInputContentType, appendMessage]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || isStreaming) return;
    if (!isLoggedIn) { setShowLoginModal(true); return; }

    // webdesign / career 模式顺序发送，不需限制
    // （后端会自动注入系统提示词）

    const userText = text.trim();
    setText('');
    setAttachment(null);

    let convId = currentConvId;
    if (!convId) {
      const conv = await convApi.create({ model_id: currentModelId, mode: currentMode }) as any;
      addConversation(conv);
      setCurrentConv(conv.id);
      setMessages(conv.id, []);
      convId = conv.id;
    }

    const safeConvId = convId as string;
    const userMsgId = uuidv4();
    const aiMsgId = uuidv4();

    appendMessage(safeConvId, {
      id: userMsgId,
      conversation_id: safeConvId,
      role: 'user',
      content: userText,
      content_type: 'text',
      created_at: new Date().toISOString(),
    });

    // ── 图片生成模式 ────────────────────────────────────
    if (contentType === 'image') {
      appendMessage(safeConvId, {
        id: aiMsgId,
        conversation_id: safeConvId,
        role: 'assistant',
        content: '',
        content_type: 'image',
        created_at: new Date().toISOString(),
        streaming: true,
      });
      setStreaming(true, aiMsgId);

      try {
        const res = await imageApi.generate(userText) as any;
        if (res.error) {
          // 次数限制：展示付费弹窗
          if (res.error_code === 'IMAGE_LIMIT_EXCEEDED') {
            appendChunk(safeConvId, aiMsgId, `🚫 ${res.error}`);
            if (res.need_upgrade) setShowPayModal(true);
          } else {
            throw new Error(res.error);
          }
        } else {
          appendChunk(safeConvId, aiMsgId, res.imageUrl);
        }
      } catch (err: any) {
        appendChunk(safeConvId, aiMsgId, `⚠️ 图片生成失败: ${err.message}`);
      } finally {
        finalizeMessage(safeConvId, aiMsgId);
        setStreaming(false);
        stopFnRef.current = null;
        setStopStreaming(null);
      }
      return;
    }

    // ── 多模态AI 模式 ────────────────────────────────────
    if (contentType === 'multimodal') {
      appendMessage(safeConvId, {
        id: aiMsgId,
        conversation_id: safeConvId,
        role: 'assistant',
        content: '',
        content_type: 'multimodal',
        created_at: new Date().toISOString(),
        streaming: true,
      });
      setStreaming(true, aiMsgId);
      setMultimodalPhase('analyzing');
      // ── 记录 checkpoint（多模态模式） ──
      streamManager.start({ convId: safeConvId, msgId: aiMsgId, userQuery: userText, contentType, mode: currentMode });

      const stopFn = streamMultimodal(
        {
          conversation_id: safeConvId,
          message: userText,
          model_id: currentModelId || undefined,
          attachment_content: attachment?.parsedContent,
        },
        {
          onPlan: (plan) => {
            setMultimodalPhase('generating', plan.summary);
            // 意图分析完成，展示结构化计划提示
            const hints: string[] = [];
            if (plan.chartCount > 0) hints.push(`${plan.chartCount} 个图表`);
            if (plan.imageCount > 0) hints.push(`${plan.imageCount} 张配图`);
            else if (!plan.canGenerateImages) hints.push('暂无图片配额');
            const hintText = hints.length > 0
              ? `> 🧠 意图分析完成：${plan.summary}，将生成${hints.join('、')}。正在创作内容...

`
              : `> 🧠 ${plan.summary}，正在创作内容...

`;
            appendChunk(safeConvId, aiMsgId, hintText);
          },
          onChunk: (chunk) => {
            appendChunk(safeConvId, aiMsgId, chunk);
            streamManager.appendChunk(chunk);
          },
          onImageStart: (_index, _prompt) => {
            // 进入图片生成阶段，通过 banner 展示进度，不再向内容追加 loading 文字
            setMultimodalPhase('imaging');
          },
          onImage: (index, url) => {
            replaceImagePlaceholder(safeConvId, aiMsgId, index, url);
          },
          onDone: () => {
            // 首先清理任何残留的 [IMAGE_N] 占位符（如 Agent2 写入了并非 Agent1 规划的占位符却未得到 image 事件）
            cleanImagePlaceholders(safeConvId, aiMsgId);
            setMultimodalPhase('idle');
            finalizeMessage(safeConvId, aiMsgId);
            setStreaming(false);
            stopFnRef.current = null;
            setStopStreaming(null);
            streamManager.complete();
          },
          onError: (err) => {
            setMultimodalPhase('idle');
            appendChunk(safeConvId, aiMsgId, `

⚠️ 生成失败: ${err}`);
            finalizeMessage(safeConvId, aiMsgId);
            setStreaming(false);
            stopFnRef.current = null;
            setStopStreaming(null);
            streamManager.complete();
          },
        },
      );
      stopFnRef.current = stopFn;
      setStopStreaming(stopFn);
      return;
    }

    // ── 文字对话模式 ────────────────────

    appendMessage(safeConvId, {
      id: aiMsgId,
      conversation_id: safeConvId,
      role: 'assistant',
      content: '',
      content_type: 'text',
      created_at: new Date().toISOString(),
      streaming: true,
    });

    setStreaming(true, aiMsgId);
    // ── 记录 checkpoint（文字对话模式） ──
    streamManager.start({ convId: safeConvId, msgId: aiMsgId, userQuery: userText, contentType, mode: currentMode });

    const stop = streamChat(
      {
        conversation_id: safeConvId,
        model_id: currentUserModel ? undefined : (currentModelId || undefined),
        mode: currentMode,
        message: userText,
        content_type: contentType,
        attachment_content: attachment?.parsedContent,
        // 用户自定义模型凭据
        user_model_id: currentUserModel?.model_id,
        user_base_url: currentUserModel?.base_url,
        user_api_key: currentUserModel?.api_key,
        // RAG 知识库
        kb_ids: selectedKbIds.length > 0 ? selectedKbIds : undefined,
      },
      {
        onChunk: (chunk) => {
          appendChunk(safeConvId, aiMsgId, chunk);
          streamManager.appendChunk(chunk);
        },
        onReasoning: (chunk) => {
          appendReasoning(safeConvId, aiMsgId, chunk);
          streamManager.appendChunk(chunk, 'reasoning');
        },
        onSources: (sources) => {
          setMessageSources(safeConvId, aiMsgId, sources);
        },
        onDone: (data: any) => {
          finalizeMessage(safeConvId, aiMsgId);
          setStreaming(false);
          stopFnRef.current = null;
          setStopStreaming(null);
          streamManager.complete();

          // 情绪识别：如果服务端识别到用户需要人工服务，插入人工支持卡片
          if (data?.needsHuman) {
            const supportId = `support-${Date.now()}`;
            appendMessage(safeConvId, {
              id: supportId,
              conversation_id: safeConvId,
              role: 'assistant',
              content: '',
              content_type: 'human_support',
              created_at: new Date().toISOString(),
              streaming: false,
            });
          }

          // 网页设计模式：直接用 SSE done 事件携带的 fullText，避免读 store 的时序问题
          if (contentType === 'webdesign') {
            const fullText: string = data?.fullText || '';
            const raw = fullText.trim();
            if (raw) {
              const codeMatch = raw.match(/```(?:html)?[\s\S]*?\n([\s\S]*?)\n?```/i);
              const htmlContent = codeMatch ? codeMatch[1].trim() : raw;
              if (htmlContent.includes('<!DOCTYPE') || htmlContent.toLowerCase().includes('<html')) {
                setWebPreview(htmlContent);
              }
            }
          }
        },
        onError: (err) => {
          appendChunk(safeConvId, aiMsgId, `\n\n⚠️ 错误: ${err}`);
          finalizeMessage(safeConvId, aiMsgId);
          setStreaming(false);
          setStopStreaming(null);
          streamManager.complete();
        },
      },
    );
    stopFnRef.current = stop;
  }, [text, contentType, isStreaming, isLoggedIn, currentConvId, currentModelId, currentUserModel, attachment, selectedKbIds, replaceImagePlaceholder, setWebPreview, setStopStreaming]);

  // 将最新的 handleSend 同步到 ref，供 pendingRecovery 的 setTimeout 使用
  handleSendRef.current = handleSend;

  const handleStop = () => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    stopStreaming?.();
    setStopStreaming(null);
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // e.nativeEvent.isComposing 为 true 表示输入法正在组合中（中文未确定），此时回车不发送
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentTypeMeta = CONTENT_TYPES.find((t) => t.key === contentType)!;

  return (
    <div className="border-t border-brand-border bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto">

        {/* 功能提示 Toast */}
        {toast && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-brand-light border border-brand/20 rounded-[10px] text-xs text-brand animate-fade-in">
            <span className="flex-1 leading-relaxed">{toast}</span>
            <a
              href="https://aibook.mvtable.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium whitespace-nowrap hover:underline shrink-0"
            >
              前往查看 →
            </a>
            <button
              onClick={() => setToast(null)}
              className="text-text-secondary hover:text-text-primary transition-colors shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* 附件预览条 */}
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-brand-light rounded-[8px] border border-brand-border">
            <Paperclip size={12} className="text-brand shrink-0" />
            <span className="text-xs text-brand font-medium flex-1 truncate">{attachment.filename}</span>
            <button onClick={() => setAttachment(null)} className="text-text-secondary hover:text-text-primary transition-colors">
              <X size={13} />
            </button>
          </div>
        )}

        {/* 输入卡片：移除 overflow-hidden，避免裁切下拉面板 */}
        <div className="rounded-[16px] border border-brand-border bg-bg-page focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(22,93,255,0.1)] transition-all">

          {/* 文本输入行 */}
          <div className="flex items-end gap-2 px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentTypeMeta.placeholder}
              rows={3}
              className="flex-1 bg-transparent outline-none resize-none text-sm text-text-primary placeholder-text-secondary py-1 max-h-[200px] overflow-y-auto leading-relaxed min-h-[60px]"
            />
            {/* 发送 / 停止 */}
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors shrink-0"
                title="停止生成"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className={`p-2 rounded-xl transition-colors shrink-0 ${
                  text.trim()
                    ? 'bg-gradient-to-r from-[#165DFF] to-[#044AE9] text-white hover:opacity-90 shadow-btn'
                    : 'bg-bg-hover text-text-secondary cursor-not-allowed'
                }`}
                title="发送 (Enter)"
              >
                <Send size={14} />
              </button>
            )}
          </div>

          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-3 pb-2.5 min-w-0 gap-2">
            {/* 左：附件 + 模式切换 + 分隔线 + 内容类型 */}
            {/* overflow 不能设在这里——子下拉面板是 absolute 定位，overflow:hidden/auto 会裁切它们 */}
            <div className="flex items-center gap-0.5 min-w-0 flex-1">
              {/* 附件区域（上传 + 云盘选择） */}
              <div className="relative flex items-center shrink-0">
                {/* 本地上传 */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  title="上传文件 (md/txt/docx)"
                  className="p-1.5 rounded-lg text-text-secondary hover:text-brand hover:bg-brand-light transition-colors"
                >
                  <Paperclip size={14} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.txt,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = '';
                  }}
                />
                {/* 云盘文件选择 */}
                <button
                  onClick={() => setCloudPickerOpen((v) => !v)}
                  title="从云盘选择文件"
                  className={`p-1.5 rounded-lg transition-colors ${
                    cloudPickerOpen
                      ? 'text-brand bg-brand-light'
                      : 'text-text-secondary hover:text-brand hover:bg-brand-light'
                  }`}
                >
                  <HardDrive size={14} />
                </button>
                {/* 云盘文件选择面板 */}
                {cloudPickerOpen && (
                  <CloudFilePicker
                    onSelect={(f) => setAttachment(f)}
                    onClose={() => setCloudPickerOpen(false)}
                  />
                )}
              </div>

              {/* 模式切换（紧贴附件按鈕右侧） */}
              <ModeDropdown mode={currentMode} onChange={setCurrentMode} />
              
              {/* 知识库选择按鈕 */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setKbPickerOpen((v) => !v)}
                  title="选择知识库（RAG）"
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedKbIds.length > 0
                      ? 'bg-blue-50 border border-blue-200 text-blue-600'
                      : 'text-text-secondary hover:text-brand hover:bg-brand-light border border-transparent'
                  }`}
                >
                  <BookOpen size={13} />
                  {selectedKbIds.length > 0 && (
                    <span className="bg-blue-500 text-white text-[9px] rounded-full px-1 leading-tight">
                      {selectedKbIds.length}
                    </span>
                  )}
                </button>
                {kbPickerOpen && (
                  <KbPicker
                    selected={selectedKbIds}
                    onChange={setSelectedKbIds}
                    onClose={() => setKbPickerOpen(false)}
                  />
                )}
              </div>

              {/* 分隔线 */}
              <div className="w-px h-4 bg-brand-border mx-1.5 shrink-0" />

              {/* 内容类型 pills（桌面端）
                  overflow-x-auto 会建立滚动容器，强制 overflow-y 也裁切超出 padding box 的内容；
                  badge 用 -top-1.5 向上超出 6px 会被裁切。
                  py-2 (8px) 扩大 padding box：badge 的 -6px 仍在 padding box 内不被裁切；
                  -my-2 抵消外部高度增加，工具栏高度不变。*/}
              <div className="hidden sm:flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2 -my-2">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.key}
                    onClick={() => handleContentTypeChange(ct.key)}
                    title={ct.badge}
                    className={`relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 whitespace-nowrap ${
                      contentType === ct.key
                        ? 'bg-gradient-to-r from-[#165DFF] to-[#044AE9] text-white shadow-sm'
                        : 'text-text-secondary hover:text-brand hover:bg-brand-light'
                    }`}
                  >
                    {ct.icon}
                    <span>{ct.label}</span>
                    {ct.badge && contentType !== ct.key && (
                      <span className="absolute -top-1.5 -right-1 text-[9px] bg-orange-400 text-white rounded-full px-1 leading-tight">
                        新
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 内容类型下拉（移动端） */}
              <ContentTypeDropdown value={contentType} onChange={handleContentTypeChange} />
            </div>

            {/* 右：提示 */}
            <p className="text-[10px] text-text-secondary shrink-0 pl-2">
              {uploading ? '上传中...' : 'Enter 发送'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
