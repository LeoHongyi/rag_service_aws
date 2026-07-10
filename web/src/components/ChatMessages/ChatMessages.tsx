import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, FileText, ChevronDown, ChevronUp, Globe, Briefcase, Monitor, RefreshCw, Layers, MessageCircle, BookOpen } from 'lucide-react';
import { useChatStore, type Message } from '../../stores/chat.store';
import { useAuthStore } from '../../stores/auth.store';
import { useUiStore } from '../../stores/ui.store';
import { streamChat } from '../../services/api';
import { ARTICLE_THRESHOLD } from '../../constants';
import BlinkingLogo from '../BlinkingLogo/BlinkingLogo';
import MermaidChart from '../MermaidChart/MermaidChart';
import 'highlight.js/styles/github-dark.css';

// ── 人工服务卡片（情绪识别触发）──────────────────────────────
const WECHAT_QR_URL = 'https://flowmix.turntip.cn/fm/static/my.8ee63da4.png';

function HumanSupportCard() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="my-3 rounded-[14px] border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <MessageCircle size={14} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-800">已为您安排专属工作人员</p>
            <p className="text-[11px] text-blue-500 mt-0.5">扫码添加微信，获得 1v1 帮助</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-5 h-5 rounded-full bg-blue-100/80 hover:bg-blue-200 flex items-center justify-center transition-colors"
          title="关闭"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* 内容 */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="shrink-0 w-20 h-20 rounded-[10px] overflow-hidden border border-blue-200 bg-white p-1">
          <img src={WECHAT_QR_URL} alt="微信二维码" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="text-xs text-blue-800 font-medium">您好！我们注意到您可能需要更多帮助</p>
          <p className="text-[11px] text-blue-600 leading-relaxed">
            微信扫码联系工作人员，我们将在
            <span className="font-semibold">工作日 9:00-18:00</span>
            内快速响应。
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-green-600 font-medium">工单已记录，工作人员将主动联系您</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 打字机动画组件 ─────────────────────────────────────────
const GREETED_KEY = 'ai_xixi_welcomed';

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const isFirstRef = useRef(!localStorage.getItem(GREETED_KEY));
  const [displayed, setDisplayed] = useState(() => isFirstRef.current ? '' : text);
  const [done, setDone] = useState(() => !isFirstRef.current);

  useEffect(() => {
    if (!isFirstRef.current) return;
    localStorage.setItem(GREETED_KEY, '1');

    let cancelled = false;
    let idx = 0;

    const typeNext = () => {
      if (cancelled) return;
      if (idx >= text.length) { setDone(true); return; }
      idx += 1;
      setDisplayed(text.slice(0, idx));

      const char = text[idx - 1];
      let delay: number;
      if ('\u3002\uff01\uff1f'.includes(char)) {
        // 句末标点（。！？）停顿较长，如同真人读完一句
        delay = 380 + Math.random() * 240;
      } else if ('\uff0c\u3001\uff1b\uff1a'.includes(char)) {
        // 句内标点停顿适中
        delay = 160 + Math.random() * 120;
      } else {
        // 普通字符：50~80ms，6%概率额外停顿模拟思考
        delay = 50 + Math.random() * 30;
        if (Math.random() < 0.06) delay += 160;
      }
      setTimeout(typeNext, delay);
    };

    // 首次进入：延迟 700ms 再开始打字，让用户先看到 logo
    const startTimer = setTimeout(typeNext, 700);
    return () => { cancelled = true; clearTimeout(startTimer); };
  }, []);

  return (
    <span className={className}>
      {displayed}
      {!done && (
        <span className="inline-block w-[2px] h-[0.9em] bg-brand ml-0.5 align-text-bottom rounded-full animate-pulse" />
      )}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="reasoning-block mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1 w-full"
      >
        <Brain size={13} />
        <span>思考过程</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <p className="text-xs text-amber-700 whitespace-pre-wrap leading-relaxed">{content}</p>
      )}
    </div>
  );
}

// 用一个简单组件代替 Brain（避免循环引用）
function Brain({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 3C8 3 7 4 7 5V8C6 8 5 9 5 10C4 10 3 11 3 12C3 14 4.5 15 6 15C6 16 7 17 8 17C8 18 9 19 10 19H14C15 19 16 18 16 17C17 17 18 16 18 15C19.5 15 21 14 21 12C21 11 20 10 19 10C19 9 18 8 17 8V5C17 4 16 3 15 3H9Z" />
    </svg>
  );
}

// ── 多模态AI Agent 进度 Banner ──────────────────────
// Agent 图标

function IconBrain({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
    </svg>
  );
}

function IconPenLine({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9"/>
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 19.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
    </svg>
  );
}

function IconImage({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  );
}

function MultimodalAgentBanner({ phase, summary }: { phase: string; summary?: string }) {
  const steps = [
    { key: 'analyzing',  label: '意图分析', Icon: IconBrain,   desc: '理解需求、规划内容结构' },
    { key: 'generating', label: '内容生成', Icon: IconPenLine, desc: summary || '流式输出图文和图表' },
    { key: 'imaging',    label: '图片生成', Icon: IconImage,   desc: '并行生成配图' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === phase);
  return (
    <div className="flex items-center gap-1.5 mb-3 px-3 py-2 rounded-[10px] bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 border border-purple-200/70 flex-wrap">
      {steps.map((step, i) => {
        const isDone   = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && (
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-secondary mx-0.5">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            )}
            <div
              title={step.desc}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                isDone
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : isActive
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-200 text-text-secondary'
              }`}
            >
              <step.Icon size={11} />
              <span>{step.label}</span>
              {isDone   && <Check size={10} className="text-green-600" />}
              {isActive && <span className="inline-block w-2.5 h-2.5 border border-purple-500 border-t-transparent rounded-full animate-spin" />}
            </div>
          </div>
        );
      })}
      {activeIdx >= 0 && (
        <span className="ml-auto text-[10px] text-text-secondary italic">
          {steps[activeIdx].desc}
        </span>
      )}
    </div>
  );
}

// ── HTML 内容提取（用于网页设计消息） ────────────────────────────
function extractHtmlFromContent(content: string): string | null {
  const raw = content.trim();
  // 从 ```html ... ``` 代码块中提取（贪婪匹配，支持超长 HTML）
  const codeMatch = raw.match(/```(?:html)?\s*\n([\s\S]+)\n?```/i);
  if (codeMatch) {
    const code = codeMatch[1].trim();
    if (code.includes('<!DOCTYPE') || code.toLowerCase().includes('<html')) return code;
  }
  // 裸 HTML（无代码块）
  if (raw.includes('<!DOCTYPE html>') || raw.toLowerCase().startsWith('<html')) return raw;
  return null;
}

// ── 用户头像气泡 ──────────────────────────────────────────
function UserAvatarBubble({ avatar, nickname }: { avatar?: string | null; nickname?: string | null }) {
  const [imgErr, setImgErr] = useState(false);
  const showImg = !!avatar && !imgErr;
  const initial = nickname ? nickname[0].toUpperCase() : 'U';

  if (showImg) {
    return (
      <div className="w-8 h-8 rounded-xl shrink-0 overflow-hidden border border-brand-border">
        <img
          src={avatar!}
          alt="用户"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br from-[#165DFF] to-[#044AE9] text-white text-xs font-bold">
      {initial}
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  isLast: boolean;
  isStreamingNow?: boolean;  // 全局 isStreaming，用于修正最后一条消息的 streaming 状态
  onArticle?: (content: string) => void;
  onWebPreview?: (html: string) => void;
  onRegenerate?: (msgId: string) => void;
  userAvatar?: string | null;
  userNickname?: string | null;
  /** 多模态AI当前 Agent 执行阶段（仅流式期间有值） */
  multimodalPhase?: string;
  multimodalSummary?: string;
}

function MessageItem({ message, isLast, isStreamingNow, onArticle, onWebPreview, onRegenerate, userAvatar, userNickname, multimodalPhase, multimodalSummary }: MessageItemProps) {
  const isUser = message.role === 'user';
  // 修正 streaming 状态：若全局流式已结束（isStreamingNow=false），即使 message.streaming 未及时更新也视为完成
  const isStreaming = message.streaming && (!isLast || !!isStreamingNow);
  const isLongContent = message.content.length > ARTICLE_THRESHOLD;
  // 检测消息是否包含 HTML（网页设计模式生成的网页）
  const htmlContent = (!isUser && !isStreaming) ? extractHtmlFromContent(message.content) : null;

  return (
    <div className={`flex gap-3 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      {isUser ? (
        <UserAvatarBubble avatar={userAvatar} nickname={userNickname} />
      ) : (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-brand-border">
          <img src="/ca/ca2.png" alt="AI" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'max-w-[75%] items-end' : 'flex-1 min-w-0 items-start'}`}>
        {/* 模型名 */}
        {!isUser && message.model_used && (
          <span className="text-[11px] text-text-secondary mb-1">{message.model_used}</span>
        )}

        {/* 思考过程 */}
        {!isUser && message.reasoning_content && (
          <ThinkingBlock content={message.reasoning_content} />
        )}

        {/* 消息内容 */}
        {isUser ? (
          <div className="msg-user">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : message.content_type === 'image' ? (
          <div className="msg-ai min-w-0">
            {isStreaming ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary py-2">
                <span className="inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                图片生成中...
              </div>
            ) : (message.content.startsWith('http') || message.content.startsWith('data:image')) ? (
              <div className="rounded-[12px] overflow-hidden border border-brand-border shadow-sm max-w-sm">
                <img
                  src={message.content}
                  alt="AI 生成的图片"
                  className="w-full h-auto block"
                  loading="lazy"
                />
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-page border-t border-brand-border">
                  <a
                    href={message.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="text-xs text-brand hover:underline"
                  >
                    下载图片
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">{message.content}</p>
            )}
          </div>
        ) : (
          <div className="msg-ai min-w-0 w-full">
            {/* 多模态消息：流式期间展示 Agent 进度，完成后展示标识条 */}
            {message.content_type === 'multimodal' && isStreaming && multimodalPhase && multimodalPhase !== 'idle' && (
              <MultimodalAgentBanner phase={multimodalPhase} summary={multimodalSummary} />
            )}
            {message.content_type === 'multimodal' && !isStreaming && (
              <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-[8px] bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/60 w-fit">
                <Layers size={12} className="text-purple-500" />
                <span className="text-[11px] font-medium text-purple-600">多模态AI 内容</span>
              </div>
            )}
            <div className={`prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-primary prose-code:text-sm ${isStreaming ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={useMemo(() => ({
                  // 自定义 code 渲染器：mermaid 语言块用 MermaidChart 渲染
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const lang = match?.[1];
                    if (lang === 'mermaid') {
                      // 流式中展示骨架屏，完成后才渲染图表
                      return <MermaidChart code={String(children).replace(/\n$/, '')} isStreaming={isStreaming} />;
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                // eslint-disable-next-line react-hooks/exhaustive-deps
                }), [isStreaming])}
              >
                {message.content || (isStreaming ? ' ' : '')}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* RAG 来源引用 */}
        {!isUser && !isStreaming && message.rag_sources && message.rag_sources.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-purple-500 font-medium">
              <BookOpen size={11} />
              知识库来源：
            </span>
            {message.rag_sources.map((src, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] text-purple-700 max-w-[200px]"
                title={src.filename}
              >
                <FileText size={10} />
                <span className="truncate">{src.filename}</span>
              </span>
            ))}
          </div>
        )}

        {/* 操作栏 */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-1.5">
            <CopyButton text={message.content} />
            {/* 网页预览按鈕（仅在 HTML 消息上显示） */}
            {htmlContent && (
              <button
                onClick={() => onWebPreview?.(htmlContent)}
                className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-text-secondary hover:bg-green-50 hover:text-green-600 transition-colors"
              >
                <Monitor size={12} />
                预览网页
              </button>
            )}
            {/* 长文编辑（非 HTML 消息） */}
            {isLongContent && !htmlContent && (
              <button
                onClick={() => onArticle?.(message.content)}
                className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-colors"
              >
                <FileText size={12} />
                长文编辑
              </button>
            )}
            {/* 重新生成按鈕（仅对最后一条 AI 消息显示） */}
            {isLast && onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-text-secondary hover:bg-orange-50 hover:text-orange-500 transition-colors"
                title="重新生成（关联上下文）"
              >
                <RefreshCw size={12} />
                重新生成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 加载指示器
function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-6">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold bg-bg-page border border-brand-border text-brand">
        AI
      </div>
      <div className="msg-ai flex items-center gap-1 py-3">
        <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export default function ChatMessages() {
  const navigate = useNavigate();
  const {
    currentConvId, messages, isStreaming, setDraftText,
    currentModelId, currentMode, currentUserModel,
    appendChunk, appendReasoning, finalizeMessage,
    setStreaming, resetMessageForRegenerate, setStopStreaming,
  } = useChatStore();
  const { setArticlePanel, inputContentType, setInputContentType, setWebPreview,
    multimodalPhase, multimodalPlanSummary } = useUiStore();
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevStreamingRef = useRef(false);

  const currentMessages = currentConvId ? (messages[currentConvId] || []) : [];

  // 重新生成处理函数
  const handleRegenerate = useCallback((msgId: string) => {
    if (!currentConvId || isStreaming) return;
    resetMessageForRegenerate(currentConvId, msgId);
    setStreaming(true, msgId);

    const stop = streamChat(
      {
        conversation_id: currentConvId,
        model_id: currentUserModel ? undefined : (currentModelId || undefined),
        mode: currentMode,
        message: '',
        content_type: inputContentType,
        regenerate: true,
        user_model_id: currentUserModel?.model_id,
        user_base_url: currentUserModel?.base_url,
        user_api_key: currentUserModel?.api_key,
      },
      {
        onChunk: (chunk) => appendChunk(currentConvId, msgId, chunk),
        onReasoning: (chunk) => appendReasoning(currentConvId, msgId, chunk),
        onDone: (data: any) => {
          finalizeMessage(currentConvId, msgId);
          setStreaming(false);
          setStopStreaming(null);
          if (inputContentType === 'webdesign') {
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
          appendChunk(currentConvId, msgId, `\n\n⚠️ 错误: ${err}`);
          finalizeMessage(currentConvId, msgId);
          setStreaming(false);
          setStopStreaming(null);
        },
      },
    );
    setStopStreaming(stop);
  }, [currentConvId, isStreaming, currentModelId, currentMode, currentUserModel, inputContentType]);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, isStreaming]);

  // 流式输出时也滚动
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // 流式输出完成后自动弹出面板（网页设计 → webpreview，长文 → 文章面板）
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && currentMessages.length > 0) {
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.content.length > ARTICLE_THRESHOLD) {
        const html = extractHtmlFromContent(lastMsg.content);
        if (html) {
          // 网页设计：开启预览面板（不覆盖为 article 模式）
          setWebPreview(html);
        } else {
          setArticlePanel(true, lastMsg.content);
        }
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (!currentConvId || currentMessages.length === 0) {
    // 网页设计空状态
    if (inputContentType === 'webdesign') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#165DFF] to-[#044AE9] flex items-center justify-center shadow-lg">
            <Globe size={40} className="text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-text-primary mb-2">网页设计助手</h2>
            <p className="text-text-secondary text-sm max-w-sm">
              描述你的网页需求，AI 将自动匹配最合适的设计风格并生成完整网页，在右侧面板实时预览
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-md w-full">
            {[
              '设计一个 Notion 风格的笔记应用主页',
              '做一个极简的 SaaS 产品落地页',
              '创建一个深色主题的 AI 工具介绍页',
              '设计一个 Stripe 风格的支付页面',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setDraftText(prompt)}
                className="px-4 py-3 text-sm text-text-secondary bg-bg-page border border-brand-border rounded-[10px] hover:border-brand hover:text-brand hover:bg-brand-light transition-all text-left leading-relaxed"
              >
                {prompt}
              </button>
            ))}
          </div>
          <button
            onClick={() => setInputContentType('text')}
            className="text-xs text-text-secondary hover:text-brand transition-colors"
          >
            切换回普通对话
          </button>
        </div>
      );
    }

    // 求职助手空状态
    if (inputContentType === 'career') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
            <Briefcase size={40} className="text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-text-primary mb-2">求职助手小夕</h2>
            <p className="text-text-secondary text-sm max-w-sm">
              专属职业发展顾问，帮你优化简历、辅导面试、规划职业路径
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-md w-full">
            {[
              '帮我优化一下这份简历',
              '模拟一场产品经理面试',
              '我想从开发转型做产品，怎么规划？',
              '帮我写一封求职信',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setDraftText(prompt)}
                className="px-4 py-3 text-sm text-text-secondary bg-bg-page border border-brand-border rounded-[10px] hover:border-brand hover:text-brand hover:bg-brand-light transition-all text-left leading-relaxed"
              >
                {prompt}
              </button>
            ))}
          </div>
          <button
            onClick={() => setInputContentType('text')}
            className="text-xs text-text-secondary hover:text-brand transition-colors"
          >
            切换回普通对话
          </button>
        </div>
      );
    }

    // 默认空状态
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
        <div className="flex items-center gap-6">
          <BlinkingLogo size={128} />
          {/* RAG logo + 气泡提示 */}
          <div
            className="relative cursor-pointer select-none"
            style={{ width: 128, height: 128 }}
            onClick={() => navigate('/knowledge')}
            title="前往知识库"
          >
            <img
              src="https://aibook.mvtable.com/cc/RAG%E7%9F%A5%E8%AF%86%E5%BA%93/rag1.png"
              alt="RAG 知识库"
              style={{ width: 128, height: 128 }}
              className="object-contain hover:scale-105 transition-transform duration-200"
              draggable={false}
            />
            {/* 气泡 */}
            <div
              className="absolute -top-14 left-1/2 -translate-x-1/2 animate-bounce"
              style={{ animationDuration: '2.5s' }}
            >
              <div className="relative bg-brand text-white text-[11px] font-medium px-3 py-1.5 rounded-[10px] whitespace-nowrap shadow-md">
                RAG知识库已上线，快来点我配置吧~
                {/* 气泡尾巴 */}
                <span
                  className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-0 h-0"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #165DFF',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            <TypewriterText text="您好，我是您的专属AI助理，我叫小夕" />
          </h2>
          <p className="text-text-secondary text-sm">点击左侧新建对话，或直接输入问题开始聊天</p>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-md w-full">
          {['帮我写一篇产品介绍', '分析这段代码', '帮我翻译这段文字', '生成一份周报'].map((prompt) => (
            <button
              key={prompt}
              onClick={() => setDraftText(prompt)}
              className="px-4 py-3 text-sm text-text-secondary bg-bg-page border border-brand-border rounded-[10px] hover:border-brand hover:text-brand hover:bg-brand-light transition-all text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {currentMessages.map((msg, idx) => {
          const isLastMsg = idx === currentMessages.length - 1;
          const isLastAssistant = isLastMsg && msg.role === 'assistant';

          // 人工支持卡片：情绪识别触发，展示微信二维码
          if (msg.content_type === 'human_support') {
            return <HumanSupportCard key={msg.id} />;
          }

          return (
            <MessageItem
              key={msg.id}
              message={msg}
              isLast={isLastMsg}
              isStreamingNow={isStreaming}
              onArticle={(content) => setArticlePanel(true, content)}
              onWebPreview={(html) => setWebPreview(html)}
              onRegenerate={isLastAssistant ? handleRegenerate : undefined}
              userAvatar={user?.avatar}
              userNickname={user?.nickname}
              multimodalPhase={isLastMsg && isStreaming && msg.content_type === 'multimodal' ? multimodalPhase : undefined}
              multimodalSummary={multimodalPlanSummary}
            />
          );
        })}
        {isStreaming && currentMessages[currentMessages.length - 1]?.role !== 'assistant' && (
          <TypingIndicator />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
