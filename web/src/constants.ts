// API 基础配置
// 开发环境未设置 VITE_API_URL 时回退 localhost:3000
// 生产环境未设置 VITE_API_URL 时使用空字符串（同源相对路径，Nginx 代理）
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

// AI 模式
export const CHAT_MODES = [
  { key: 'fast',   label: '极速', icon: '⚡', desc: '快速响应，适合日常问答' },
  { key: 'think',  label: '思考', icon: '🧠', desc: '深度推理，展示思维过程' },
  { key: 'expert', label: '专家', icon: '🎓', desc: '专业回答，包含技术细节' },
] as const;

export type ChatMode = 'fast' | 'think' | 'expert';

// 内容类型
export const CONTENT_TYPES = ['text', 'image', 'audio', 'video', 'file'] as const;

// 触发长文模式的字符数阈值
export const ARTICLE_THRESHOLD = 500;

// 套餐配置（与后端对应）
export const PLANS = [
  {
    key: 'experience',
    name: '体验券',
    price: '¥9.9',
    period: '',
    tokens: '5万 Tokens',
    color: '#165DFF',
    features: ['5万 Tokens 额度', '免费生成 4 张 AI 图片', '体验全部内置 AI 模型', '永久有效（用完为止）', '支持豆包 / Kimi / DeepSeek 等'],
  },
  {
    key: 'source',
    name: '整套源码',
    price: '¥499',
    period: '',
    tokens: '完整方案',
    color: '#8B5CF6',
    recommended: true,
    features: ['完整前后端源码', '一键部署脚本', '技术架构 + 接入文档', '专属 VIP 学习交流群'],
  },
];
