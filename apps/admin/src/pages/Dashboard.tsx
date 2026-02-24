import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import type { DashboardData } from '../types';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const d = await api.get<DashboardData>('/admin/dashboard');
      setData(d);
      setLastUpdate(new Date());
    } catch (err: unknown) {
      if (!silent) toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  if (!data) return <div className="empty"><div className="icon">◈</div><div className="title">加载中...</div></div>;

  const { overview: o, today: t, recentUsers, trendData } = data;

  const stats = [
    { label: '总用户', value: o.totalUsers, sub: `今日 +${t.todayUsers}`, color: '#6366F1', icon: '◉' },
    { label: '活跃用户', value: o.activeUsers, sub: `封禁 ${o.bannedUsers}`, color: '#34D399', icon: '●' },
    { label: '总匹配', value: o.totalMatches, sub: `今日 +${t.todayMatches}`, color: '#EC4899', icon: '✦' },
    { label: '已接受', value: o.acceptedMatches, sub: `待处理 ${o.pendingMatches}`, color: '#A78BFA', icon: '♡' },
    { label: '对话数', value: o.totalConversations, sub: `消息 ${o.totalMessages}`, color: '#38BDF8', icon: '◎' },
    { label: '举报', value: o.totalReports, sub: `待处理 ${o.pendingReports}`, color: '#EF4444', icon: '⚑' },
  ];

  const maxVal = Math.max(...trendData.map(d => Math.max(d.users, d.matches, d.messages)), 1);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>仪表盘</h1>
          <p>LinkSoul 平台运营数据概览</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {lastUpdate && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              更新于 {lastUpdate.toLocaleTimeString('zh-CN')}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => fetchData()} disabled={refreshing}
            style={{ opacity: refreshing ? 0.5 : 1 }}>
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      <div className="grid grid-6" style={{ marginBottom: 24 }}>
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="icon" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
            <div className="value">{s.value}</div>
            <div className="label">{s.label}</div>
            <div className="sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>近7日趋势</h3></div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 150 }}>
            {trendData.map(d => (
              <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: 110 }}>
                  {[
                    { val: d.users, color: '#34D399' },
                    { val: d.matches, color: '#EC4899' },
                    { val: d.messages, color: '#6366F1' },
                  ].map((bar, i) => (
                    <div key={i} title={`${['新用户','新匹配','消息数'][i]}: ${bar.val}`} style={{
                      flex: 1, maxWidth: 8,
                      height: Math.max(2, (bar.val / maxVal) * 100),
                      background: bar.color, borderRadius: 2,
                      transition: 'height .6s ease',
                      cursor: 'default',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{d.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[
              { label: '新用户', color: '#34D399', key: 'users' as const },
              { label: '新匹配', color: '#EC4899', key: 'matches' as const },
              { label: '消息数', color: '#6366F1', key: 'messages' as const },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                {l.label}: {trendData.reduce((s, d) => s + d[l.key], 0)}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>性格测试完成率</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140 }}>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface2)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#A78BFA" strokeWidth="10"
                  strokeDasharray={`${(o.testCompletionRate / 100) * 314} 314`}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#A78BFA' }}>{o.testCompletionRate}%</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
            用户完成性格测试的比例
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>最新注册用户</h3>
          <Link to="/users" style={{ fontSize: 12 }}>查看全部 →</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>联系方式</th>
              <th>城市</th>
              <th>状态</th>
              <th>注册时间</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map(u => (
              <tr key={u.id}>
                <td>
                  <Link to={`/users/${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)' }}>
                    <UserAvatar name={u.nickname} avatar={u.avatar} size="sm" />
                    <span style={{ fontWeight: 600 }}>{u.nickname}</span>
                  </Link>
                </td>
                <td>{u.email || u.phone || '-'}</td>
                <td>{u.city || '-'}</td>
                <td><StatusBadge status={u.status} /></td>
                <td style={{ fontSize: 12 }}>{new Date(u.createdAt).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
