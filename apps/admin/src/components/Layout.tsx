import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api, logout } from '../api';
import { ErrorBoundary } from './ErrorBoundary';
import type { SystemInfo, DashboardData } from '../types';

const NAV = [
  { to: '/', label: '仪表盘', icon: '◈' },
  { to: '/users', label: '用户管理', icon: '◉' },
  { to: '/matches', label: '匹配管理', icon: '✦' },
  { to: '/conversations', label: '对话监控', icon: '◎' },
  { to: '/soul-sessions', label: '心灵解脱', icon: '☯' },
  { to: '/reports', label: '举报审核', icon: '⚑', badgeKey: 'pendingReports' },
  { to: '/analytics', label: '数据分析', icon: '◆' },
  { to: '/personality', label: '性格测试', icon: '◐' },
  { to: '/op-messages', label: '运营消息', icon: '✉' },
  { to: '/audit-log', label: '审计日志', icon: '⏱' },
  { to: '/settings', label: '系统设置', icon: '⚙' },
];

export function Layout() {
  const [version, setVersion] = useState('');
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    api.get<SystemInfo>('/admin/system')
      .then(d => setVersion(d.version || ''))
      .catch(() => {});
    api.get<DashboardData>('/admin/dashboard')
      .then(d => {
        if (d.overview?.pendingReports) setBadges({ pendingReports: d.overview.pendingReports });
      })
      .catch(() => {});
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setAdminName(payload.nickname || payload.email || '管理员');
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '0 20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 200, color: '#E0E7FF', letterSpacing: 3 }}>Link</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#A78BFA' }}>Soul</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, letterSpacing: 1 }}>管理后台{version ? ` v${version}` : ''}</div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }} aria-label="主导航">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', fontSize: 13, fontWeight: 500,
                color: isActive ? '#E0E7FF' : 'var(--text2)',
                background: isActive ? 'rgba(99,102,241,.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                textDecoration: 'none', transition: 'all .15s',
              })}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badgeKey && badges[n.badgeKey] > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9, background: 'var(--danger)',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>
                  {badges[n.badgeKey]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          {adminName && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-dim)',
                color: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {adminName[0]?.toUpperCase()}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</span>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={logout}>
            退出登录
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 28, overflowY: 'auto', maxHeight: '100vh' }}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
