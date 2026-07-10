import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Globe, Lock, BookOpen, FileText, File, FolderOpen, Plus,
  Trash2, Upload, ChevronRight, Database, X, Layers, AlertTriangle, ArrowLeft, Eye, BarChart2,
} from 'lucide-react';
import { knowledgeApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

interface KnowledgeBase {
  id: number;
  user_id: number | null;
  name: string;
  description: string;
  is_public: number;
  doc_count: number;
  chunk_count: number;
  created_at: string;
}

interface KbDocument {
  id: number;
  kb_id: number;
  filename: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'indexing' | 'ready' | 'failed';
  error_msg?: string;
  chunk_count: number;
  created_at: string;
}

interface KbChunk {
  id: number;
  chunk_index: number;
  content: string;
  token_count: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocIcon({ type }: { type: string }) {
  if (type === 'docx') return <FileText size={16} className="text-blue-500 shrink-0" />;
  if (type === 'md')   return <FileText size={16} className="text-purple-500 shrink-0" />;
  return <File size={16} className="text-gray-400 shrink-0" />;
}

function StatusBadge({ status }: { status: KbDocument['status'] }) {
  const map = {
    pending: { label: '等待中', cls: 'bg-gray-100 text-gray-500' },
    indexing: { label: '索引中…', cls: 'bg-blue-100 text-blue-600 animate-pulse' },
    ready: { label: '已就绪', cls: 'bg-green-100 text-green-700' },
    failed: { label: '失败', cls: 'bg-red-100 text-red-600' },
  };
  const { label, cls } = map[status] ?? map.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

export default function KnowledgePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = (user as any)?.isAdmin === true;

  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  // delete confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'base' | 'doc';
    id: number;
    name: string;
    kbId?: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // chunk drawer
  const [chunkDrawer, setChunkDrawer] = useState<{ doc: KbDocument } | null>(null);
  const [chunks, setChunks] = useState<KbChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  // preview modal
  const [previewDoc, setPreviewDoc] = useState<KbDocument | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBases = useCallback(async () => {
    try {
      const data = await knowledgeApi.listBases() as unknown as KnowledgeBase[];
      setBases(data);
    } catch {
      // silent
    }
  }, []);

  const loadDocs = useCallback(async (kbId: number) => {
    setDocsLoading(true);
    try {
      const data = await knowledgeApi.listDocuments(kbId) as unknown as KbDocument[];
      setDocs(data);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBases();
  }, [loadBases]);

  // 首次加载后自动选中第一个知识库
  useEffect(() => {
    if (bases.length > 0 && !selectedKb) {
      setSelectedKb(bases[0]);
    }
  }, [bases, selectedKb]);
  useEffect(() => {
    if (!selectedKb) return;
    loadDocs(selectedKb.id);

    // 若有正在索引的文档，轮询刷新
    pollRef.current = setInterval(async () => {
      const data = await knowledgeApi.listDocuments(selectedKb.id) as unknown as KbDocument[];
      setDocs(data);
      const hasIndexing = data.some((d) => d.status === 'indexing' || d.status === 'pending');
      if (!hasIndexing && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        loadBases(); // 更新 chunk_count
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedKb, loadDocs, loadBases]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const kb = await knowledgeApi.createBase({
        name: newName.trim(),
        description: newDesc,
        is_public: newPublic,
      }) as unknown as KnowledgeBase;
      setBases((prev) => [kb, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewPublic(false);
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBase(id: number, name: string) {
    setDeleteConfirm({ type: 'base', id, name });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedKb || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      await knowledgeApi.uploadDocument(selectedKb.id, file);
      await loadDocs(selectedKb.id);
      // 启动轮询
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          const data = await knowledgeApi.listDocuments(selectedKb.id) as unknown as KbDocument[];
          setDocs(data);
          const hasIndexing = data.some((d) => d.status === 'indexing' || d.status === 'pending');
          if (!hasIndexing && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            loadBases();
          }
        }, 2000);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteDoc(docId: number) {
    if (!selectedKb) return;
    const doc = docs.find((d) => d.id === docId);
    setDeleteConfirm({ type: 'doc', id: docId, name: doc?.filename ?? '该文档', kbId: selectedKb.id });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (deleteConfirm.type === 'base') {
        await knowledgeApi.deleteBase(deleteConfirm.id);
        setBases((prev) => prev.filter((b) => b.id !== deleteConfirm.id));
        if (selectedKb?.id === deleteConfirm.id) setSelectedKb(null);
      } else {
        await knowledgeApi.deleteDocument(deleteConfirm.kbId!, deleteConfirm.id);
        setDocs((prev) => prev.filter((d) => d.id !== deleteConfirm.id));
        loadBases();
      }
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  async function openChunks(doc: KbDocument) {
    setChunkDrawer({ doc });
    setExpandedChunks(new Set());
    setChunksLoading(true);
    try {
      const data = await knowledgeApi.listChunks(doc.kb_id, doc.id) as unknown as KbChunk[];
      setChunks(data);
    } catch {
      setChunks([]);
    } finally {
      setChunksLoading(false);
    }
  }

  function toggleChunk(id: number) {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function openPreview(doc: KbDocument) {
    setPreviewDoc(doc);
    setPreviewContent('');
    setPreviewLoading(true);
    try {
      const data = await knowledgeApi.getPreview(doc.kb_id, doc.id) as any;
      setPreviewContent(data?.parsed_content || '（暂无预览内容）');
    } catch {
      setPreviewContent('加载预览失败，请稍后重试。');
    } finally {
      setPreviewLoading(false);
    }
  }
  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── 左侧知识库列表 ── */}
      <div className="w-72 border-r bg-white flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
              title="返回AI问答"
            >
              <ArrowLeft size={15} />
            </button>
            <Database size={16} className="text-blue-500" />
            <h2 className="font-semibold text-gray-800">知识库</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/knowledge/analytics')}
              className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-blue-500 transition"
              title="数据分析"
            >
              <BarChart2 size={13} />
              <span className="hidden sm:inline">分析</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              <Plus size={13} />新建
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {bases.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-8">暂无知识库</p>
          )}
          {bases.map((kb) => (
            <div
              key={kb.id}
              onClick={() => setSelectedKb(kb)}
              className={`group flex items-start gap-2.5 p-3 rounded-lg cursor-pointer transition ${
                selectedKb?.id === kb.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              {kb.is_public
                ? <Globe size={16} className="text-blue-400 mt-0.5 shrink-0" />
                : <Lock size={16} className="text-gray-400 mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{kb.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {kb.doc_count} 文档 · {kb.chunk_count} 块
                </p>
                {kb.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{kb.description}</p>
                )}
              </div>
              {(isAdmin || kb.user_id === (user as any)?.id) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteBase(kb.id, kb.name); }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition p-1 rounded"
                  title="删除知识库"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 右侧文档管理 ── */}
      <div className="flex-1 flex flex-col">
        {!selectedKb ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <BookOpen size={48} className="mb-3 text-gray-300" />
            <p className="text-lg font-medium">选择一个知识库查看文档</p>
            <p className="text-sm mt-1">或点击左侧「新建」创建知识库</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {selectedKb.is_public
                    ? <Globe size={14} className="text-blue-400" />
                    : <Lock size={14} className="text-gray-400" />}
                  <h3 className="font-semibold text-gray-800">{selectedKb.name}</h3>
                  <span className="text-xs text-gray-400">
                    {selectedKb.is_public ? '公共知识库' : '私有知识库'}
                  </span>
                </div>
                {selectedKb.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{selectedKb.description}</p>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
              >
                <Upload size={13} />
                {uploading ? '上传中…' : '上传文档'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {docsLoading ? (
                <div className="text-center text-gray-400 mt-8">加载中…</div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FolderOpen size={48} className="mb-2 text-gray-300" />
                  <p>暂无文档，点击右上角「上传文档」开始导入</p>
                  <p className="text-sm mt-1">支持 .txt / .md / .docx 格式，单文件最大 20MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-blue-200 transition"
                    >
                      <DocIcon type={doc.file_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatSize(doc.file_size)}
                          {doc.status === 'ready' && ` · ${doc.chunk_count} 块`}
                          {doc.error_msg && (
                            <span className="text-red-400 ml-1" title={doc.error_msg}>
                              · {doc.error_msg.slice(0, 40)}
                            </span>
                          )}
                        </p>
                      </div>
                      <StatusBadge status={doc.status} />
                      {doc.status === 'ready' && (
                        <button
                          onClick={() => openChunks(doc)}
                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition ml-1"
                          title="查看分块详情"
                        >
                          <Layers size={12} />
                          <span>分块</span>
                        </button>
                      )}
                      {doc.status === 'ready' && (
                        <button
                          onClick={() => openPreview(doc)}
                          className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 hover:bg-purple-50 px-2 py-1 rounded transition ml-1"
                          title="预览文档"
                        >
                          <Eye size={12} />
                          <span>预览</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-red-400 hover:text-red-600 transition p-1 rounded ml-1"
                        title="删除文档"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 新建知识库弹窗 ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">新建知识库</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">名称 *</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="如：产品手册、公司规章…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCreate(); }}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">描述（可选）</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="简要描述知识库内容…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPublic}
                    onChange={(e) => setNewPublic(e.target.checked)}
                    className="rounded"
                  />
                  公共知识库（所有用户可使用）
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
              >
                {creating ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 删除确认弹窗 ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  确认删除{deleteConfirm.type === 'base' ? '知识库' : '文档'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  将删除 <span className="font-medium text-gray-800">「{deleteConfirm.name}」</span>
                  {deleteConfirm.type === 'base' && '，包括其中所有文档和分块数据。此操作不可恢复。'}
                  {deleteConfirm.type === 'doc' && '，包括文档所有分块。此操作不可恢复。'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {deleting && <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 分块详情抽屉 ── */}
      {chunkDrawer && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className="bg-white h-full w-full max-w-xl flex flex-col shadow-2xl">
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Layers size={16} className="text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{chunkDrawer.doc.filename}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {chunksLoading ? '加载中…' : `共 ${chunks.length} 个分块`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChunkDrawer(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
            {/* 分块列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chunksLoading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中…</div>
              ) : chunks.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">暂无分块数据</div>
              ) : (
                chunks.map((chunk) => {
                  const isExpanded = expandedChunks.has(chunk.id);
                  const preview = chunk.content.slice(0, 150);
                  const hasMore = chunk.content.length > 150;
                  return (
                    <div key={chunk.id} className="border rounded-xl p-3.5 bg-gray-50 hover:bg-white transition">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          # {chunk.chunk_index + 1}
                        </span>
                        <span className="text-xs text-gray-400">{chunk.token_count} 字</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {isExpanded ? chunk.content : preview}
                        {!isExpanded && hasMore && <span className="text-gray-400">…</span>}
                      </p>
                      {hasMore && (
                        <button
                          onClick={() => toggleChunk(chunk.id)}
                          className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        >
                          <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          {isExpanded ? '收起' : '展开全部'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── 文档预览全屏 Modal ── */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          {/* 头部 */}
          <div className="flex items-center gap-3 px-6 py-4 border-b bg-white shrink-0 shadow-sm">
            <DocIcon type={previewDoc.file_type} />
            <span className="font-semibold text-gray-800 flex-1 truncate text-sm">{previewDoc.filename}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500 uppercase shrink-0">
              {previewDoc.file_type}
            </span>
            <button
              onClick={() => setPreviewDoc(null)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 ml-2 shrink-0"
              title="关闭预览"
            >
              <X size={16} />
            </button>
          </div>
          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-4xl mx-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中…</div>
              ) : previewDoc.file_type === 'md' ? (
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed">{previewContent}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
