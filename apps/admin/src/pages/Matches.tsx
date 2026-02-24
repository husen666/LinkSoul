import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useDebounce } from '../hooks/useDebounce';
import type { Match } from '../types';

const STAGE_MAP: Record<string, { label: string; color: string }> = {
  INITIAL: { label: '初始', color: 'var(--text3)' },
  GETTING_TO_KNOW: { label: '了解中', color: 'var(--info)' },
  DATING: { label: '约会中', color: 'var(--pink)' },
  COMMITTED: { label: '已确定', color: 'var(--success)' },
  ENDED: { label: '已结束', color: 'var(--danger)' },
};

interface MatchesResponse {
  matches: Match[];
  total: number;
  totalPages: number;
}

export function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toast = useToast();
  const { confirm } = useConfirm();
  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get<MatchesResponse>(`/admin/matches?${params}`);
      setMatches(data.matches);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    const label = status === 'ACCEPTED' ? '通过' : '拒绝';
    const ok = await confirm({
      title: `${label}匹配`,
      message: `确定要${label}此匹配吗？`,
      confirmText: label,
      variant: status === 'ACCEPTED' ? 'primary' : 'danger',
    });
    if (!ok) return;
    try {
      await api.put(`/admin/matches/${id}/status`, { status });
      toast.success(`已${label}匹配`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const stageInfo = (stage?: string) => {
    if (!stage) return { label: '-', color: 'var(--text3)' };
    return STAGE_MAP[stage] || { label: stage, color: 'var(--text3)' };
  };

  return (
    <div>
      <div className="page-header">
        <h1>匹配管理</h1>
        <p>管理用户之间的匹配关系</p>
      </div>

      <div className="toolbar">
        <input
          className="input" placeholder="搜索用户昵称..."
          style={{ maxWidth: 240 }}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="ACCEPTED">已匹配</option>
          <option value="PENDING">待处理</option>
          <option value="REJECTED">已拒绝</option>
          <option value="EXPIRED">已过期</option>
        </select>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 条匹配</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>用户 A</th>
              <th style={{ textAlign: 'center', width: 40 }}></th>
              <th>用户 B</th>
              <th>匹配度</th>
              <th>匹配原因</th>
              <th>对话</th>
              <th>关系阶段</th>
              <th>状态</th>
              <th>时间</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</td></tr>
            ) : matches.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>暂无数据</td></tr>
            ) : matches.map(m => {
              const si = stageInfo(m.relationship?.stage);
              const isExpanded = expandedId === m.id;
              return (
                <tr key={m.id} style={{ cursor: m.matchReason ? 'pointer' : undefined }} onClick={() => m.matchReason && setExpandedId(isExpanded ? null : m.id)}>
                  <td>
                    <Link to={`/users/${m.userA.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }} onClick={e => e.stopPropagation()}>
                      <UserAvatar name={m.userA.nickname} avatar={m.userA.avatar} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.userA.nickname}</span>
                    </Link>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--pink)', fontSize: 16 }}>♡</td>
                  <td>
                    <Link to={`/users/${m.userB.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }} onClick={e => e.stopPropagation()}>
                      <UserAvatar name={m.userB.nickname} avatar={m.userB.avatar} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.userB.nickname}</span>
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.round(m.score * 100)}%`, height: '100%', borderRadius: 2,
                          background: m.score >= 0.8 ? 'var(--success)' : m.score >= 0.6 ? 'var(--primary)' : 'var(--warning)',
                        }} />
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--primary-soft)', fontSize: 13 }}>{Math.round(m.score * 100)}%</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {m.matchReason ? (
                      <div>
                        <div style={{
                          overflow: isExpanded ? 'visible' : 'hidden',
                          textOverflow: isExpanded ? 'unset' : 'ellipsis',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          fontSize: 12, color: 'var(--text2)', lineHeight: 1.5,
                        }}>{m.matchReason}</div>
                        {!isExpanded && m.matchReason.length > 30 && (
                          <span style={{ fontSize: 10, color: 'var(--primary-soft)' }}>点击展开</span>
                        )}
                      </div>
                    ) : <span style={{ color: 'var(--text3)' }}>-</span>}
                  </td>
                  <td>
                    {m.conversation ? (
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{m.conversation._count?.messages || 0} 条</span>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>未开始</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: si.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: si.color }}>{si.label}</span>
                      {m.relationship?.progressScore != null && (
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{Math.round(m.relationship.progressScore * 100)}%</span>
                      )}
                    </div>
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(m.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    {m.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-success" onClick={() => updateStatus(m.id, 'ACCEPTED')}>通过</button>
                        <button className="btn btn-sm btn-danger" onClick={() => updateStatus(m.id, 'REJECTED')}>拒绝</button>
                      </div>
                    )}
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
