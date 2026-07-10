import { useEffect, useState, useRef } from 'react';
import {
  Plus, MessageSquare, Trash2, Edit3, Check, X,
  ChevronLeft, ChevronRight, ChevronDown, Settings, Eye, EyeOff,
  HardDrive, Upload, FileText, RefreshCw, AlertTriangle, Download, QrCode, GraduationCap,
} from 'lucide-react';
import { useChatStore } from '../../stores/chat.store';
import { useAuthStore } from '../../stores/auth.store';
import { convApi, modelApi, fileApi } from '../../services/api';
import type { UserModelConfig } from '../../stores/chat.store';

// 支持的提供商列表（自动填充 Base URL）
const PROVIDERS = [
  { key: 'openai',     label: 'OpenAI',          baseUrl: 'https://api.openai.com/v1' },
  { key: 'doubao',     label: '豆包 (火山引擎)',   baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { key: 'moonshot',   label: 'Moonshot (Kimi)',  baseUrl: 'https://api.moonshot.cn/v1' },
  { key: 'deepseek',   label: 'DeepSeek',         baseUrl: 'https://api.deepseek.com' },
  { key: 'minimax',    label: 'MiniMax',          baseUrl: 'https://api.minimax.chat/v1' },
  { key: 'qwen',       label: '通义千问',          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { key: 'anthropic',  label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1' },
  { key: 'custom',     label: '自定义',            baseUrl: '' },
];

function genLocalId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── 自定义模型下拉组件 ────────────────────────────────────────────
interface ModelDropdownProps {
  models: import('../../stores/chat.store').AiModel[];
  userModels: import('../../stores/chat.store').UserModelConfig[];
  currentModelId: number | null;
  currentUserModel: import('../../stores/chat.store').UserModelConfig | null;
  onChange: (value: string) => void;
}

function ModelDropdown({ models, userModels, currentModelId, currentUserModel, onChange }: ModelDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点外关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = currentUserModel
    ? currentUserModel.name
    : models.find((m) => m.id === currentModelId)?.name || '选择模型';

  const selectedProvider = currentUserModel
    ? currentUserModel.provider
    : models.find((m) => m.id === currentModelId)?.provider || '';

  // 提供商颜色映射
  const providerColor: Record<string, string> = {
    doubao: '#165DFF', moonshot: '#8B5CF6', deepseek: '#06B6D4',
    minimax: '#F59E0B', qwen: '#10B981', openai: '#10A37F',
    anthropic: '#CC785C', custom: '#6C6F7D',
  };
  const color = providerColor[selectedProvider] || '#165DFF';

  return (
    <div ref={ref} className="relative">
      {/* 触发按鈕 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] border transition-all ${
          open
            ? 'border-brand shadow-[0_0_0_3px_rgba(22,93,255,0.1)] bg-white'
            : 'border-brand-border bg-bg-page hover:border-brand/50 hover:bg-white'
        }`}
      >
        {/* 彩色圆点指示提供商 */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 text-xs font-medium text-text-primary truncate text-left">
          {selectedLabel}
        </span>
        <ChevronDown
          size={13}
          className={`text-text-secondary transition-transform duration-200 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-brand-border rounded-[12px] shadow-modal z-50 overflow-hidden animate-fade-in">
          {/* 系统模型（minimax / qwen 隐藏，用户可自行配置 AK） */}
          {models.filter(m => !['minimax', 'qwen'].includes(m.provider)).length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-text-secondary tracking-wider">
                系统模型
              </div>
              {models.filter(m => !['minimax', 'qwen'].includes(m.provider)).map((m) => {
                const c = providerColor[m.provider] || '#165DFF';
                const isActive = m.id === currentModelId && !currentUserModel;
                return (
                  <button
                    key={m.id}
                    onClick={() => { onChange(String(m.id)); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                      isActive ? 'bg-brand-light' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
                    <span className={`flex-1 ${
                      isActive ? 'text-brand font-medium' : 'text-text-primary'
                    }`}>{m.name}</span>
                    {isActive && <Check size={12} className="text-brand shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* 我的模型 */}
          {userModels.length > 0 && (
            <div className={models.length > 0 ? 'border-t border-brand-border' : ''}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-text-secondary tracking-wider">
                我的模型
              </div>
              {userModels.map((m) => {
                const c = providerColor[m.provider] || '#6C6F7D';
                const isActive = currentUserModel?.localId === m.localId;
                return (
                  <button
                    key={m.localId}
                    onClick={() => { onChange(`u_${m.localId}`); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                      isActive ? 'bg-brand-light' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
                    <span className={`flex-1 ${
                      isActive ? 'text-brand font-medium' : 'text-text-primary'
                    }`}>{m.name}</span>
                    <span className="text-[10px] text-text-secondary">{m.provider}</span>
                    {isActive && <Check size={12} className="text-brand shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {models.length === 0 && userModels.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-text-secondary">暂无可用模型</div>
          )}

          <div className="px-3 py-2 border-t border-brand-border" />
        </div>
      )}
    </div>
  );
}

type FormState = Partial<UserModelConfig> & { showKey?: boolean };

export default function ChatSidebar({ onClose }: { onClose?: () => void } = {}) {
  const {
    conversations, currentConvId, models, currentModelId, currentUserModel,
    setConversations, setCurrentConv, addConversation, removeConversation, updateConversation,
    setModels, setCurrentModelId, setCurrentUserModel,
    sidebarOpen, setSidebarOpen,
    userModels, setUserModels,
  } = useChatStore();
  const { isLoggedIn, setShowLoginModal } = useAuthStore();

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // 模型配置面板
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null); // null=收起, ''=新增, localId=编辑
  const [form, setForm] = useState<FormState>({});

  // 自定义确认弹窗
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  // 云盘状态
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'cloud'>('chat');
  const [cloudFiles, setCloudFiles] = useState<any[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudUploading, setCloudUploading] = useState(false);
  const cloudFileRef = useRef<HTMLInputElement>(null);

  // 从 localStorage 加载用户模型
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ai_chat_user_models');
      if (stored) setUserModels(JSON.parse(stored));
    } catch {}
  }, []);

  // 加载对话和系统模型
  useEffect(() => {
    convApi.list().then((list: any) => setConversations(list)).catch(() => {});
    modelApi.list().then((list: any) => {
      setModels(list);
      if (list.length > 0 && !currentModelId && !currentUserModel) {
        setCurrentModelId(list[0].id);
      }
    }).catch(() => {});
  }, [isLoggedIn]);

  // 持久化用户模型
  const persistUserModels = (list: UserModelConfig[]) => {
    setUserModels(list);
    localStorage.setItem('ai_chat_user_models', JSON.stringify(list));
  };

  const handleModelChange = (value: string) => {
    if (value.startsWith('u_')) {
      const m = userModels.find((u) => u.localId === value.slice(2));
      if (m) { setCurrentUserModel(m); setCurrentModelId(null); }
    } else {
      setCurrentModelId(Number(value));
      setCurrentUserModel(null);
    }
  };

  // 新建对话
  const handleNewChat = async () => {
    if (!isLoggedIn) { setShowLoginModal(true); return; }
    const conv = await convApi.create({ model_id: currentModelId, mode: 'fast' }) as any;
    addConversation(conv);
    setCurrentConv(conv.id);
    onClose?.();
  };

  // 重命名
  const handleRename = async (id: string) => {
    await convApi.update(id, { title: editTitle });
    updateConversation(id, { title: editTitle });
    setEditingConvId(null);
  };

  // 删除对话
  const handleDeleteConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm('确认删除此对话？删除后无法恢复。', async () => {
      await convApi.delete(id);
      removeConversation(id);
    });
  };

  // 保存用户模型
  const handleSaveModel = () => {
    if (!form.name || !form.api_key || !form.model_id) return;
    const provider = PROVIDERS.find((p) => p.key === form.provider);
    if (editingModelId && editingModelId !== '') {
      // 编辑
      persistUserModels(
        userModels.map((m) =>
          m.localId === editingModelId
            ? { ...m, name: form.name!, provider: form.provider || 'custom', model_id: form.model_id!, base_url: form.base_url || provider?.baseUrl || '', api_key: form.api_key! }
            : m,
        ),
      );
      // 如果当前选中的是这个模型，更新 currentUserModel
      if (currentUserModel?.localId === editingModelId) {
        setCurrentUserModel({ ...currentUserModel, name: form.name!, provider: form.provider || 'custom', model_id: form.model_id!, base_url: form.base_url || provider?.baseUrl || '', api_key: form.api_key! });
      }
    } else {
      // 新增
      persistUserModels([
        ...userModels,
        {
          localId: genLocalId(),
          name: form.name!,
          provider: form.provider || 'custom',
          model_id: form.model_id!,
          base_url: form.base_url || provider?.baseUrl || '',
          api_key: form.api_key!,
        },
      ]);
    }
    setForm({});
    setEditingModelId(null);
  };

  const handleDeleteModel = (localId: string) => {
    showConfirm('确认删除此模型配置？', () => {
      persistUserModels(userModels.filter((m) => m.localId !== localId));
      if (currentUserModel?.localId === localId) {
        setCurrentUserModel(null);
        if (models.length > 0) setCurrentModelId(models[0].id);
      }
    });
  };

  // ── 云盘功能 ─────────────────────────────────────────
  const loadCloudFiles = async () => {
    setCloudLoading(true);
    try {
      const files = await fileApi.list() as unknown as any[];
      setCloudFiles(files);
    } catch { /* ignore */ }
    finally { setCloudLoading(false); }
  };

  useEffect(() => {
    if (sidebarTab === 'cloud' && isLoggedIn) loadCloudFiles();
  }, [sidebarTab, isLoggedIn]);

  const handleCloudFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCloudUploading(true);
    try {
      await fileApi.upload(file);
      await loadCloudFiles();
    } catch { alert('上传失败，请检查文件格式'); }
    finally { setCloudUploading(false); }
  };

  const handleDeleteCloudFile = async (id: number) => {
    showConfirm('确认删除该文件？删除后无法恢复。', async () => {
      try {
        await fileApi.delete(id);
        setCloudFiles((prev) => prev.filter((f) => f.id !== id));
      } catch { alert('删除失败'); }
    });
  };

  const handleDownloadCloudFile = async (id: number, filename: string) => {
    try {
      await fileApi.download(id, filename);
    } catch {
      alert('下载失败，请稍后重试');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatRelTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getFileExt = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';
  const extColor: Record<string, string> = { md: 'text-purple-500', txt: 'text-gray-500', docx: 'text-blue-500' };

  // ── 折叠状态 ──────────────────────────
  if (!sidebarOpen) {
    return (
      <div className="w-12 flex flex-col items-center py-3 gap-1 border-r border-brand-border bg-white shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-brand-light transition-colors text-text-secondary"
          title="展开侧边栏"
        >
          <ChevronRight size={16} />
        </button>
        <div className="w-8 h-px bg-brand-border my-1" />
        <button
          onClick={() => { setSidebarTab('chat'); setSidebarOpen(true); }}
          className={`p-2 rounded-lg transition-colors ${
            sidebarTab === 'chat' ? 'bg-brand-light text-brand' : 'text-text-secondary hover:bg-brand-light hover:text-brand'
          }`}
          title="对话"
        >
          <MessageSquare size={16} />
        </button>
        <button
          onClick={() => { setSidebarTab('cloud'); setSidebarOpen(true); }}
          className={`p-2 rounded-lg transition-colors ${
            sidebarTab === 'cloud' ? 'bg-brand-light text-brand' : 'text-text-secondary hover:bg-brand-light hover:text-brand'
          }`}
          title="云盘"
        >
          <HardDrive size={16} />
        </button>
        <div className="flex-1" />
        {/* AI源码学习（折叠态） */}
        <a
          href="https://aibook.mvtable.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-text-secondary hover:bg-brand-light hover:text-brand transition-colors"
          title="AI源码学习"
        >
          <GraduationCap size={16} />
        </a>
        {/* 联系作者（折叠态） */}
        <button
          onClick={() => { setSidebarOpen(true); setShowContactModal(true); }}
          className="p-2 rounded-lg text-text-secondary hover:bg-brand-light hover:text-brand transition-colors"
          title="联系作者"
        >
          <QrCode size={16} />
        </button>
        <button
          onClick={handleNewChat}
          className="p-2 rounded-lg hover:bg-brand-light transition-colors text-brand mb-1"
          title="新建对话"
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  // ── 展开状态 ──────────────────────────
  return (
    <div className="relative w-64 flex flex-col border-r border-brand-border bg-white shrink-0 overflow-hidden">

      {/* 顶部工具栏：收起 + Tab 导航 */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-brand-border">
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg hover:bg-brand-light transition-colors text-text-secondary shrink-0"
          title="收起侧边栏"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex flex-1 gap-1">
          <button
            onClick={() => setSidebarTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[8px] text-xs font-medium transition-all ${
              sidebarTab === 'chat' ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <MessageSquare size={12} />
            对话
          </button>
          <button
            onClick={() => setSidebarTab('cloud')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[8px] text-xs font-medium transition-all ${
              sidebarTab === 'cloud' ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <HardDrive size={12} />
            云盘
          </button>
        </div>
      </div>

      {/* Tab 内容区 */}
      {sidebarTab === 'chat' ? (
        <>
          {/* 新建对话 */}
          <div className="px-3 py-3">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#165DFF] to-[#044AE9] text-white rounded-[10px] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              新建对话
            </button>
          </div>

      {/* 模型选择器 */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <ModelDropdown
              models={models}
              userModels={userModels}
              currentModelId={currentModelId}
              currentUserModel={currentUserModel}
              onChange={handleModelChange}
            />
          </div>
          {/* 配置按钮 */}
          <button
            onClick={() => {
              setShowModelConfig((v) => !v);
              setEditingModelId(null);
              setForm({});
            }}
            title="配置我的模型"
            className={`p-1.5 rounded-[8px] border transition-all shrink-0 ${
              showModelConfig
                ? 'bg-brand text-white border-brand'
                : 'text-text-secondary hover:text-brand hover:bg-brand-light border-brand-border'
            }`}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 模型配置面板 */}
      {showModelConfig && (
        <div className="mx-3 mb-2 rounded-[10px] border border-brand-border bg-bg-page text-xs overflow-hidden animate-fade-in">
          {/* 面板头 */}
          <div className="px-3 py-2 bg-brand-light flex items-center justify-between border-b border-brand-border">
            <span className="font-semibold text-brand">我的模型</span>
            <span className="text-text-secondary">{userModels.length} 个已配置</span>
          </div>

          {/* 用户模型列表 */}
          {userModels.length === 0 && editingModelId === null && (
            <div className="py-4 text-center text-text-secondary">
              <p>暂无配置，点击下方添加</p>
            </div>
          )}
          {userModels.map((m) => (
            <div
              key={m.localId}
              className="flex items-center gap-2 px-3 py-2 border-b border-brand-border/50 last:border-0 hover:bg-white transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">{m.name}</p>
                <p className="text-[10px] text-text-secondary truncate">{m.model_id}</p>
              </div>
              <button
                onClick={() => { setEditingModelId(m.localId); setForm({ ...m }); }}
                className="p-1 rounded hover:bg-brand-light text-text-secondary hover:text-brand transition-colors"
              >
                <Edit3 size={11} />
              </button>
              <button
                onClick={() => handleDeleteModel(m.localId)}
                className="p-1 rounded hover:bg-red-50 text-text-secondary hover:text-red-500 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {/* 添加/编辑表单 */}
          {editingModelId !== null && (
            <div className="p-3 bg-white border-t border-brand-border space-y-2">
              <p className="font-semibold text-text-primary mb-1">
                {editingModelId ? '编辑模型' : '添加模型'}
              </p>
              {/* 名称 */}
              <input
                value={form.name || ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="模型名称（如：GPT-4o）"
                className="w-full border border-brand-border rounded-[6px] px-2 py-1.5 outline-none focus:border-brand bg-bg-page"
              />
              {/* 提供商 */}
              <select
                value={form.provider || 'openai'}
                onChange={(e) => {
                  const p = PROVIDERS.find((x) => x.key === e.target.value);
                  setForm((f) => ({ ...f, provider: e.target.value, base_url: p?.baseUrl || f.base_url }));
                }}
                className="w-full border border-brand-border rounded-[6px] px-2 py-1.5 outline-none focus:border-brand bg-bg-page"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              {/* Model ID */}
              <input
                value={form.model_id || ''}
                onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                placeholder="Model ID（如：gpt-4o）"
                className="w-full border border-brand-border rounded-[6px] px-2 py-1.5 outline-none focus:border-brand bg-bg-page"
              />
              {/* Base URL */}
              <input
                value={form.base_url || ''}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="API Base URL"
                className="w-full border border-brand-border rounded-[6px] px-2 py-1.5 outline-none focus:border-brand bg-bg-page"
              />
              {/* API Key */}
              <div className="relative">
                <input
                  type={form.showKey ? 'text' : 'password'}
                  value={form.api_key || ''}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder="API Key"
                  className="w-full border border-brand-border rounded-[6px] px-2 py-1.5 pr-8 outline-none focus:border-brand bg-bg-page"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, showKey: !f.showKey }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-brand"
                >
                  {form.showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              {/* 按钮组 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveModel}
                  disabled={!form.name || !form.api_key || !form.model_id}
                  className="flex-1 py-1.5 bg-brand text-white rounded-[6px] font-medium hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  保存
                </button>
                <button
                  onClick={() => { setForm({}); setEditingModelId(null); }}
                  className="flex-1 py-1.5 border border-brand-border text-text-secondary rounded-[6px] hover:bg-brand-light transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 添加按钮（未在编辑时显示） */}
          {editingModelId === null && (
            <button
              onClick={() => { setEditingModelId(''); setForm({ provider: 'openai', base_url: PROVIDERS[0].baseUrl }); }}
              className="w-full py-2.5 text-brand hover:bg-brand-light transition-colors flex items-center justify-center gap-1 border-t border-brand-border"
            >
              <Plus size={12} />
              添加我的模型
            </button>
          )}
        </div>
      )}

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-xs">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
            <p>暂无对话</p>
            <p className="mt-0.5">点击「新建对话」开始</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => { setCurrentConv(conv.id); onClose?.(); }}
              className={`group flex items-center gap-2 px-3 py-2 rounded-[8px] cursor-pointer mb-0.5 transition-all
                ${currentConvId === conv.id
                  ? 'bg-brand-light text-brand'
                  : 'hover:bg-bg-hover text-text-secondary'
                }`}
            >
              <MessageSquare size={14} className="shrink-0 opacity-60" />

              {editingConvId === conv.id ? (
                <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(conv.id)}
                    className="flex-1 text-xs bg-white border border-brand rounded px-1.5 py-0.5 outline-none text-text-primary"
                  />
                  <button onClick={() => handleRename(conv.id)} className="text-brand hover:opacity-70">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingConvId(null)} className="text-text-secondary hover:opacity-70">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-xs line-clamp-1">{conv.title}</span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingConvId(conv.id); setEditTitle(conv.title); }}
                      className="p-0.5 rounded hover:bg-brand-border/50 transition-colors"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConv(conv.id, e)}
                      className="p-0.5 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
        </>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-brand-border">
            <div>
              <span className="text-xs font-semibold text-text-primary">我的云盘</span>
              {cloudFiles.length > 0 && (
                <span className="ml-1.5 text-[10px] text-text-secondary">{cloudFiles.length} 个文件</span>
              )}
            </div>
            <button
              onClick={loadCloudFiles}
              disabled={cloudLoading}
              className="p-1 rounded-lg hover:bg-brand-light transition-colors text-text-secondary"
              title="刷新"
            >
              <RefreshCw size={12} className={cloudLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="px-3 py-2.5 border-b border-brand-border">
            <input
              ref={cloudFileRef}
              type="file"
              accept=".md,.txt,.docx"
              className="hidden"
              onChange={handleCloudFileSelect}
            />
            <button
              onClick={() => cloudFileRef.current?.click()}
              disabled={cloudUploading || !isLoggedIn}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-brand-border hover:border-brand hover:bg-brand-light/50 rounded-[10px] text-xs text-text-secondary hover:text-brand transition-all disabled:opacity-50"
            >
              {cloudUploading
                ? <RefreshCw size={13} className="animate-spin" />
                : <Upload size={13} />}
              {cloudUploading ? '上传中...' : '点击上传文件'}
            </button>
            <p className="text-center text-[10px] text-text-secondary mt-1.5">支持 .md / .txt / .docx</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {!isLoggedIn ? (
              <div className="text-center py-8 text-text-secondary text-xs">
                <HardDrive size={24} className="mx-auto mb-2 opacity-30" />
                <p>登录后查看云盘文件</p>
              </div>
            ) : cloudLoading ? (
              <div className="text-center py-8 text-text-secondary text-xs">
                <RefreshCw size={18} className="mx-auto mb-2 animate-spin opacity-40" />
                <p>加载中...</p>
              </div>
            ) : cloudFiles.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-xs">
                <HardDrive size={28} className="mx-auto mb-2 opacity-25" />
                <p className="font-medium">云盘为空</p>
                <p className="mt-1 opacity-70">上传文件后在此管理</p>
              </div>
            ) : (
              cloudFiles.map((file) => {
                const ext = getFileExt(file.filename);
                const color = extColor[ext] || 'text-gray-400';
                return (
                  <div
                    key={file.id}
                    className="group flex items-start gap-2 px-2 py-2 rounded-[8px] hover:bg-bg-hover transition-colors mb-0.5"
                  >
                    <FileText size={15} className={`mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        {formatFileSize(file.size)} &middot; {formatRelTime(file.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleDownloadCloudFile(file.id, file.filename)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-brand-light text-text-secondary hover:text-brand transition-all shrink-0"
                        title="下载文件"
                      >
                        <Download size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteCloudFile(file.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-text-secondary hover:text-red-500 transition-all shrink-0"
                        title="删除文件"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* AI源码学习 + 联系作者 — 底部固定 */}
      <div className="px-3 py-2.5 border-t border-brand-border shrink-0 space-y-1.5">
        <a
          href="https://aibook.mvtable.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] text-xs font-medium text-white btn-shine hover:opacity-90 transition-opacity"
        >
          <GraduationCap size={13} />
          AI源码学习
        </a>
        <button
          onClick={() => setShowContactModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] text-xs font-medium text-text-secondary hover:text-brand hover:bg-brand-light border border-brand-border hover:border-brand transition-all"
        >
          <QrCode size={13} />
          联系作者
        </button>
      </div>

      {/* 联系作者弹窗 */}
      {showContactModal && (
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center px-4"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="w-full bg-white rounded-[16px] shadow-modal p-5 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">联系作者</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-1 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-44 h-44 rounded-[12px] overflow-hidden border border-brand-border shadow-sm">
                <img
                  src="https://next.jitword.com/uploads/WechatIMG246_19d428a664c.jpg"
                  alt="微信二维码"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <p className="text-xs text-text-secondary text-center leading-relaxed">
                扫码加微信，加入 AI 小夕开发交流群
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 自定义确认弹窗 — 全局居中 */}
      {confirmDialog && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center px-4">
          <div className="w-full bg-white rounded-[14px] shadow-modal p-4 animate-fade-in">
            <div className="flex items-start gap-2 mb-4">
              <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-text-primary leading-relaxed font-medium">{confirmDialog.message}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 text-xs border border-brand-border rounded-[8px] text-text-secondary hover:bg-bg-hover transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  fn();
                }}
                className="flex-1 py-2 text-xs bg-red-500 text-white rounded-[8px] hover:bg-red-600 transition-colors font-medium"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
