import { useEffect, useState } from 'react';
import { api } from '../api';
import { downloadCSV } from '../utils/export';
import { useToast } from '../components/Toast';
import type { AnalyticsData } from '../types';

const GENDER_MAP: Record<string, string> = { MALE: '男', FEMALE: '女', OTHER: '其他', UNKNOWN: '未设置' };
const STATUS_MAP: Record<string, string> = { ACTIVE: '正常', BANNED: '封禁', INACTIVE: '未激活', DEACTIVATED: '注销' };
const MATCH_MAP: Record<string, string> = { ACCEPTED: '已匹配', PENDING: '待处理', REJECTED: '已拒绝', EXPIRED: '已过期' };

const COLORS = ['#6366F1', '#EC4899', '#34D399', '#FBBF24', '#38BDF8', '#A78BFA', '#EF4444', '#F97316'];

function BarChart({ data, maxVal }: { data: { label: string; value: number; color: string }[]; maxVal: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 60, fontSize: 12, color: 'var(--text2)', textAlign: 'right', flexShrink: 0 }}>{d.label}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%`, background: d.color }} />
          </div>
          <span style={{ width: 40, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>暂无数据</div>;

  let offset = 0;
  const segments = data.map(d => {
    const pct = (d.value / total) * 100;
    const seg = { ...d, pct, offset };
    offset += pct;
    return seg;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 100 100" style={{ width: 120, height: 120, flexShrink: 0 }}>
        {segments.map((s, i) => {
          const r = 40;
          const circ = 2 * Math.PI * r;
          return (
            <circle key={i} cx="50" cy="50" r={r} fill="none"
              stroke={s.color} strokeWidth="18"
              strokeDasharray={`${(s.pct / 100) * circ} ${circ}`}
              strokeDashoffset={`${-(s.offset / 100) * circ}`}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text2)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', marginLeft: 'auto' }}>
              {s.value} ({Math.round(s.pct)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [switching, setSwitching] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setSwitching(true);
    api.get<AnalyticsData>(`/admin/analytics?days=${days}`)
      .then(setData)
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setSwitching(false));
  }, [days]);

  const exportData = () => {
    if (!data) return;
    downloadCSV(
      `linksoul-analytics-${days}days-${new Date().toISOString().slice(0, 10)}.csv`,
      ['日期', '新用户', '新匹配', '新消息', '新举报'],
      data.dailyData.map(d => [d.date, String(d.newUsers), String(d.newMatches), String(d.newMessages), String(d.newReports)]),
    );
    toast.success('数据已导出');
  };

  if (!data && !switching) return <div className="empty"><div className="icon">◆</div><div className="title">加载中...</div></div>;

  const dailyMax = data ? Math.max(...data.dailyData.map(d => Math.max(d.newUsers, d.newMatches, d.newMessages)), 1) : 1;
  const cityMax = data ? Math.max(...data.cityDistribution.map(c => c.count), 1) : 1;

  return (
    <div>
      <div className="page-header">
        <h1>数据分析</h1>
        <p>平台运营数据可视化分析</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          {[7, 14, 30].map(d => (
            <button key={d} className={`tab ${days === d ? 'active' : ''}`} onClick={() => setDays(d)} disabled={switching}>
              近 {d} 天
            </button>
          ))}
        </div>
        <div className="spacer" />
        {switching && <span style={{ fontSize: 12, color: 'var(--text3)' }}>加载中...</span>}
        <button className="btn btn-ghost btn-sm" onClick={exportData} disabled={!data}>导出 CSV</button>
      </div>

      {data && (
        <>
          <div className="card" style={{ marginBottom: 20, opacity: switching ? 0.5 : 1, transition: 'opacity .2s' }}>
            <div className="card-header"><h3>增长趋势</h3></div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 180, padding: '0 8px' }}>
              {data.dailyData.map(d => (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: 140 }}>
                    {[
                      { val: d.newUsers, color: '#34D399', label: '新用户' },
                      { val: d.newMatches, color: '#EC4899', label: '新匹配' },
                      { val: d.newMessages, color: '#6366F1', label: '新消息' },
                    ].map((bar, i) => (
                      <div key={i} title={`${bar.label}: ${bar.val}`} style={{
                        flex: 1, maxWidth: 8,
                        height: Math.max(2, (bar.val / dailyMax) * 130),
                        background: bar.color, borderRadius: 2,
                        transition: 'height .6s ease',
                        cursor: 'default',
                      }} />
                    ))}
                  </div>
                  {data.dailyData.length <= 14 && (
                    <div style={{ fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{d.label}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 16, justifyContent: 'center' }}>
              {[
                { label: '新用户', color: '#34D399', key: 'newUsers' as const },
                { label: '新匹配', color: '#EC4899', key: 'newMatches' as const },
                { label: '新消息', color: '#6366F1', key: 'newMessages' as const },
                { label: '举报', color: '#EF4444', key: 'newReports' as const },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  {l.label}: {data.dailyData.reduce((s, d) => s + d[l.key], 0)}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="card-header"><h3>性别分布</h3></div>
              <PieChart data={data.genderDistribution.map((g, i) => ({
                label: GENDER_MAP[g.type] || g.type, value: g.count, color: COLORS[i % COLORS.length],
              }))} />
            </div>
            <div className="card">
              <div className="card-header"><h3>用户状态分布</h3></div>
              <PieChart data={data.statusDistribution.map((s, i) => ({
                label: STATUS_MAP[s.type] || s.type, value: s.count, color: COLORS[i % COLORS.length],
              }))} />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-header"><h3>匹配状态分布</h3></div>
              <PieChart data={data.matchStatusDistribution.map((m, i) => ({
                label: MATCH_MAP[m.type] || m.type, value: m.count, color: COLORS[i % COLORS.length],
              }))} />
            </div>
            <div className="card">
              <div className="card-header"><h3>城市分布 TOP 10</h3></div>
              <BarChart
                data={data.cityDistribution.map((c, i) => ({
                  label: c.city, value: c.count, color: COLORS[i % COLORS.length],
                }))}
                maxVal={cityMax}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
