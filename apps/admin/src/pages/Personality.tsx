import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

const ATTACH_MAP: Record<string, { label: string; color: string; desc: string }> = {
  SECURE: { label: '安全型', color: '#34D399', desc: '信任伴侣，善于表达需求' },
  ANXIOUS: { label: '焦虑型', color: '#FBBF24', desc: '渴望亲密，担心被抛弃' },
  AVOIDANT: { label: '回避型', color: '#38BDF8', desc: '重视独立，回避亲密' },
  FEARFUL: { label: '恐惧型', color: '#EF4444', desc: '既渴望又害怕亲密关系' },
};

const COMM_MAP: Record<string, { label: string; color: string; desc: string }> = {
  DIRECT: { label: '直接型', color: '#6366F1', desc: '有话直说，注重效率' },
  INDIRECT: { label: '间接型', color: '#EC4899', desc: '委婉表达，注重氛围' },
  ANALYTICAL: { label: '分析型', color: '#38BDF8', desc: '逻辑思维，注重数据' },
  EMOTIONAL: { label: '感性型', color: '#FBBF24', desc: '情感丰富，注重感受' },
};

interface Stats {
  total: number;
  completed: number;
  completionRate: number;
  attachmentDistribution: { type: string; count: number }[];
  communicationDistribution: { type: string; count: number }[];
}

export function PersonalityPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.get<Stats>('/admin/personality-stats');
      setStats(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!stats) return <div className="empty"><div className="icon">◐</div><div className="title">加载中...</div></div>;

  const totalAttach = stats.attachmentDistribution.reduce((s, a) => s + a.count, 0);
  const totalComm = stats.communicationDistribution.reduce((s, c) => s + c.count, 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>性格测试</h1>
          <p>用户性格测试完成情况与分布统计</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchData} disabled={refreshing} style={{ marginTop: 4 }}>
          {refreshing ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="icon" style={{ background: 'rgba(99,102,241,.15)', color: '#6366F1' }}>◉</div>
          <div className="value">{stats.total}</div>
          <div className="label">总用户数</div>
        </div>
        <div className="stat-card">
          <div className="icon" style={{ background: 'rgba(52,211,153,.15)', color: '#34D399' }}>✓</div>
          <div className="value">{stats.completed}</div>
          <div className="label">已完成测试</div>
        </div>
        <div className="stat-card">
          <div className="icon" style={{ background: 'rgba(239,68,68,.15)', color: '#EF4444' }}>○</div>
          <div className="value">{stats.total - stats.completed}</div>
          <div className="label">未完成测试</div>
        </div>
        <div className="stat-card">
          <div className="icon" style={{ background: 'rgba(167,139,250,.15)', color: '#A78BFA' }}>%</div>
          <div className="value">{stats.completionRate}%</div>
          <div className="label">完成率</div>
        </div>
      </div>

      {/* Completion Bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3>完成率进度</h3></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="bar" style={{ height: 16 }}>
            <div className="bar-fill" style={{
              width: `${stats.completionRate}%`,
              background: 'linear-gradient(90deg, #6366F1, #A78BFA)',
              height: '100%',
            }} />
          </div>
          <span style={{ fontWeight: 800, color: 'var(--primary-soft)', minWidth: 50 }}>{stats.completionRate}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
          <span>已完成 {stats.completed} 人</span>
          <span>未完成 {stats.total - stats.completed} 人</span>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Attachment Distribution */}
        <div className="card">
          <div className="card-header"><h3>依恋类型分布</h3></div>
          {stats.attachmentDistribution.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>暂无数据</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(ATTACH_MAP).map(([key, info]) => {
                const item = stats.attachmentDistribution.find(a => a.type === key);
                const count = item?.count || 0;
                const pct = totalAttach > 0 ? Math.round((count / totalAttach) * 100) : 0;
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: info.color, marginRight: 8 }}>{info.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{info.desc}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{count} 人 ({pct}%)</span>
                    </div>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: info.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Communication Distribution */}
        <div className="card">
          <div className="card-header"><h3>沟通风格分布</h3></div>
          {stats.communicationDistribution.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>暂无数据</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(COMM_MAP).map(([key, info]) => {
                const item = stats.communicationDistribution.find(c => c.type === key);
                const count = item?.count || 0;
                const pct = totalComm > 0 ? Math.round((count / totalComm) * 100) : 0;
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: info.color, marginRight: 8 }}>{info.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{info.desc}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{count} 人 ({pct}%)</span>
                    </div>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: info.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
