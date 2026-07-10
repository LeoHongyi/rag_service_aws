import { create } from 'zustand';

export type InputContentType = 'text' | 'image' | 'webdesign' | 'career' | 'multimodal';
export type PanelMode = 'article' | 'webpreview';
/** 多模态AI生成阶段 */
export type MultimodalPhase = 'idle' | 'analyzing' | 'generating' | 'imaging';

interface UiState {
  showPayModal: boolean;
  showLoginModal: boolean;
  articlePanelOpen: boolean;
  articleContent: string;
  mobileMenuOpen: boolean;
  /** 右侧面板模式：长文 or 网页预览 */
  panelMode: PanelMode;
  /** 网页预览的 HTML 内容 */
  webHtml: string;
  /** 输入框当前功能类型（跨组件共享） */
  inputContentType: InputContentType;
  /** 多模态AI当前Agent执行阶段 */
  multimodalPhase: MultimodalPhase;
  /** 多模态AI计划摘要 */
  multimodalPlanSummary: string;

  setShowPayModal: (v: boolean) => void;
  setShowLoginModal: (v: boolean) => void;
  setArticlePanel: (open: boolean, content?: string) => void;
  setMobileMenuOpen: (v: boolean) => void;
  /** 打开网页预览面板 */
  setWebPreview: (html: string) => void;
  /** 设置当前输入功能类型 */
  setInputContentType: (t: InputContentType) => void;
  /** 设置多模态AI生成阶段 */
  setMultimodalPhase: (phase: MultimodalPhase, summary?: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  showPayModal: false,
  showLoginModal: false,
  articlePanelOpen: false,
  articleContent: '',
  mobileMenuOpen: false,
  panelMode: 'article',
  webHtml: '',
  inputContentType: 'text',
  multimodalPhase: 'idle',
  multimodalPlanSummary: '',

  setShowPayModal: (v) => set({ showPayModal: v }),
  setShowLoginModal: (v) => set({ showLoginModal: v }),
  setArticlePanel: (open, content) =>
    set((s) => ({ articlePanelOpen: open, articleContent: content ?? s.articleContent, panelMode: 'article' })),
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
  setWebPreview: (html) => set({ articlePanelOpen: true, panelMode: 'webpreview', webHtml: html }),
  setInputContentType: (t) => set({ inputContentType: t }),
  setMultimodalPhase: (phase, summary) =>
    set((s) => ({ multimodalPhase: phase, multimodalPlanSummary: summary ?? s.multimodalPlanSummary })),
}));
