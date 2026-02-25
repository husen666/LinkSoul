import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import type { SystemInfo, AdminUser } from '../types';

type AvatarPoolConfig = {
  rawValue: string;
  perStyle: number;
  min: number;
  max: number;
  styles: string[];
};

type ManagedDefaultAvatarPool = {
  count: number;
  updatedAt: string | null;
  defaultCount: number;
  maxCount: number;
  styleCounts: Record<string, number>;
  preview: Array<{
    id: string;
    style: string;
    avatar: string;
  }>;
};

export function SettingsPage() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [avatarPool, setAvatarPool] = useState<AvatarPoolConfig | null>(null);
  const [defaultAvatarPool, setDefaultAvatarPool] = useState<ManagedDefaultAvatarPool | null>(null);
  const [generateAvatarCount, setGenerateAvatarCount] = useState(1000);
  const [generatingAvatars, setGeneratingAvatars] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<Record<string, string>>({});
  const [repairSummary, setRepairSummary] = useState<{
    scope: string;
    dryRun: boolean;
    scannedUsers: number;
    avatarFixed: number;
    creditScoreCreated: number;
    creditLevelFixed: number;
  } | null>(null);
  const [loadError, setLoadError] = useState('');
  const toast = useToast();
  const { confirm } = useConfirm();

  const REPAIR_SCOPE_LABEL: Record<string, string> = {
    all: '全量修复',
    avatars: '仅头像',
    credits: '积分全修复',
    'credit-create': '仅补积分记录',
    'credit-levels': '仅等级重算',
  };

  const fetchData = async () => {
    try {
      const [sys, adminList, poolConfig, managedPool] = await Promise.all([
        api.get<SystemInfo>('/admin/system'),
        api.get<AdminUser[]>('/admin/admins'),
        api.get<AvatarPoolConfig>('/admin/tools/avatar-pool-config'),
        api.get<ManagedDefaultAvatarPool>('/admin/tools/default-avatars'),
      ]);
      setSystem(sys);
      setAdmins(adminList);
      setAvatarPool(poolConfig);
      setDefaultAvatarPool(managedPool);
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

  const runRepairData = async (
    dryRun: boolean,
    scope: 'all' | 'avatars' | 'credits' | 'credit-create' | 'credit-levels' = 'all',
  ) => {
    const scopeText = REPAIR_SCOPE_LABEL[scope] || scope;
    const ok = await confirm({
      title: dryRun ? `试运行：${scopeText}` : `执行：${scopeText}`,
      message: dryRun
        ? '将扫描并统计需要修复的数据，不会写入数据库。'
        : '将按所选范围执行数据修复并写入数据库。是否继续？',
      confirmText: dryRun ? '开始试运行' : '开始修复',
      variant: dryRun ? 'primary' : 'warning',
    });
    if (!ok) return;

    setRepairing(true);
    try {
      const result = await api.post<{
        scope: string;
        dryRun: boolean;
        scannedUsers: number;
        avatarFixed: number;
        creditScoreCreated: number;
        creditLevelFixed: number;
      }>('/admin/tools/repair-data', { scope, dryRun });
      setRepairSummary(result);
      toast.success(
        dryRun
          ? `试运行完成：头像 ${result.avatarFixed}，补积分 ${result.creditScoreCreated}，重算等级 ${result.creditLevelFixed}`
          : `修复完成：头像 ${result.avatarFixed}，补积分 ${result.creditScoreCreated}，重算等级 ${result.creditLevelFixed}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '修复失败');
    } finally {
      setRepairing(false);
    }
  };

  const runGenerateDefaultAvatars = async () => {
    const count = Number(generateAvatarCount) || 1000;
    const ok = await confirm({
      title: '生成默认头像池',
      message: `将随机生成 ${count} 张默认头像并替换当前头像池，是否继续？`,
      confirmText: '开始生成',
      variant: 'warning',
    });
    if (!ok) return;
    setGeneratingAvatars(true);
    try {
      const result = await api.post<ManagedDefaultAvatarPool>(
        '/admin/tools/default-avatars/generate',
        { count },
      );
      setDefaultAvatarPool(result);
      toast.success(`默认头像池已更新，共 ${result.count} 张`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGeneratingAvatars(false);
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
          <div className="card-header">
            <h3>系统信息</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" disabled={repairing} onClick={() => runRepairData(true)}>
                {repairing ? '处理中...' : '试运行修复'}
              </button>
              <button className="btn btn-warning btn-sm" disabled={repairing} onClick={() => runRepairData(false)}>
                {repairing ? '处理中...' : '执行修复'}
              </button>
              <button className="btn btn-ghost btn-sm" disabled={repairing} onClick={() => runRepairData(false, 'avatars')}>
                仅头像
              </button>
              <button className="btn btn-ghost btn-sm" disabled={repairing} onClick={() => runRepairData(false, 'credit-create')}>
                仅补积分记录
              </button>
              <button className="btn btn-ghost btn-sm" disabled={repairing} onClick={() => runRepairData(false, 'credit-levels')}>
                仅等级重算
              </button>
            </div>
          </div>
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
            {repairSummary && (
              <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  最近一次{repairSummary.dryRun ? '试运行' : '修复'}结果
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  范围 {REPAIR_SCOPE_LABEL[repairSummary.scope] || repairSummary.scope}，
                  扫描用户 {repairSummary.scannedUsers}，头像修复 {repairSummary.avatarFixed}，补齐积分 {repairSummary.creditScoreCreated}，等级重算 {repairSummary.creditLevelFixed}
                </div>
              </div>
            )}
            {avatarPool && (
              <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  默认头像池配置
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  当前每种样式 {avatarPool.perStyle} 张（范围 {avatarPool.min}~{avatarPool.max}）
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  环境变量 AVATAR_POOL_PER_STYLE={avatarPool.rawValue || '(未设置，使用默认值)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  样式：{avatarPool.styles.join(' / ')}
                </div>
              </div>
            )}
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
          <h3>默认头像管理</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="number"
              min={1}
              max={defaultAvatarPool?.maxCount || 5000}
              value={generateAvatarCount}
              onChange={e => setGenerateAvatarCount(Number(e.target.value || 1000))}
              style={{ width: 120, height: 32 }}
              aria-label="默认头像生成数量"
            />
            <button className="btn btn-primary btn-sm" disabled={generatingAvatars} onClick={runGenerateDefaultAvatars}>
              {generatingAvatars ? '生成中...' : '随机生成头像池'}
            </button>
          </div>
        </div>
        {defaultAvatarPool ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              当前池规模 {defaultAvatarPool.count}，默认建议 {defaultAvatarPool.defaultCount}，最大 {defaultAvatarPool.maxCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              更新时间：{defaultAvatarPool.updatedAt ? new Date(defaultAvatarPool.updatedAt).toLocaleString('zh-CN') : '-'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              样式分布：{Object.entries(defaultAvatarPool.styleCounts).map(([k, v]) => `${k} ${v}`).join(' / ')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8 }}>
              {defaultAvatarPool.preview.slice(0, 20).map(item => (
                <div key={item.id} title={`${item.id} (${item.style})`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 4, background: 'var(--surface2)' }}>
                  <img src={item.avatar} alt={item.style} style={{ width: '100%', borderRadius: 6, display: 'block' }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>加载中...</div>
        )}
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
