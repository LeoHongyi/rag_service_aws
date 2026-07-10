import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { X, Copy, Download, Edit3, Eye, Globe, ExternalLink, Code2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { useUiStore } from '../../stores/ui.store';
import MermaidChart from '../MermaidChart/MermaidChart';

export default function ArticlePanel({ isMobileFullscreen = false }: { isMobileFullscreen?: boolean } = {}) {
  const {
    articleContent, articlePanelOpen, setArticlePanel,
    panelMode, webHtml, setWebPreview,
  } = useUiStore();

  // 长文编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [copied, setCopied] = useState(false);

  // 网页预览 HTML 编辑状态
  const [isEditingHtml, setIsEditingHtml] = useState(false);
  const [editHtml, setEditHtml] = useState('');

  // webHtml 更新时（新网页生成）退出编辑模式
  useEffect(() => {
    setIsEditingHtml(false);
  }, [webHtml]);

  const currentContent = isEditing ? editContent : articleContent;

  // ── 长文操作 ────────────────────────────────────────────────────
  const handleToggleEdit = () => {
    if (!isEditing) setEditContent(articleContent);
    setIsEditing((v) => !v);
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentContent]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([currentContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `article-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentContent]);

  // ── 网页预览操作 ─────────────────────────────────────────────────
  const currentHtml = isEditingHtml ? editHtml : webHtml;

  const handleOpenInTab = useCallback(() => {
    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [currentHtml]);

  const handleStartEditHtml = () => {
    setEditHtml(webHtml);
    setIsEditingHtml(true);
  };

  const handleApplyHtml = () => {
    setWebPreview(editHtml);
    setIsEditingHtml(false);
  };

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webpage-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentHtml]);

  if (!articlePanelOpen) return null;

  /** 长文内容区 */
  const ContentArea = () =>
    isEditing ? (
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="flex-1 h-0 w-full resize-none outline-none text-sm text-text-primary font-mono leading-relaxed bg-transparent overflow-y-auto"
        spellCheck={false}
      />
    ) : (
      <div className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-primary prose-code:text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code({ className, children, ...props }: any) {
              const lang = /language-(\w+)/.exec(className || '')?.[1];
              const codeStr = String(children).replace(/\n$/, '');
              if (lang === 'mermaid') {
                return <MermaidChart code={codeStr} />;
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {articleContent}
        </ReactMarkdown>
      </div>
    );

  // ── 网页预览头部 ─────────────────────────────────────────────────
  const WebPreviewHeader = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border shrink-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isEditingHtml ? 'bg-orange-400' : 'bg-green-500'}`} />
        <Globe size={13} className={isEditingHtml ? 'text-orange-500' : 'text-green-600'} />
        <h3 className="text-sm font-semibold text-text-primary">
          {isEditingHtml ? '编辑代码' : '网页预览'}
        </h3>
      </div>
      <div className="flex items-center gap-1">
        {/* 编辑 / 预览 切换 */}
        <button
          onClick={isEditingHtml ? handleApplyHtml : handleStartEditHtml}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all ${
            isEditingHtml
              ? 'bg-brand text-white'
              : 'text-text-secondary hover:bg-brand-light hover:text-brand'
          }`}
          title={isEditingHtml ? '应用修改并预览' : '编辑 HTML 代码'}
        >
          {isEditingHtml
            ? <><Eye size={12} /><span className="ml-1">预览</span></>
            : <><Code2 size={12} /><span className="ml-1">编辑代码</span></>
          }
        </button>
        {!mobile && (
          <>
            <button
              onClick={handleOpenInTab}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
              title="在新标签页打开"
            >
              <ExternalLink size={12} />
              <span className="ml-1">新标签</span>
            </button>
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
              title="下载 HTML 文件"
            >
              <Download size={12} />
              <span className="ml-1">导出 HTML</span>
            </button>
          </>
        )}
        <button
          onClick={() => setArticlePanel(false)}
          className="p-1.5 rounded-[6px] text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );

  // ── 网页预览内容区 ───────────────────────────────────────────────
  const WebPreviewContent = () => (
    <div className="flex-1 overflow-hidden">
      {isEditingHtml ? (
        <CodeMirror
          value={editHtml}
          height="100%"
          extensions={[htmlLang()]}
          theme={oneDark}
          onChange={(val) => setEditHtml(val)}
          style={{ height: '100%', fontSize: '13px', overflow: 'auto' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            autocompletion: true,
            bracketMatching: true,
            indentOnInput: true,
          }}
        />
      ) : (
        <iframe
          srcDoc={webHtml}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
          title="网页预览"
        />
      )}
    </div>
  );

  // ── 移动端全屏模式 ───────────────────────────────────────────────
  if (isMobileFullscreen) {
    if (panelMode === 'webpreview') {
      return (
        <div className="fixed inset-0 z-30 bg-white flex flex-col">
          <WebPreviewHeader mobile />
          <WebPreviewContent />
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-30 bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand" />
            <h3 className="text-sm font-semibold text-text-primary">长文生成</h3>
            <span className="px-2 py-0.5 bg-brand-light text-brand text-[11px] rounded-full">
              {currentContent.length} 字
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleEdit}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all
                ${isEditing ? 'bg-brand text-white' : 'text-text-secondary hover:bg-brand-light hover:text-brand'}`}
            >
              {isEditing ? <><Eye size={12} /> 预览</> : <><Edit3 size={12} /> 编辑</>}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
            >
              <Copy size={12} />
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={() => setArticlePanel(false)}
              className="p-1.5 rounded-[6px] text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className={`flex-1 px-4 py-4 ${isEditing ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          <ContentArea />
        </div>
      </div>
    );
  }

  // ── 桌面端 ── 网页预览模式 ──────────────────────────────────────
  if (panelMode === 'webpreview') {
    return (
      <div className="w-[560px] flex flex-col border-l border-brand-border bg-white shrink-0 overflow-hidden">
        <WebPreviewHeader />
        <WebPreviewContent />
      </div>
    );
  }

  // ── 桌面端 ── 长文模式 ──────────────────────────────────────────
  return (
    <div className="w-[480px] flex flex-col border-l border-brand-border bg-white shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <h3 className="text-sm font-semibold text-text-primary">长文生成</h3>
          <span className="px-2 py-0.5 bg-brand-light text-brand text-[11px] rounded-full">
            {currentContent.length} 字
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleEdit}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all
              ${isEditing ? 'bg-brand text-white' : 'text-text-secondary hover:bg-brand-light hover:text-brand'}`}
          >
            {isEditing ? <><Eye size={12} /> 预览</> : <><Edit3 size={12} /> 编辑</>}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
          >
            <Copy size={12} />
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
          >
            <Download size={12} />
            导出
          </button>
          <button
            onClick={() => setArticlePanel(false)}
            className="p-1.5 rounded-[6px] text-text-secondary hover:bg-brand-light hover:text-brand transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className={`flex-1 px-5 py-4 ${isEditing ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
        <ContentArea />
      </div>
    </div>
  );
}
