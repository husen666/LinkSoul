import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import type { SystemInfo, AdminUser } from '../types';

export function SettingsPage() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const toast = useToast();
  const { confirm } = useConfirm();

  const fetchData = async () => {
    try {
      const [sys, adminList] = await Promise.all([
        api.get<SystemInfo>('/admin/system'),
        api.get<AdminUser[]>('/admin/admins'),
      ]);
      setSystem(sys);
      setAdmins(adminList);
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : '加载失败');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const checkService = async (serviceKey: string) => {
    setServiceStatus(p => ({ ...p, [serviceKey]: 'checking' }));
    try {
      const result = await api.post<{ status: string }>('/admin/health-check', { serviceKey });
      setServiceStatus(p => ({ ...p, [serviceKey]: result.status }));
    } catch {
      setServiceStatus(p => ({ ...p, [serviceKey]: 'offline' }));
    }
  };

  const checkAllServices = () => {
    if (!system) return;
    for (const svc of system.services) {
      checkService(svc.key || svc.url);
    }
  };

  const handleCreateAdmin = async () => {
    if (!form.email || !form.password || !form.nickname) return;
    if (form.password.length < 6) { toast.error('密码至少 6 位'); return; }
    setSaving(true);
    try {
      await api.post('/admin/admins', form);
      toast.success('管理员创建成功');
      setShowAddAdmin(false);
      setForm({ email: '', password: '', nickname: '' });
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword) return;
    if (pwdForm.newPassword.length < 6) { toast.error('新密码至少 6 位'); return; }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) { toast.error('两次输入的新密码不一致'); return; }
    setSaving(true);
    try {
      await api.post('/admin/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success('密码修改成功');
      setShowChangePwd(false);
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    const ok = await confirm({
      title: '撤销管理员权限',
      message: `确定撤销"${admin.nickname}"的管理员权限吗？该账号将变为普通用户。`,
      confirmText: '确定',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/admin/admins/${admin.id}`);
      toast.success('管理员权限已撤销');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  if (loadError) return (
    <div className="empty">
      <div className="icon">⚠</div>
      <div className="title">{loadError}</div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={fetchData}>重试</button>
    </div>
  );

  if (!system) return <div className="empty"><div className="icon">⚙</div><div className="title">加载中...</div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>系统设置</h1>
        <p>管理系统配置、管理员账号和服务状态</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>系统信息</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { l: '系统版本', v: `v${system.version}` },
              { l: '数据库', v: system.database },
              { l: '用户总数', v: String(system.userCount) },
              { l: '管理员数', v: String(system.adminCount) },
              { l: '匹配总数', v: String(system.matchCount) },
              { l: '消息总数', v: String(system.messageCount) },
              { l: '举报总数', v: String(system.reportCount) },
            ].map(item => (
              <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.l}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>服务状态</h3>
            <button className="btn btn-ghost btn-sm" onClick={checkAllServices}>全部检测</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {system.services.map(svc => {
              const serviceKey = svc.key || svc.url;
              const status = serviceStatus[serviceKey] || svc.status;
              return (
                <div key={svc.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 12, background: 'var(--surface2)', borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{svc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{svc.url}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: status === 'running' ? 'var(--success)' : status === 'checking' ? 'var(--warning)' : 'var(--text3)',
                    }} />
                    <span style={{ fontSize: 12, color: status === 'running' ? 'var(--success)' : status === 'checking' ? 'var(--warning)' : 'var(--text3)' }}>
                      {status === 'running' ? '运行中' : status === 'checking' ? '检测中...' : status === 'offline' ? '离线' : '未知'}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => checkService(serviceKey)}>检测</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>管理员账号</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowChangePwd(true)}>修改密码</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddAdmin(true)}>+ 添加管理员</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>昵称</th>
              <th>邮箱</th>
              <th>手机</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>最后登录</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id}>
                <td style={{ fontWeight: 700, color: 'var(--text)' }}>{admin.nickname}</td>
                <td>{admin.email || '-'}</td>
                <td>{admin.phone || '-'}</td>
                <td>
                  <span className={`badge ${admin.status === 'ACTIVE' ? 'badge-active' : 'badge-banned'}`}>
                    {admin.status === 'ACTIVE' ? '正常' : '禁用'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(admin.createdAt).toLocaleString('zh-CN')}</td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('zh-CN') : '从未登录'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {admins.length > 1 && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteAdmin(admin)}>
                      撤销权限
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showAddAdmin} onClose={() => setShowAddAdmin(false)} title="添加管理员">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>昵称</label>
            <input className="input" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="管理员昵称" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>邮箱</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>密码</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="至少 6 位" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowAddAdmin(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreateAdmin} disabled={saving || !form.email || !form.password || !form.nickname}>
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showChangePwd} onClose={() => setShowChangePwd(false)} title="修改密码">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>当前密码</label>
            <input className="input" type="password" value={pwdForm.currentPassword}
              onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} placeholder="请输入当前密码" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>新密码</label>
            <input className="input" type="password" value={pwdForm.newPassword}
              onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} placeholder="至少 6 位" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>确认新密码</label>
            <input className="input" type="password" value={pwdForm.confirmPassword}
              onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} placeholder="再次输入新密码" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowChangePwd(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleChangePassword}
              disabled={saving || !pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword}>
              {saving ? '修改中...' : '修改密码'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
