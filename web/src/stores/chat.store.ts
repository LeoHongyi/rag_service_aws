import { create } from 'zustand';
import type { ChatMode } from '../constants';

/** 用户自定义模型配置（存 localStorage） */
export interface UserModelConfig {
  localId: string;
  name: string;
  provider: string;
  model_id: string;
  base_url: string;
  api_key: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: string;   // 'text' | 'multimodal' | 'human_support' | ...
  reasoning_content?: string;
  model_used?: string;
  created_at: string;
  streaming?: boolean;
  /** RAG 来源引用（仅在知识库检索命中时有值） */
  rag_sources?: Array<{ filename: string }>;
}

export interface Conversation {
  id: string;
  user_id: number;
  title: string;
  model_id: number | null;
  model_name?: string;
  mode: ChatMode;
  created_at: string;
  updated_at: string;
}

export interface AiModel {
  id: number;
  name: string;
  provider: string;
  model_id: string;
  enabled: number;
  sort_order: number;
}

interface ChatState {
  conversations: Conversation[];
  currentConvId: string | null;
  messages: Record<string, Message[]>;
  models: AiModel[];
  currentModelId: number | null;
  currentMode: ChatMode;
  isStreaming: boolean;
  streamingMsgId: string | null;
  sidebarOpen: boolean;

  setConversations: (list: Conversation[]) => void;
  setCurrentConv: (id: string | null) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;

  setMessages: (convId: string, msgs: Message[]) => void;
  appendMessage: (convId: string, msg: Message) => void;
  appendChunk: (convId: string, msgId: string, chunk: string) => void;
  appendReasoning: (convId: string, msgId: string, chunk: string) => void;
  finalizeMessage: (convId: string, msgId: string) => void;
  /** 设置 RAG 来源信息 */
  setMessageSources: (convId: string, msgId: string, sources: Array<{ filename: string }>) => void;
  /** 多模态消息：将内容中的 [IMAGE_N] 占位符替换为实际图片 Markdown */
  replaceImagePlaceholder: (convId: string, msgId: string, index: number, url: string) => void;
  /** 生成完成后清理残留的 [IMAGE_N] 占位符（防御） */
  cleanImagePlaceholders: (convId: string, msgId: string) => void;

  setModels: (models: AiModel[]) => void;
  setCurrentModelId: (id: number | null) => void;
  setCurrentMode: (mode: ChatMode) => void;
  setStreaming: (v: boolean, msgId?: string) => void;
  setSidebarOpen: (v: boolean) => void;

  /** 重新生成：清空消息内容，重置为 streaming 状态 */
  resetMessageForRegenerate: (convId: string, msgId: string) => void;

  /** 全局停止函数（由 ChatInput/ChatMessages 设置） */
  stopStreaming: (() => void) | null;
  setStopStreaming: (fn: (() => void) | null) => void;

  // 用户自定义模型
  userModels: UserModelConfig[];
  currentUserModel: UserModelConfig | null;
  setUserModels: (models: UserModelConfig[]) => void;
  setCurrentUserModel: (m: UserModelConfig | null) => void;

  /** 快捷建议词填充输入框 */
  draftText: string;
  setDraftText: (text: string) => void;

  /**
   * 流式恢复：用户点击 Banner「重新生成」时，由 ChatPage 写入，
   * ChatInput 监听后自动填充并触发发送。
   */
  pendingRecovery: { userQuery: string; contentType: string } | null;
  setPendingRecovery: (v: { userQuery: string; contentType: string } | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  /** 页面刷新/导航后自动定位到上次的对话 */
  currentConvId: localStorage.getItem('last_conv_id') || null,
  messages: {},
  models: [],
  currentModelId: null,
  currentMode: 'fast',
  isStreaming: false,
  streamingMsgId: null,
  sidebarOpen: true,

  setConversations: (list) => set({ conversations: list }),
  setCurrentConv: (id) => {
    // 同步到 localStorage，页面刷新后自动定位到上次会话
    if (id) localStorage.setItem('last_conv_id', id);
    else localStorage.removeItem('last_conv_id');
    set({ currentConvId: id });
  },

  addConversation: (conv) =>
    set((s) => ({ conversations: [conv, ...s.conversations] })),

  updateConversation: (id, data) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      currentConvId: s.currentConvId === id ? null : s.currentConvId,
    })),

  setMessages: (convId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),

  appendMessage: (convId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: [...(s.messages[convId] || []), msg],
      },
    })),

  appendChunk: (convId, msgId, chunk) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId ? { ...m, content: m.content + chunk } : m,
        ),
      },
    })),

  appendReasoning: (convId, msgId, chunk) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId
            ? { ...m, reasoning_content: (m.reasoning_content || '') + chunk }
            : m,
        ),
      },
    })),

  finalizeMessage: (convId, msgId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId ? { ...m, streaming: false } : m,
        ),
      },
    })),

  setMessageSources: (convId, msgId, sources) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId ? { ...m, rag_sources: sources } : m,
        ),
      },
    })),

  replaceImagePlaceholder: (convId, msgId, index, url) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) => {
          if (m.id !== msgId) return m;
          const replacement = url
            ? `![\u751f\u6210\u56fe\u7247${index + 1}](${url})`
            : `> \u26a0\ufe0f \u56fe\u7247${index + 1}\u751f\u6210\u5931\u8d25`;
          return { ...m, content: m.content.replace(`[IMAGE_${index}]`, replacement) };
        }),
      },
    })),
  
  cleanImagePlaceholders: (convId, msgId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id !== msgId ? m : { ...m, content: m.content.replace(/\[IMAGE_\d+\]/g, '') },
        ),
      },
    })),

  setModels: (models) => set({ models }),
  setCurrentModelId: (id) => set({ currentModelId: id }),
  setCurrentMode: (mode) => set({ currentMode: mode }),
  setStreaming: (v, msgId) => set({ isStreaming: v, streamingMsgId: msgId || null }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  resetMessageForRegenerate: (convId, msgId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId
            ? { ...m, content: '', reasoning_content: undefined, streaming: true }
            : m,
        ),
      },
    })),

  stopStreaming: null,
  setStopStreaming: (fn) => set({ stopStreaming: fn }),

  userModels: [],
  currentUserModel: null,
  setUserModels: (userModels) => set({ userModels }),
  setCurrentUserModel: (currentUserModel) => set({ currentUserModel }),

  draftText: '',
  setDraftText: (draftText) => set({ draftText }),

  pendingRecovery: null,
  setPendingRecovery: (pendingRecovery) => set({ pendingRecovery }),
}));
