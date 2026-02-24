import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import type { ReportItem } from '../types';

interface ReportsResponse { reports: ReportItem[]; total: number; totalPages: number }

export function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const [resolveModal, setResolveModal] = useState<{ id: string; action: 'ban' | 'warn' | 'dismiss' } | null>(null);
  const [resolution, setResolution] = useState('');
  const [detailReport, setDetailReport] = useState<ReportItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const data = await api.get<ReportsResponse>(`/admin/reports?${params}`);
      setReports(data.reports);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openResolve = (reportId: string, action: 'ban' | 'warn' | 'dismiss') => {
    const defaults: Record<string, string> = {
      ban: '经审核确认违规，已封禁用户',
      warn: '已向被举报用户发送警告',
      dismiss: '经审核未发现违规行为',
    };
    setResolution(defaults[action]);
    setResolveModal({ id: reportId, action });
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    const { id, action } = resolveModal;
    try {
      if (action === 'ban') {
        const ok = await confirm({
          title: '封禁用户',
          message: '确定封禁被举报用户？封禁后该用户将无法登录。',
          confirmText: '确认封禁',
          variant: 'danger',
        });
        if (!ok) return;
        await api.post(`/admin/reports/${id}/ban`, { resolution });
        toast.success('已封禁用户并处理举报');
      } else if (action === 'warn') {
        await api.put(`/admin/reports/${id}`, { status: 'RESOLVED', resolution });
        toast.success('举报已处理');
      } else {
        await api.put(`/admin/reports/${id}`, { status: 'DISMISSED', resolution });
        toast.success('举报已驳回');
      }
      setResolveModal(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const actionLabel: Record<string, { label: string; cls: string }> = {
    ban: { label: '封禁用户', cls: 'btn-danger' },
    warn: { label: '发送警告', cls: 'btn-warning' },
    dismiss: { label: '驳回举报', cls: 'btn-ghost' },
  };

  return (
    <div>
      <div className="page-header">
        <h1>举报审核</h1>
        <p>审核处理用户提交的举报</p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder="搜索举报人/被举报人/原因"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="PENDING">待处理</option>
          <option value="RESOLVED">已解决</option>
          <option value="DISMISSED">已驳回</option>
          <option value="REVIEWED">已审核</option>
        </select>
        <input
          className="input"
          type="date"
          style={{ maxWidth: 160 }}
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1); }}
        />
        <input
          className="input"
          type="date"
          style={{ maxWidth: 160 }}
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1); }}
        />
        <div className="spacer" />
        {(statusFilter || search || startDate || endDate) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatusFilter('');
              setSearch('');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
          >
            清空筛选
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 条举报</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</div>
        ) : reports.length === 0 ? (
          <div className="empty"><div className="icon">⚑</div><div className="title">暂无举报</div></div>
        ) : reports.map(r => (
          <div className="card" key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={r.status} />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {new Date(r.createdAt).toLocaleString('zh-CN')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>ID: {r.id.slice(-6)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Link to={`/users/${r.reporter?.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserAvatar name={r.reporter?.nickname || '?'} avatar={r.reporter?.avatar} size="sm" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.reporter?.nickname}</span>
              </Link>
              <span style={{ color: 'var(--danger)', fontSize: 12 }}>举报 →</span>
              <Link to={`/users/${r.reported?.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserAvatar name={r.reported?.nickname || '?'} avatar={r.reported?.avatar} size="sm" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.reported?.nickname}</span>
              </Link>
            </div>

            <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                举报原因: {r.reason}
              </div>
              {r.detail && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.detail}</div>}
            </div>

            {r.resolution && (
              <div style={{ padding: 10, background: 'rgba(52,211,153,.06)', borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--success)' }}>
                处理结果: {r.resolution}
              </div>
            )}

            {r.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-danger" onClick={() => openResolve(r.id, 'ban')}>封禁用户</button>
                <button className="btn btn-sm btn-warning" onClick={() => openResolve(r.id, 'warn')}>发送警告</button>
                <button className="btn btn-sm btn-ghost" onClick={() => openResolve(r.id, 'dismiss')}>驳回举报</button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailReport(r)}>查看详情</button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal
        open={!!resolveModal}
        onClose={() => setResolveModal(null)}
        title={resolveModal ? actionLabel[resolveModal.action]?.label || '处理举报' : ''}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>处理意见</label>
            <textarea
              className="input" rows={3} value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="请输入处理意见..."
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setResolveModal(null)}>取消</button>
            <button
              className={`btn ${actionLabel[resolveModal?.action || 'dismiss']?.cls || 'btn-primary'}`}
              onClick={handleResolve}
              disabled={!resolution.trim()}
            >
              {actionLabel[resolveModal?.action || 'dismiss']?.label || '确认'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detailReport}
        onClose={() => setDetailReport(null)}
        title={detailReport ? `举报详情 #${detailReport.id.slice(-6)}` : '举报详情'}
      >
        {detailReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>状态</span>
              <StatusBadge status={detailReport.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>创建时间</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(detailReport.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>举报人</span>
              {detailReport.reporter?.id ? (
                <Link to={`/users/${detailReport.reporter.id}`} style={{ fontSize: 12 }}>
                  {detailReport.reporter.nickname || detailReport.reporter.id.slice(-6)}
                </Link>
              ) : <span style={{ fontSize: 12, color: 'var(--text2)' }}>-</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>被举报人</span>
              {detailReport.reported?.id ? (
                <Link to={`/users/${detailReport.reported.id}`} style={{ fontSize: 12 }}>
                  {detailReport.reported.nickname || detailReport.reported.id.slice(-6)}
                </Link>
              ) : <span style={{ fontSize: 12, color: 'var(--text2)' }}>-</span>}
            </div>
            <div style={{ padding: 10, background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>举报原因</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{detailReport.reason || '-'}</div>
            </div>
            <div style={{ padding: 10, background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>详细说明</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{detailReport.detail || '无'}</div>
            </div>
            <div style={{ padding: 10, background: 'rgba(52,211,153,.06)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>处理结果</div>
              <div style={{ fontSize: 12, color: 'var(--success)', whiteSpace: 'pre-wrap' }}>{detailReport.resolution || '尚未处理'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
