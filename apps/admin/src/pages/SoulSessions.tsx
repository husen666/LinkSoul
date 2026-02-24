import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { UserAvatar } from '../components/UserAvatar';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import type { SoulSession, SoulMessage } from '../types';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  AI: { label: 'AI 对话', cls: 'badge-accepted' },
  HUMAN: { label: '人工接管', cls: 'badge-pending' },
  CLOSED: { label: '已关闭', cls: 'badge-inactive' },
};

const ROLE_STYLE: Record<string, { label: string; bg: string; color: string; align: string }> = {
  user: { label: '用户', bg: 'var(--surface2)', color: 'var(--text2)', align: 'flex-start' },
  ai: { label: 'AI', bg: 'rgba(99,102,241,.12)', color: 'var(--primary-soft)', align: 'flex-start' },
  admin: { label: '管理员', bg: 'rgba(52,211,153,.12)', color: 'var(--success)', align: 'flex-end' },
};

interface SessionsResponse { sessions: SoulSession[]; total: number; totalPages: number }
interface SessionMsgsResponse { session: SoulSession; messages: SoulMessage[]; total: number; totalPages: number; page: number }

export function SoulSessionsPage() {
  const [sessions, setSessions] = useState<SoulSession[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const [selectedSession, setSelectedSession] = useState<SoulSession | null>(null);
  const [messages, setMessages] = useState<SoulMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotalPages, setMsgTotalPages] = useState(1);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const msgListRef = useRef<HTMLDivElement>(null);
  const MSG_PAGE_SIZE = 50;

  const scrollToBottom = () => {
    setTimeout(() => msgListRef.current?.scrollTo({ top: msgListRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get<SessionsResponse>(`/admin/soul-sessions?${params}`);
      setSessions(data.sessions || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadSessionMessages = async (session: SoulSession, pageToLoad: number, prepend = false) => {
    const data = await api.get<SessionMsgsResponse>(`/admin/soul-sessions/${session.id}/messages?page=${pageToLoad}&pageSize=${MSG_PAGE_SIZE}`);
    setMsgPage(data.page || pageToLoad);
    setMsgTotalPages(data.totalPages || 1);
    if (prepend) {
      setMessages((prev) => [...(data.messages || []), ...prev]);
    } else {
      setMessages(data.messages || []);
    }
    return data;
  };

  const viewSession = async (session: SoulSession) => {
    setSelectedSession(session);
    setMsgLoading(true);
    try {
      const first = await loadSessionMessages(session, 1);
      const latestPage = first.totalPages || 1;
      if (latestPage > 1) {
        await loadSessionMessages(session, latestPage);
      }
      scrollToBottom();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载消息失败');
    } finally {
      setMsgLoading(false);
    }
  };

  const takeSession = async (id: string) => {
    const ok = await confirm({
      title: '接管会话',
      message: '接管后将由你来回复用户，AI 将不再自动回复。确定接管？',
      confirmText: '接管',
      variant: 'primary',
    });
    if (!ok) return;
    try {
      await api.post(`/admin/soul-sessions/${id}/take`);
      toast.success('已接管会话');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const closeSession = async (id: string) => {
    const ok = await confirm({
      title: '关闭会话',
      message: '关闭后用户将无法继续在此会话中发送消息。',
      confirmText: '关闭',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await api.post(`/admin/soul-sessions/${id}/close`);
      toast.success('已关闭会话');
      fetchData();
      if (selectedSession?.id === id) setSelectedSession(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    setSending(true);
    try {
      await api.post(`/admin/soul-sessions/${selectedSession.id}/messages`, { content: replyText.trim() });
      setReplyText('');
      const first = await loadSessionMessages(selectedSession, 1);
      const latestPage = first.totalPages || 1;
      if (latestPage > 1) {
        await loadSessionMessages(selectedSession, latestPage);
      }
      scrollToBottom();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedSession || msgPage <= 1 || msgLoading) return;
    setMsgLoading(true);
    try {
      await loadSessionMessages(selectedSession, msgPage - 1, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载历史消息失败');
    } finally {
      setMsgLoading(false);
    }
  };

  return (
    <div className="soul-page">
      <div className="page-header soul-header">
        <h1>心灵解脱</h1>
        <p>管理用户心灵解脱会话，支持人工接管与回复</p>
      </div>

      <div className="toolbar soul-toolbar">
        <select className="input" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="AI">AI 对话中</option>
          <option value="HUMAN">人工接管</option>
          <option value="CLOSED">已关闭</option>
        </select>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 个会话</span>
      </div>

      <div className="soul-session-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="empty">
            <div className="icon">☯</div>
            <div className="title">暂无会话</div>
          </div>
        ) : sessions.map(s => {
          const st = STATUS_MAP[s.status] || { label: s.status, cls: 'badge-inactive' };
          const lastMsg = s.messages?.[0];
          return (
            <div className="card soul-session-card" key={s.id} style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Link to={`/users/${s.user?.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserAvatar name={s.user?.nickname || '?'} avatar={s.user?.avatar} size="sm" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{s.user?.nickname}</span>
                  </Link>
                  <span className={`badge ${st.cls} soul-status soul-status-${s.status.toLowerCase()}`}>{st.label}</span>
                  {s.topic !== 'general' && (
                    <span className="soul-topic-chip" style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 6 }}>
                      {s.topic}
                    </span>
                  )}
                </div>
                <div className="soul-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                  <span>{s._count?.messages || 0} 条消息</span>
                  <span>·</span>
                  <span>{new Date(s.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              {s.title && (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{s.title}</div>
              )}

              {lastMsg && (
                <div className="soul-last-message" style={{
                  fontSize: 12, color: 'var(--text2)', padding: '8px 12px',
                  background: 'var(--surface2)', borderRadius: 8, marginBottom: 12,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'var(--text3)', marginRight: 6 }}>
                    {lastMsg.role === 'user' ? '用户:' : lastMsg.role === 'ai' ? 'AI:' : '管理员:'}
                  </span>
                  {lastMsg.content}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => viewSession(s)}>查看消息</button>
                {s.status === 'AI' && (
                  <button className="btn btn-sm btn-primary" onClick={() => takeSession(s.id)}>人工接管</button>
                )}
                {s.status !== 'CLOSED' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => closeSession(s.id)}>关闭会话</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal
        open={!!selectedSession}
        onClose={() => { setSelectedSession(null); setMessages([]); setMsgPage(1); setMsgTotalPages(1); setReplyText(''); }}
        title={selectedSession ? `${selectedSession.user?.nickname || '?'} — ${selectedSession.title || '心灵解脱'}` : '会话详情'}
      >
        {msgLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>加载中...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
            <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 8 }}>☯</div>
            暂无消息
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>第 {msgPage}/{msgTotalPages} 页</span>
              <button
                className="btn btn-ghost btn-sm soul-btn-subtle"
                onClick={loadOlderMessages}
                disabled={msgPage <= 1 || msgLoading}
              >
                {msgPage <= 1 ? '已是最早消息' : '加载更早消息'}
              </button>
            </div>
            <div className="soul-msg-list" ref={msgListRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '45vh', overflowY: 'auto', padding: '4px 0', marginBottom: 16 }}>
              {messages.map(msg => {
                const rs = ROLE_STYLE[msg.role] || ROLE_STYLE.user;
                const isAdmin = msg.role === 'admin';
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                        background: rs.bg, color: rs.color,
                      }}>{rs.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {new Date(msg.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className={`soul-msg-bubble ${isAdmin ? 'is-admin' : ''}`} style={{
                      fontSize: 13, lineHeight: 1.6, padding: '8px 14px', borderRadius: 12,
                      background: isAdmin ? 'var(--primary-dim)' : rs.bg, color: isAdmin ? 'var(--primary-soft)' : 'var(--text2)',
                      maxWidth: '85%', wordBreak: 'break-all',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedSession?.status !== 'CLOSED' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="输入管理员回复..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                />
                <button
                  className="btn btn-primary soul-send-btn"
                  onClick={sendReply}
                  disabled={sending || !replyText.trim() || selectedSession?.status !== 'HUMAN'}
                >
                  {sending ? '...' : '发送'}
                </button>
              </div>
            )}
            {selectedSession?.status === 'AI' && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--warning)' }}>
                该会话仍由 AI 模式托管，请先点击“人工接管”再发送管理员回复。
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
