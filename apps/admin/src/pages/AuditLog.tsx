import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { downloadCSV } from '../utils/export';
import type { AuditLog } from '../types';

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  UPDATE_USER_STATUS: { label: '用户状态变更', color: '#FBBF24' },
  DELETE_USER: { label: '删除用户', color: '#EF4444' },
  RESET_PASSWORD: { label: '重置密码', color: '#38BDF8' },
  UPDATE_MATCH_STATUS: { label: '匹配状态变更', color: '#A78BFA' },
  UPDATE_REPORT: { label: '处理举报', color: '#34D399' },
  REPORT_BAN: { label: '举报封禁', color: '#EF4444' },
  CREATE_ADMIN: { label: '创建管理员', color: '#A78BFA' },
  TAKE_SOUL_SESSION: { label: '接管心灵会话', color: '#38BDF8' },
  CLOSE_SOUL_SESSION: { label: '关闭心灵会话', color: '#64748B' },
  CREATE_OP_MESSAGE: { label: '创建运营消息', color: '#34D399' },
  UPDATE_OP_MESSAGE: { label: '更新运营消息', color: '#38BDF8' },
  DELETE_OP_MESSAGE: { label: '删除运营消息', color: '#EF4444' },
  SEND_SOUL_MESSAGE: { label: '发送会话消息', color: '#22C55E' },
  CHANGE_PASSWORD: { label: '修改密码', color: '#6366F1' },
  DELETE_ADMIN: { label: '撤销管理员', color: '#F97316' },
  ADMIN_LOGIN_SUCCESS: { label: '后台登录成功', color: '#22C55E' },
  ADMIN_LOGIN_DENIED: { label: '后台登录拒绝', color: '#F59E0B' },
  ADMIN_LOGIN_FAILED: { label: '后台登录失败', color: '#EF4444' },
};

interface AuditLogsResponse { logs: AuditLog[]; total: number; totalPages?: number }

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (actionFilter) params.set('action', actionFilter);
      if (adminSearch.trim()) params.set('adminSearch', adminSearch.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const data = await api.get<AuditLogsResponse>(`/admin/audit-logs?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total);
      setTotalPages(data.totalPages || 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, adminSearch, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const actionInfo = (action: string) => ACTION_MAP[action] || { label: action, color: '#64748B' };

  const exportLogs = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (adminSearch.trim()) params.set('adminSearch', adminSearch.trim());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    api.get<{ logs: AuditLog[] }>(`/admin/audit-logs/export?${params.toString()}`)
      .then((data) => {
        const exportRows = data.logs || [];
        if (exportRows.length === 0) {
          toast.error('当前筛选下无可导出日志');
          return;
        }
        downloadCSV(
          `linksoul-audit-${new Date().toISOString().slice(0, 10)}.csv`,
          ['时间', '管理员', '操作', '目标类型', '目标ID', '详情'],
          exportRows.map(l => [
            new Date(l.createdAt).toLocaleString('zh-CN'),
            l.admin?.nickname || l.adminId,
            actionInfo(l.action).label,
            l.target || '',
            l.targetId || '',
            l.detail || '',
          ]),
        );
        toast.success(`审计日志已导出（${exportRows.length} 条）`);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : '导出失败');
      });
  };

  return (
    <div>
      <div className="page-header">
        <h1>审计日志</h1>
        <p>记录管理员的所有操作，便于追溯和审计</p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 200 }}
          value={adminSearch}
          onChange={(e) => { setAdminSearch(e.target.value); setPage(1); }}
          placeholder="搜索管理员昵称"
        />
        <select className="input" style={{ maxWidth: 200 }} value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}>
          <option value="">全部操作</option>
          {Object.entries(ACTION_MAP).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          style={{ maxWidth: 160 }}
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          title="开始日期"
        />
        <input
          className="input"
          type="date"
          style={{ maxWidth: 160 }}
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          title="结束日期"
        />
        <div className="spacer" />
        {(actionFilter || adminSearch || startDate || endDate) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setActionFilter(''); setAdminSearch(''); setStartDate(''); setEndDate(''); setPage(1); }}
          >
            清空筛选
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={exportLogs} disabled={logs.length === 0}>导出 CSV</button>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 条记录</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>管理员</th>
              <th>操作</th>
              <th>目标</th>
              <th>详情</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>暂无操作记录</td></tr>
            ) : logs.map(log => {
              const ai = actionInfo(log.action);
              const isExpanded = expandedId === log.id;
              return (
                <tr key={log.id} style={{ cursor: log.detail ? 'pointer' : undefined }} onClick={() => log.detail && setExpandedId(isExpanded ? null : log.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserAvatar name={log.admin?.nickname || '?'} avatar={log.admin?.avatar} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{log.admin?.nickname || log.adminId?.slice(-6)}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: `${ai.color}1A`, color: ai.color,
                    }}>
                      {ai.label}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {log.target ? (
                      <span>
                        <span style={{ color: 'var(--text3)', marginRight: 4 }}>{log.target}:</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.targetId?.slice(-8) || '-'}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 280 }}>
                    <div style={{
                      overflow: isExpanded ? 'visible' : 'hidden',
                      textOverflow: isExpanded ? 'unset' : 'ellipsis',
                      whiteSpace: isExpanded ? 'normal' : 'nowrap',
                      lineHeight: 1.5,
                    }}>
                      {log.detail || '-'}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
