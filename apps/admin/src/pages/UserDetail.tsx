import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import type { User, CreditLog, MatchWithPartner, ReportItem } from '../types';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const fetchUser = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<User>(`/admin/users/${id}`);
      setUser(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchUser(); }, [id]);

  const updateStatus = async (status: string) => {
    const label = status === 'BANNED' ? '封禁' : status === 'ACTIVE' ? '正常' : '注销';
    const ok = await confirm({
      title: '确认操作',
      message: `确定要将用户状态设为"${label}"吗？`,
      confirmText: label,
      variant: status === 'BANNED' ? 'danger' : status === 'DEACTIVATED' ? 'warning' : 'primary',
    });
    if (!ok) return;
    try {
      await api.put(`/admin/users/${id}/status`, { status });
      toast.success(`用户已${label}`);
      fetchUser();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const resetPwd = async () => {
    const ok = await confirm({
      title: '重置密码',
      message: '将为该用户生成随机新密码，确定继续？',
      confirmText: '重置',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      const result = await api.post<{ tempPassword: string }>(`/admin/users/${id}/reset-password`);
      toast.success(`密码已重置为: ${result.tempPassword}（请妥善保管）`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '重置失败');
    }
  };

  const deleteUser = async () => {
    const ok = await confirm({
      title: '永久删除用户',
      message: '此操作不可撤销！该用户的所有数据将被永久删除。',
      confirmText: '永久删除',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/admin/users/${id}`);
      toast.success('用户已删除');
      navigate('/users');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) return <div className="empty"><div className="icon">◈</div><div className="title">加载中...</div></div>;
  if (error) return (
    <div className="empty">
      <div className="icon">⚠</div>
      <div className="title">{error}</div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={fetchUser}>重试</button>
    </div>
  );
  if (!user) return <div className="empty"><div className="title">用户不存在</div></div>;

  const allMatches = [
    ...(user.sentMatches || []).map((m: MatchWithPartner) => ({ ...m, partner: m.userB, direction: '发起' })),
    ...(user.receivedMatches || []).map((m: MatchWithPartner) => ({ ...m, partner: m.userA, direction: '接收' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const ATTACHMENT_MAP: Record<string, string> = { SECURE: '安全型', ANXIOUS: '焦虑型', AVOIDANT: '回避型', FEARFUL: '恐惧型' };
  const COMM_MAP: Record<string, string> = { DIRECT: '直接型', INDIRECT: '间接型', ANALYTICAL: '分析型', EMOTIONAL: '感性型' };

  let tags: string[] = [];
  try { tags = JSON.parse(user.profile?.personalityTags || '[]'); } catch { /* */ }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to="/users" style={{ color: 'var(--text3)', fontSize: 13 }}>← 返回用户列表</Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <UserAvatar name={user.nickname} avatar={user.avatar} size="lg" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{user.nickname}</h2>
                <StatusBadge status={user.status} />
                {user.gender && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{user.gender === 'MALE' ? '♂ 男' : '♀ 女'}</span>}
              </div>
              <div className="grid grid-2" style={{ gap: 8 }}>
                {[
                  { l: '邮箱', v: user.email },
                  { l: '手机', v: user.phone },
                  { l: '城市', v: [user.city, user.province].filter(Boolean).join(', ') },
                  { l: '注册时间', v: new Date(user.createdAt).toLocaleString('zh-CN') },
                  { l: '最后登录', v: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '从未登录' },
                  { l: '个人简介', v: user.bio },
                ].map(item => (
                  <div key={item.l} style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)', marginRight: 8 }}>{item.l}:</span>
                    <span style={{ color: 'var(--text2)' }}>{item.v || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>管理操作</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {user.status !== 'BANNED' ? (
              <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('BANNED')}>封禁用户</button>
            ) : (
              <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('ACTIVE')}>解封用户</button>
            )}
            {user.status !== 'DEACTIVATED' && (
              <button className="btn btn-warning" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('DEACTIVATED')}>注销账号</button>
            )}
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={resetPwd}>重置密码</button>
            <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', opacity: 0.7 }} onClick={deleteUser}>永久删除</button>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>性格档案</h3>
          {user.profile?.testCompleted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, padding: 12, background: 'var(--surface2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>依恋类型</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#A78BFA' }}>
                    {ATTACHMENT_MAP[user.profile.attachmentType || ''] || user.profile.attachmentType || '-'}
                  </div>
                </div>
                <div style={{ flex: 1, padding: 12, background: 'var(--surface2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>沟通风格</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#38BDF8' }}>
                    {COMM_MAP[user.profile.communicationStyle || ''] || user.profile.communicationStyle || '-'}
                  </div>
                </div>
              </div>
              {tags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>性格标签</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tags.map((t, i) => (
                      <span key={i} style={{ padding: '3px 10px', background: 'var(--primary-dim)', color: 'var(--primary-soft)', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {user.profile.aiSummary && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>AI 分析</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{user.profile.aiSummary}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>用户尚未完成性格测试</div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>信用信息</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 10, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>{user.creditScore?.score ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>信用分</div>
            </div>
            <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 10, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{user.creditScore?.level || '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>等级</div>
            </div>
          </div>
          {(user.creditLogs?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>最近变动</div>
              {user.creditLogs!.slice(0, 5).map((log: CreditLog) => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>{log.actionType}</span>
                  <span style={{ color: log.scoreChange > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {log.scoreChange > 0 ? '+' : ''}{log.scoreChange}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>匹配记录 ({allMatches.length})</h3></div>
        {allMatches.length > 0 ? (
          <table>
            <thead>
              <tr><th>方向</th><th>对方</th><th>匹配度</th><th>状态</th><th>时间</th></tr>
            </thead>
            <tbody>
              {allMatches.slice(0, 15).map(m => (
                <tr key={m.id}>
                  <td><span className={`badge ${m.direction === '发起' ? 'badge-accepted' : 'badge-pending'}`}>{m.direction}</span></td>
                  <td>
                    {m.partner ? (
                      <Link to={`/users/${m.partner.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserAvatar name={m.partner.nickname} avatar={m.partner.avatar} size="sm" />
                        {m.partner.nickname}
                      </Link>
                    ) : '-'}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--primary-soft)' }}>{Math.round(m.score * 100)}%</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(m.createdAt).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>暂无匹配记录</div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>发出的举报 ({user.sentReports?.length || 0})</h3>
          {(user.sentReports?.length ?? 0) > 0 ? user.sentReports!.map((r: ReportItem) => (
            <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>举报 {r.reported?.nickname || '未知用户'}</span>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ color: 'var(--text3)', marginTop: 2 }}>{r.reason}</div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text3)', fontSize: 12 }}>暂无举报</div>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>收到的举报 ({user.receivedReports?.length || 0})</h3>
          {(user.receivedReports?.length ?? 0) > 0 ? user.receivedReports!.map((r: ReportItem) => (
            <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>被 {r.reporter?.nickname || '未知用户'} 举报</span>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ color: 'var(--text3)', marginTop: 2 }}>{r.reason}</div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text3)', fontSize: 12 }}>暂无举报</div>
          )}
        </div>
      </div>
    </div>
  );
}
