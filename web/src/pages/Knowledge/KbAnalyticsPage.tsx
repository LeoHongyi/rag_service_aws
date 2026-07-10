import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart2, RefreshCw, Database,
  FileText, Layers, Zap, AlertCircle,
} from 'lucide-react';
import { knowledgeApi } from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  overview: {
    totalBases: number;
    publicBases: number;
    privateBases: number;
    totalDocs: number;
    totalChunks: number;
  };
  health: {
    byStatus: { status: string; count: number }[];
    byType: { file_type: string; count: number }[];
    successRate: number;
    failedReasons: { reason: string; count: number }[];
  };
  ragUsage: {
    totalAiMsgs: number;
    ragMsgs: number;
    hitRate: number;
    trend: { date: string; total: number; rag: number }[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers / constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bar: string; dot: string }> = {
  ready:    { label: '已完成', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  failed:   { label: '失败',   bar: 'bg-red-400',    dot: 'bg-red-400' },
  indexing: { label: '索引中', bar: 'bg-amber-400',  dot: 'bg-amber-400' },
  pending:  { label: '待处理', bar: 'bg-gray-300',   dot: 'bg-gray-300' },
};

const TYPE_COLOR: Record<string, string> = {
  md: 'bg-purple-400',
  txt: 'bg-blue-400',
  docx: 'bg-sky-400',
  unknown: 'bg-gray-300',
};

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function numFmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon, title, value, sub, accentBg,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  sub?: string;
  accentBg?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${accentBg ?? 'bg-blue-50'} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-800 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

/** SVG 迷你环形进度 */
function RingProgress({ pct, color = '#7c3aed' }: { pct: number; color?: string }) {
  // r=15.9 周长 ≈ 100，可直接用百分比作 dasharray
  const circ = 100;
  return (
    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3e8ff" strokeWidth="3.2" />
      <circle
        cx="18" cy="18" r="15.9" fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeDasharray={`${Math.min(pct, 100)} ${circ - Math.min(pct, 100)}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 近 7 天 SVG 柱状趋势图 */
function TrendChart({ trend }: { trend: AnalyticsData['ragUsage']['trend'] }) {
  const days = getLast7Days();
  const trendMap = new Map(trend.map((t) => [t.date, t]));
  const chartData = days.map((date) => ({
    date,
    total: trendMap.get(date)?.total ?? 0,
    rag: trendMap.get(date)?.rag ?? 0,
    label: date.slice(5).replace('-', '/'),
  }));

  const maxVal = Math.max(...chartData.map((d) => d.total), 1);
  const VW = 420;
  const VH = 110;
  const CHART_H = 80;
  const BAR_W = 13;
  const GAP = 4;
  const GROUP_W = VW / 7;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {chartData.map((d, i) => {
        const cx = i * GROUP_W + GROUP_W / 2;
        const totalH = Math.max(d.total > 0 ? 3 : 0, (d.total / maxVal) * CHART_H);
        const ragH = Math.max(d.rag > 0 ? 3 : 0, (d.rag / maxVal) * CHART_H);
        const tx = cx - BAR_W - GAP / 2;
        const rx = cx + GAP / 2;
        return (
          <g key={d.date}>
            <rect x={tx} y={CHART_H - totalH} width={BAR_W} height={totalH} rx={3} fill="#bfdbfe" />
            <rect x={rx} y={CHART_H - ragH}   width={BAR_W} height={ragH}   rx={3} fill="#a78bfa" />
            <text x={cx} y={CHART_H + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {d.label}
            </text>
          </g>
        );
      })}
      {/* baseline */}
      <line x1={0} y1={CHART_H} x2={VW} y2={CHART_H} stroke="#e5e7eb" strokeWidth={1} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function KbAnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await (knowledgeApi as any).getAnalytics() as AnalyticsData;
      setData(res);
    } catch {
      setError('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDocs = data?.health.byStatus.reduce((s, r) => s + r.count, 0) ?? 0;
  const failedCount = data?.health.byStatus.find((s) => s.status === 'failed')?.count ?? 0;
  const readyCount  = data?.health.byStatus.find((s) => s.status === 'ready')?.count ?? 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <button
          onClick={() => navigate('/knowledge')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          title="返回知识库"
        >
          <ArrowLeft size={16} />
        </button>
        <BarChart2 size={16} className="text-blue-500" />
        <h2 className="font-semibold text-gray-800">数据分析</h2>
        <div className="flex-1" />
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* Loading placeholder */}
        {loading && !data && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" />
            <span>加载中…</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-48 text-red-400 text-sm gap-2">
            <AlertCircle size={24} />
            <span>{error}</span>
            <button onClick={load} className="mt-2 text-xs text-blue-500 hover:underline">重新加载</button>
          </div>
        )}

        {data && (
          <>
            {/* ── 资产总览 ─────────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">资产总览</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Database size={18} className="text-blue-500" />}
                  title="知识库总数"
                  value={data.overview.totalBases}
                  sub={`公共 ${data.overview.publicBases} · 私有 ${data.overview.privateBases}`}
                  accentBg="bg-blue-50"
                />
                <StatCard
                  icon={<FileText size={18} className="text-emerald-500" />}
                  title="文档总数"
                  value={data.overview.totalDocs}
                  sub={`已就绪 ${readyCount} 篇 · 失败 ${failedCount} 篇`}
                  accentBg="bg-emerald-50"
                />
                <StatCard
                  icon={<Layers size={18} className="text-violet-500" />}
                  title="分块总数"
                  value={numFmt(data.overview.totalChunks)}
                  sub="已向量化存储"
                  accentBg="bg-violet-50"
                />
                <StatCard
                  icon={<Zap size={18} className="text-amber-500" />}
                  title="索引成功率"
                  value={`${data.health.successRate}%`}
                  sub={failedCount > 0 ? `${failedCount} 篇文档失败` : '全部索引成功'}
                  accentBg="bg-amber-50"
                />
              </div>
            </section>

            {/* ── 两列：文档健康度 + RAG 使用 ─────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* 文档健康度 */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
                <p className="text-sm font-semibold text-gray-700">文档健康度</p>

                {/* 状态堆叠进度条 */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">状态分布</p>
                  <div className="flex rounded-full overflow-hidden h-2.5 bg-gray-100 mb-3">
                    {totalDocs > 0
                      ? data.health.byStatus.map((s) => (
                          <div
                            key={s.status}
                            className={`${STATUS_META[s.status]?.bar ?? 'bg-gray-200'} transition-all`}
                            style={{ width: `${(s.count / totalDocs) * 100}%` }}
                            title={`${STATUS_META[s.status]?.label ?? s.status}: ${s.count}`}
                          />
                        ))
                      : <div className="bg-gray-100 w-full" />
                    }
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {data.health.byStatus.length === 0 && (
                      <p className="text-xs text-gray-300">暂无文档</p>
                    )}
                    {data.health.byStatus.map((s) => (
                      <div key={s.status} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className={`w-2 h-2 rounded-full ${STATUS_META[s.status]?.dot ?? 'bg-gray-300'}`} />
                        {STATUS_META[s.status]?.label ?? s.status}
                        <span className="font-semibold text-gray-700">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 格式分布 */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">格式分布</p>
                  {data.health.byType.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-2">暂无数据</p>
                  )}
                  <div className="space-y-2">
                    {data.health.byType.map((t) => {
                      const pct = totalDocs > 0 ? Math.round((t.count / totalDocs) * 100) : 0;
                      return (
                        <div key={t.file_type} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-10 text-right shrink-0">.{t.file_type}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`${TYPE_COLOR[t.file_type] ?? 'bg-gray-400'} h-full rounded-full`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-7 text-right shrink-0">{pct}%</span>
                          <span className="text-xs text-gray-500 w-5 text-right shrink-0">{t.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RAG 使用分析 */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
                <p className="text-sm font-semibold text-gray-700">RAG 使用分析</p>

                {/* 命中率 */}
                <div className="flex items-center gap-5">
                  <RingProgress pct={data.ragUsage.hitRate} color="#7c3aed" />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">RAG 命中率</p>
                    <p className="text-3xl font-bold text-violet-600 leading-none">
                      {data.ragUsage.hitRate}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      RAG 对话{' '}
                      <span className="font-semibold text-gray-600">{data.ragUsage.ragMsgs}</span>
                      {' / '}
                      AI 消息总计{' '}
                      <span className="font-semibold text-gray-600">{data.ragUsage.totalAiMsgs}</span>
                    </p>
                  </div>
                </div>

                {/* 7 天趋势 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400">近 7 天趋势</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-200" />
                        AI 消息
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-400" />
                        RAG 消息
                      </span>
                    </div>
                  </div>
                  <TrendChart trend={data.ragUsage.trend} />
                </div>
              </div>
            </section>

            {/* ── 索引失败原因（有失败时才显示）─────────────────────── */}
            {data.health.failedReasons.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  索引失败原因
                </p>
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
                  <div className="space-y-3">
                    {(() => {
                      const total = data.health.failedReasons.reduce((s, r) => s + r.count, 0);
                      return data.health.failedReasons.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-600 truncate" title={r.reason}>
                            {r.reason}
                          </span>
                          <div className="w-28 bg-gray-100 rounded-full h-1.5 shrink-0">
                            <div
                              className="bg-red-400 h-1.5 rounded-full"
                              style={{ width: `${Math.round((r.count / total) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-red-500 w-5 text-right shrink-0">
                            {r.count}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </section>
            )}

            {/* ── 空状态提示 ──────────────────────────────────────────── */}
            {data.overview.totalBases === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-3">
                <Database size={40} />
                <p className="text-sm">暂无知识库数据，请先创建知识库并上传文档</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
