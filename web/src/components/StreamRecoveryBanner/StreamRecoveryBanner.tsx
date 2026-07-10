import { RotateCcw, X, Clock, MessageCircle, Play } from 'lucide-react';
import type { StreamCheckpoint } from '../../services/streamManager';

interface StreamRecoveryBannerProps {
  checkpoint: StreamCheckpoint;
  /** 用户点击「继续生成」或「重新生成」 */
  onRegenerate: () => void;
  /** 用户点击「忽略」 */
  onDismiss: () => void;
}

/** 将毫秒时间差格式化为友好文字 */
function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

/** 内容类型 key 转中文 */
function contentTypeLabel(ct: string): string {
  const map: Record<string, string> = {
    text: '文字对话',
    image: '图片生成',
    multimodal: '多模态AI',
    webdesign: '网页设计',
    career: '求职助手',
  };
  return map[ct] ?? ct;
}

export default function StreamRecoveryBanner({
  checkpoint,
  onRegenerate,
  onDismiss,
}: StreamRecoveryBannerProps) {
  const preview =
    checkpoint.userQuery.length > 60
      ? checkpoint.userQuery.slice(0, 60) + '…'
      : checkpoint.userQuery;

  // 已生成的内容超过 100 字符，识别为「中断生成」，提供「继续生成」选项
  const hasPartialContent = checkpoint.content.length > 100;

  return (
    <div className="mx-4 mb-2 rounded-[12px] border border-brand/30 bg-brand-light/60 backdrop-blur-sm px-4 py-3 flex items-start gap-3 shadow-sm animate-fade-in">
      {/* 左侧图标 */}
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center">
        <MessageCircle size={14} className="text-brand" />
      </div>

      {/* 中间内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-brand">
            {hasPartialContent ? 'AI 回復未完成' : '有未完成的对话'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand rounded-full leading-none font-medium">
            {contentTypeLabel(checkpoint.contentType)}
          </span>
          {hasPartialContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full leading-none font-medium">
              已生成 {checkpoint.content.length} 字
            </span>
          )}
        </div>

        {/* 用户提问预览 */}
        <p className="text-xs text-text-primary leading-relaxed mb-1 break-words">{preview}</p>

        {/* 时间 + 状态说明 */}
        <div className="flex items-center gap-1 text-[10px] text-text-secondary">
          <Clock size={10} />
          <span>
            {timeAgo(checkpoint.startedAt)} 开始生成，
            {hasPartialContent
              ? '\u5df2生成部分内容但未完成'
              : 'AI 尚未开始回復'}
          </span>
        </div>
      </div>

      {/* 右侧操作按钒 */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-btn text-xs font-medium hover:opacity-90 transition-opacity"
        >
          {hasPartialContent ? (
            <>
              <Play size={11} />
              继续生成
            </>
          ) : (
            <>
              <RotateCcw size={11} />
              重新生成
            </>
          )}
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-[6px] transition-all"
          title="忽略"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
