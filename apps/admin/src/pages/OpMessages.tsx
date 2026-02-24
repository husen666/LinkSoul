import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import type { OpMessage } from '../types';

const CATEGORIES = ['推荐', '发现', '活动', '公告', '系统'];

interface OpMsgResponse { messages: OpMessage[]; total: number; totalPages: number }
const DRAFT_KEY = 'admin_op_message_draft_v1';
const DEFAULT_FORM = { title: '', content: '', category: '推荐', imageUrl: '', linkUrl: '', priority: 0 };

export function OpMessagesPage() {
  const [messages, setMessages] = useState<OpMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editMsg, setEditMsg] = useState<OpMessage | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (categoryFilter) params.set('category', categoryFilter);
      const data = await api.get<OpMsgResponse>(`/admin/op-messages?${params}`);
      setMessages(data.messages);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!showModal || editMsg) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // ignore localStorage errors
    }
  }, [showModal, editMsg, form]);

  const openCreate = () => {
    setEditMsg(null);
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft) as Partial<typeof DEFAULT_FORM>;
        setForm({
          ...DEFAULT_FORM,
          ...parsed,
          priority: Number.isFinite(Number(parsed.priority)) ? Number(parsed.priority) : 0,
        });
      } else {
        setForm(DEFAULT_FORM);
      }
    } catch {
      setForm(DEFAULT_FORM);
    }
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (msg: OpMessage) => {
    setEditMsg(msg);
    setForm({
      title: msg.title, content: msg.content, category: msg.category,
      imageUrl: msg.imageUrl || '', linkUrl: msg.linkUrl || '', priority: msg.priority || 0,
    });
    setFormError('');
    setShowModal(true);
  };

  const isValidHttpUrl = (url: string) => /^https?:\/\/.+/i.test(url);
  const validateForm = () => {
    if (!form.title.trim()) return '标题不能为空';
    if (form.title.trim().length > 60) return '标题不能超过 60 字';
    if (!form.content.trim()) return '内容不能为空';
    if (form.content.trim().length > 1000) return '内容不能超过 1000 字';
    if (form.imageUrl.trim() && !isValidHttpUrl(form.imageUrl.trim())) return '图片 URL 格式不正确';
    if (form.linkUrl.trim() && !isValidHttpUrl(form.linkUrl.trim())) return '链接 URL 格式不正确';
    if (!Number.isFinite(form.priority) || form.priority < 0 || form.priority > 999) return '优先级需在 0~999';
    return '';
  };

  const handleSave = async () => {
    const errMsg = validateForm();
    setFormError(errMsg);
    if (errMsg) return;
    setSaving(true);
    try {
      if (editMsg) {
        await api.put(`/admin/op-messages/${editMsg.id}`, {
          ...form,
          title: form.title.trim(),
          content: form.content.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          linkUrl: form.linkUrl.trim() || undefined,
        });
        toast.success('消息已更新');
      } else {
        await api.post('/admin/op-messages', {
          ...form,
          title: form.title.trim(),
          content: form.content.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          linkUrl: form.linkUrl.trim() || undefined,
        });
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        toast.success('消息已创建');
      }
      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: '删除运营消息',
      message: `确定要删除"${title}"吗？此操作不可撤销。`,
      confirmText: '删除',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/admin/op-messages/${id}`);
      toast.success('消息已删除');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const toggleStatus = async (msg: OpMessage) => {
    const next = msg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/admin/op-messages/${msg.id}`, { status: next });
      toast.success(next === 'ACTIVE' ? '消息已上线' : '消息已下线');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const CAT_COLORS: Record<string, string> = {
    '推荐': '#6366F1', '发现': '#EC4899', '活动': '#FBBF24', '公告': '#34D399', '系统': '#38BDF8',
  };

  return (
    <div>
      <div className="page-header">
        <h1>运营消息</h1>
        <p>管理移动端的推荐、发现和活动等运营消息</p>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={openCreate}>+ 创建消息</button>
        <select
          className="input"
          style={{ maxWidth: 140 }}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">全部分类</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 条消息</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</div>
        ) : messages.length === 0 ? (
          <div className="empty">
            <div className="icon">✉</div>
            <div className="title">暂无运营消息</div>
            <div className="desc">点击"创建消息"添加第一条运营消息</div>
          </div>
        ) : messages.map(msg => (
          <div className="card" key={msg.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: `${CAT_COLORS[msg.category] || '#666'}20`, color: CAT_COLORS[msg.category] || '#666',
                }}>
                  {msg.category}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{msg.title}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                  background: msg.status === 'ACTIVE' ? 'rgba(52,211,153,.12)' : 'rgba(255,255,255,.06)',
                  color: msg.status === 'ACTIVE' ? 'var(--success)' : 'var(--text3)',
                }}>
                  {msg.status === 'ACTIVE' ? '上线' : '下线'}
                </span>
                {msg.priority > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--warning)' }}>优先级: {msg.priority}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4, lineHeight: 1.5 }}>{msg.content}</div>
              {msg.linkUrl && (
                <div style={{ fontSize: 11, color: 'var(--primary-soft)' }}>链接: {msg.linkUrl}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                创建于 {new Date(msg.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(msg)}>
                {msg.status === 'ACTIVE' ? '下线' : '上线'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(msg)}>编辑</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(msg.id, msg.title)}>删除</button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editMsg ? '编辑消息' : '创建消息'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>分类</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>标题</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="消息标题（最多 60 字）" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>内容</label>
            <textarea className="input" rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="消息内容（最多 1000 字）" style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>图片 URL (可选)</label>
            <input className="input" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>链接 URL (可选)</label>
            <input className="input" value={form.linkUrl} onChange={e => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>优先级 (越大越靠前)</label>
            <input className="input" type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
          </div>
          {formError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 10px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>
              {formError}
            </div>
          )}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface2)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>预览</div>
            {form.imageUrl.trim() && (
              <img src={form.imageUrl.trim()} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, background: `${CAT_COLORS[form.category] || '#666'}20`, color: CAT_COLORS[form.category] || '#666' }}>
                {form.category}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{form.title.trim() || '未填写标题'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{form.content.trim() || '未填写内容'}</div>
            {form.linkUrl.trim() && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--primary-soft)' }}>{form.linkUrl.trim()}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {!editMsg && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setForm(DEFAULT_FORM);
                  setFormError('');
                  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
                }}
              >
                清空草稿
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
