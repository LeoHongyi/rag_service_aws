import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import { createPortal } from 'react-dom';
type MermaidApi = typeof import('mermaid').default;
let mermaidApi: MermaidApi | undefined;
let mermaidLoad: Promise<MermaidApi> | undefined;

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidApi) return Promise.resolve(mermaidApi);
  mermaidLoad ??= import('mermaid').then(({ default: api }) => {
    mermaidApi = api;
    return api;
  });
  return mermaidLoad;
}

// ── 全局序列化渲染队列（防止并发 mermaid.render 互相冲突）────────────────────
let renderChain = Promise.resolve();

/**
 * 清理 mermaid 可能注入到 document.body 的残留错误元素
 * mermaid v10/v11 在解析失败时可能把 error SVG/div 注入全局 DOM
 *
 * ⚠️ 注意：不能用全局 '[id^="mermaid-"]' 查询——mermaid.render() 返回的 SVG
 * 字符串自带 id="mermaid-r{n}-{rand}" 属性，该 SVG 已通过 dangerouslySetInnerHTML
 * 放到组件 div 内。全局查询会把其他图表组件内已渲染的 SVG 一并删除，
 * 导致重新渲染一个图表时其余图表消失。
 * 正确做法：只清理 body 的直接子节点（mermaid 临时渲染容器是 body 直接子元素）。
 */
function cleanMermaidArtifacts(id?: string) {
  if (id) document.getElementById(id)?.remove();
  // 只清理 body 直接子节点中的 mermaid 临时容器（不触碰嵌套在组件内的 SVG）
  document.body.querySelectorAll(':scope > [id^="mermaid-"]').forEach((el) => el.remove());
  // 清理 mermaid 注入的全局错误 UI 元素
  document.querySelectorAll('.mermaid-error-icon, .mermaid > svg.error-icon').forEach((el) => el.remove());
}

function serializedRender(id: string, code: string): Promise<string> {
  const task = renderChain.then(async () => {
    cleanMermaidArtifacts(id);
    const mermaid = await loadMermaid();
    const { svg } = await mermaid.render(id, code);
    cleanMermaidArtifacts(id); // 渲染成功后也清理隐藏容器
    return svg;
  });
  // 任意任务失败不阻断队列
  renderChain = task.then(() => {}, () => {});
  return task;
}

// ── 初始化 mermaid（全局只初始化一次）────────────────────────────────────────
let mermaidInitialized = false;
async function ensureMermaidInit() {
  if (mermaidInitialized) return;
  const mermaid = await loadMermaid();
  mermaidInitialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontSize: 14,
    flowchart: { htmlLabels: false, curve: 'basis' },
    sequence: { actorMargin: 50 },
    securityLevel: 'loose',
  } as any); // as any: suppressErrors 在旧版本类型声明中不存在
  // 额外: 覆盖 parseError 回调，彻底阻止默认错误渲染（不同版本的 mermaid 差异较大）
  try { (mermaid as any).parseError = () => {}; } catch { /* ignore */ }
}

// ── 代码自动修复：处理 AI 常见生成错误 ───────────────────────────────────────
function sanitizeMermaidCode(raw: string): string {
  let code = raw.trim();

  // 1. 将全角括号替换为方括号，防止 flowchart 节点解析错误
  code = code.replace(/（/g, '[').replace(/）/g, ']');

  // 2. 去除 pie / gantt title 前后多余空行
  code = code.replace(/^(pie|gantt)\s*\n\s*title/m, '$1\n  title');

  // 3. sequenceDiagram 中 participant 别名规范化（去除多余引号）
  code = code.replace(/participant (\w+) as "([^"]+)"/g, 'participant $1 as $2');

  // 4. flowchart 节点文字中的中文引号替换为英文
  code = code.replace(/"/g, '"').replace(/"/g, '"');
  code = code.replace(/'/g, "'").replace(/'/g, "'");

  // 5. 移除 mermaid 代码块头尾（如果上游传入时包含 ```mermaid）
  code = code.replace(/^```mermaid\s*/i, '').replace(/\s*```$/, '');

  return code.trim();
}

// ── MermaidChart 外层（React.memo 防止流式时频繁重渲）────────────────────────
interface MermaidChartProps {
  code: string;
  isStreaming?: boolean;
}

const MermaidChart = memo(
  function MermaidChart({ code, isStreaming = false }: MermaidChartProps) {
    if (isStreaming) {
      return (
        <div className="my-4 rounded-[12px] border border-brand-border bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-brand">Mermaid 图表生成中...</span>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-3/5" />
            <div className="h-8 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-full mt-3" />
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-1/2" />
          </div>
        </div>
      );
    }
    return <MermaidRenderer code={code} />;
  },
  // 流式中忽略 code 变化，避免 skeleton 反复挂载/卸载
  (prev, next) => {
    if (prev.isStreaming && next.isStreaming) return true;
    return prev.code === next.code && prev.isStreaming === next.isStreaming;
  },
);

export default MermaidChart;

// ── Lightbox 大图模态（支持缩放）────────────────────────────────────────────
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

function MermaidLightbox({ svgHtml, onClose }: { svgHtml: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const clamp = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
  const zoomIn    = () => setScale((s) => clamp(parseFloat((s + ZOOM_STEP).toFixed(2))));
  const zoomOut   = () => setScale((s) => clamp(parseFloat((s - ZOOM_STEP).toFixed(2))));
  const zoomReset = () => setScale(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setScale((s) => clamp(parseFloat((s - e.deltaY * 0.001).toFixed(2))));
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/70 backdrop-blur-sm" onClick={onClose}>
      {/* 工具栏 */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-white/10 backdrop-blur-md border-b border-white/20 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/80 text-xs font-medium">Mermaid 图表</span>
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} disabled={scale <= ZOOM_MIN}
            className="flex items-center justify-center w-7 h-7 rounded-[6px] bg-white/15 hover:bg-white/25 text-white disabled:opacity-40 transition-colors" title="缩小">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="5" x2="19" y1="12" y2="12"/></svg>
          </button>
          <button onClick={zoomReset}
            className="min-w-[48px] h-7 px-2 rounded-[6px] bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium transition-colors" title="重置缩放">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} disabled={scale >= ZOOM_MAX}
            className="flex items-center justify-center w-7 h-7 rounded-[6px] bg-white/15 hover:bg-white/25 text-white disabled:opacity-40 transition-colors" title="放大">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          </button>
          <div className="w-px h-5 bg-white/25 mx-1" />
          <button onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-[6px] bg-white/15 hover:bg-white/25 text-white transition-colors" title="关闭 (ESC)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      {/* 图表区 */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-8 cursor-zoom-in"
        onWheel={handleWheel} onClick={(e) => e.stopPropagation()}>
        <div className="mermaid-lightbox-content bg-white rounded-[12px] p-6 shadow-2xl"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
          dangerouslySetInnerHTML={{ __html: svgHtml }} />
      </div>
    </div>,
    document.body,
  );
}

// ── 实际渲染组件（仅在非流式时挂载）────────────────────────────────────────
function MermaidRenderer({ code }: { code: string }) {
  const [svgHtml, setSvgHtml]     = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [retrying, setRetrying]   = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // 用 generation counter 取消过期的渲染（比 cancelled boolean 更可靠）
  const genRef = useRef(0);

  const doRender = useCallback(async (codeStr: string) => {
    const gen = ++genRef.current;
    setError(null);
    setRetrying(true);

    await ensureMermaidInit();
    const id = `mermaid-r${gen}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      const cleanCode = sanitizeMermaidCode(codeStr);
      if (!cleanCode) { setRetrying(false); return; }

      const svg = await serializedRender(id, cleanCode);

      if (gen !== genRef.current) return; // 已被更新的渲染取消
      setSvgHtml(svg);
      setError(null);
    } catch (err: any) {
      if (gen !== genRef.current) return;
      // 清理 mermaid 可能注入的所有残留 DOM 元素（包括错误 SVG）
      cleanMermaidArtifacts(id);
      // 截取错误信息（mermaid 错误有时很长，去掉 mermaid version 行）
      const raw = typeof err === 'string' ? err : (err?.message ?? String(err));
      const msg = raw
        .split('\n')
        .filter((l: string) => !/mermaid version/i.test(l))
        .join(' ')
        .replace(/Syntax error in text/gi, '图表语法错误')
        .slice(0, 120);
      setError(msg || 'Mermaid 图表渲染失败');
    } finally {
      if (gen === genRef.current) setRetrying(false);
    }
  }, []);

  // code 变化时触发渲染
  useEffect(() => {
    if (code.trim()) doRender(code);
  }, [code, doRender]);

  const handleRetry  = useCallback(() => doRender(code), [code, doRender]);
  const handleClose  = useCallback(() => setShowLightbox(false), []);
  const isRendered   = !!svgHtml && !error;

  // ── 错误状态 ──
  if (error && !retrying) {
    return (
      <div className="my-3 rounded-[10px] border border-red-200 bg-red-50 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-red-200">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500 shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" x2="12" y1="8" y2="12"/>
              <line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            <span className="text-xs font-medium text-red-600">图表渲染失败</span>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-red-100 hover:bg-red-200 text-red-700 text-[11px] font-medium transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
            重试渲染
          </button>
        </div>
        <pre className="px-3 py-2 text-[11px] text-red-700 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40">{code}</pre>
      </div>
    );
  }

  // ── 加载中 ──
  if (retrying || (!isRendered && !error)) {
    return (
      <div className="my-4 rounded-[12px] border border-brand-border bg-white px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-brand">
            {retrying ? '正在重试渲染...' : '图表渲染中...'}
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-4/5" />
          <div className="h-8 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-full" />
          <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  // ── 渲染成功 ──
  return (
    <>
      <div className="my-4 flex justify-center relative group">
        <div
          className="mermaid-chart-wrap rounded-[12px] border border-brand-border bg-white p-4 overflow-x-auto max-w-full"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
        {/* 操作按钮（hover 时显示） */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-white/90 border border-brand-border text-text-secondary hover:text-brand hover:border-brand text-[11px] font-medium shadow-sm transition-all"
            title="重新渲染图表"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span>重试</span>
          </button>
          <button
            onClick={() => setShowLightbox(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-white/90 border border-brand-border text-text-secondary hover:text-brand hover:border-brand text-[11px] font-medium shadow-sm transition-all"
            title="查看大图"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
            <span>大图</span>
          </button>
        </div>
      </div>
      {showLightbox && <MermaidLightbox svgHtml={svgHtml} onClose={handleClose} />}
    </>
  );
}
