import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useDebounce } from '../hooks/useDebounce';
import { downloadCSV } from '../utils/export';
import type { User } from '../types';

interface UsersResponse {
  users: User[];
  total: number;
  totalPages: number;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();
  const debouncedSearch = useDebounce(search);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get<UsersResponse>(`/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleBan = async (id: string, nickname: string, current: string) => {
    const isBan = current !== 'BANNED';
    const ok = await confirm({
      title: isBan ? '封禁用户' : '解封用户',
      message: isBan ? `确定要封禁用户"${nickname}"吗？封禁后该用户将无法登录。` : `确定要解封用户"${nickname}"吗？`,
      confirmText: isBan ? '封禁' : '解封',
      variant: isBan ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      await api.put(`/admin/users/${id}/status`, { status: isBan ? 'BANNED' : 'ACTIVE' });
      toast.success(isBan ? '已封禁用户' : '已解封用户');
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const allUsers = await api.get<User[]>('/admin/export/users');
      downloadCSV(
        `linksoul-users-all-${new Date().toISOString().slice(0, 10)}.csv`,
        ['昵称', '邮箱', '手机', '性别', '城市', '信用分', '匹配数', '消息数', '状态', '注册时间'],
        allUsers.map(u => [
          u.nickname, u.email || '', u.phone || '',
          u.gender === 'MALE' ? '男' : u.gender === 'FEMALE' ? '女' : '-',
          u.city || '', String(u.creditScore?.score ?? 0),
          String((u._count?.sentMatches || 0) + (u._count?.receivedMatches || 0)),
          String(u._count?.messages || 0), u.status,
          new Date(u.createdAt).toLocaleString('zh-CN'),
        ]),
      );
      toast.success(`已导出全部 ${allUsers.length} 名用户`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>用户管理</h1>
        <p>管理平台所有注册用户</p>
      </div>

      <div className="toolbar">
        <input
          className="input" placeholder="搜索昵称、邮箱、手机号..."
          style={{ maxWidth: 280 }}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input" style={{ maxWidth: 140 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="ACTIVE">正常</option>
          <option value="BANNED">封禁</option>
          <option value="INACTIVE">未激活</option>
          <option value="DEACTIVATED">已注销</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={exportAll} disabled={exporting}>
          {exporting ? '导出中...' : '导出全部 CSV'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 名用户</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>联系方式</th>
              <th>城市</th>
              <th>信用分</th>
              <th>匹配数</th>
              <th>消息数</th>
              <th>性格测试</th>
              <th>状态</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>暂无数据</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserAvatar name={u.nickname} avatar={u.avatar} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{u.nickname}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {u.gender === 'MALE' ? '♂' : u.gender === 'FEMALE' ? '♀' : '-'}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>{u.email || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.phone || ''}</div>
                </td>
                <td>{u.city || '-'}</td>
                <td>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{u.creditScore?.score ?? '-'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>{u.creditScore?.level}</span>
                </td>
                <td>{(u._count?.sentMatches || 0) + (u._count?.receivedMatches || 0)}</td>
                <td>{u._count?.messages || 0}</td>
                <td>
                  {u.profile?.testCompleted ? (
                    <span className="badge badge-active">已完成</span>
                  ) : (
                    <span className="badge badge-inactive">未完成</span>
                  )}
                </td>
                <td><StatusBadge status={u.status} /></td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Link to={`/users/${u.id}`} className="btn btn-ghost btn-sm">详情</Link>
                    <button
                      className={`btn btn-sm ${u.status === 'BANNED' ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => toggleBan(u.id, u.nickname, u.status)}
                    >
                      {u.status === 'BANNED' ? '解封' : '封禁'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
