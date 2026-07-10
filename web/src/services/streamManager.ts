/**
 * streamManager — AI 流式生成状态持久化服务
 *
 * 解决场景：用户在 AI 流式生成过程中切换页面或关闭 Tab，
 * 再次返回时能检测到未完成的对话，提示是否重新生成。
 *
 * 工作原理：
 * 1. 流式生成开始时写入 localStorage checkpoint
 * 2. 每次收到 chunk 防抖更新 checkpoint（800ms）
 * 3. beforeunload 时立即同步写入（不走防抖）
 * 4. 生成完成/报错时清除 checkpoint
 * 5. 页面加载时检测 checkpoint → 展示恢复提示
 */

export interface StreamCheckpoint {
  /** 对话 ID */
  convId: string;
  /** 正在流式生成的 AI 消息 ID */
  msgId: string;
  /** 用户原始提问 */
  userQuery: string;
  /** 内容类型：text / image / multimodal / webdesign / career */
  contentType: string;
  /** 对话模式：fast / deep / expert */
  mode: string;
  /** 已生成的部分内容（防抖快照） */
  content: string;
  /** 已生成的推理内容（deep think 模式） */
  reasoningContent: string;
  /** 流式开始时间戳（ms） */
  startedAt: number;
  /** 最后一次更新时间戳（ms） */
  updatedAt: number;
}

const STORAGE_KEY = 'ai_stream_checkpoint';
const DEBOUNCE_MS = 800;
/** checkpoint 超过 24h 视为过期自动丢弃 */
const EXPIRE_MS = 24 * 60 * 60 * 1000;

let currentCheckpoint: StreamCheckpoint | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── 内部工具 ───────────────────────────────────────────────────

function saveToStorage(): void {
  if (currentCheckpoint) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCheckpoint));
    } catch {
      // localStorage 写满等情况静默忽略
    }
  }
}

function handleBeforeUnload(): void {
  if (!currentCheckpoint) return;
  // 取消防抖定时器，立即同步写入最新状态
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  currentCheckpoint.updatedAt = Date.now();
  saveToStorage();
}

// ─── 公共 API ────────────────────────────────────────────────────

const streamManager = {
  /**
   * 流式生成开始时调用。
   * 立即写入 checkpoint 并注册 beforeunload 监听。
   */
  start(params: {
    convId: string;
    msgId: string;
    userQuery: string;
    contentType: string;
    mode: string;
  }): void {
    const now = Date.now();
    currentCheckpoint = {
      ...params,
      content: '',
      reasoningContent: '',
      startedAt: now,
      updatedAt: now,
    };
    saveToStorage();
    window.addEventListener('beforeunload', handleBeforeUnload);
  },

  /**
   * 每收到一个 chunk 时调用，追加到内存中的 checkpoint，
   * 防抖 800ms 后写入 localStorage，避免高频写盘。
   */
  appendChunk(chunk: string, type: 'content' | 'reasoning' = 'content'): void {
    if (!currentCheckpoint) return;
    if (type === 'content') {
      currentCheckpoint.content += chunk;
    } else {
      currentCheckpoint.reasoningContent += chunk;
    }
    currentCheckpoint.updatedAt = Date.now();

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveToStorage, DEBOUNCE_MS);
  },

  /**
   * 生成正常完成或出错时调用，清除 checkpoint 和监听器。
   */
  complete(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    currentCheckpoint = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    window.removeEventListener('beforeunload', handleBeforeUnload);
  },

  /**
   * 读取 checkpoint。
   * @param convId 若传入则只匹配该对话；不传则返回任意未完成的 checkpoint。
   */
  getCheckpoint(convId?: string): StreamCheckpoint | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const cp = JSON.parse(raw) as StreamCheckpoint;

      // 过期判断
      if (Date.now() - cp.startedAt > EXPIRE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      if (convId && cp.convId !== convId) return null;
      return cp;
    } catch {
      return null;
    }
  },

  /**
   * 主动清除 checkpoint（用户点击"忽略"时调用）。
   */
  clearCheckpoint(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    currentCheckpoint = null;
    window.removeEventListener('beforeunload', handleBeforeUnload);
  },
};

export default streamManager;
