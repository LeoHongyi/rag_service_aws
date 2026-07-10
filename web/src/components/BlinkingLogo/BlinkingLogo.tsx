/**
 * BlinkingLogo —— 高性能眨眼卡通 Logo
 *
 * 动画分层：
 *  1. 最外层 wrapper：animate-float 轻盈上下浮动（3s 循环）
 *  2. 底层 img：ca1（睁眼）常显
 *  3. 叠加层 img：ca2（闭眼）animate-blink 自然双眨眼（5s 循环）
 *
 * 全部依赖 CSS opacity + transform 动画，零 JS 定时器。
 */

interface Props {
  /** 显示尺寸（正方形），默认 100px */
  size?: number;
  className?: string;
}

export default function BlinkingLogo({ size = 100, className = '' }: Props) {
  return (
    <div
      className={`animate-float select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 内层相对定位容器 */}
      <div className="relative w-full h-full" aria-label="AI 助手 Logo">
        {/* 底层：睁眼（常显） */}
        <img
          src="/ca/ca1.png"
          alt="AI 助手"
          draggable={false}
          width={size}
          height={size}
          className="w-full h-full object-contain"
        />
        {/* 叠加层：闭眼（双眨眼动画） */}
        <img
          src="/ca/ca2.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          width={size}
          height={size}
          className="w-full h-full object-contain absolute inset-0 animate-blink"
          style={{ opacity: 0 }}
        />
      </div>
    </div>
  );
}
