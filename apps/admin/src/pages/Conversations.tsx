import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { UserAvatar } from '../components/UserAvatar';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useDebounce } from '../hooks/useDebounce';
import type { Conversation, Message } from '../types';

interface ConvsResponse { conversations: Conversation[]; total: number; totalPages: number }
interface MsgsResponse { messages: Message[]; total: number; totalPages: number; page: number }

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const debouncedSearch = useDebounce(search);
  const toast = useToast();

  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotalPages, setMsgTotalPages] = useState(1);
  const msgListRef = useRef<HTMLDivElement>(null);
  const MSG_PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (typeFilter) params.set('type', typeFilter);
      const data = await api.get<ConvsResponse>(`/admin/conversations?${params}`);
      setConversations(data.conversations || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadMessages = async (conv: Conversation, pageToLoad: number, prepend = false) => {
    const data = await api.get<MsgsResponse>(`/admin/conversations/${conv.id}/messages?page=${pageToLoad}&pageSize=${MSG_PAGE_SIZE}`);
    setMsgPage(data.page || pageToLoad);
    setMsgTotalPages(data.totalPages || 1);
    if (prepend) {
      setMessages((prev) => [...(data.messages || []), ...prev]);
    } else {
      setMessages(data.messages || []);
    }
    return data;
  };

  const viewMessages = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMsgLoading(true);
    try {
      // Open at the latest page so admins see newest messages first.
      const first = await loadMessages(conv, 1);
      const latestPage = first.totalPages || 1;
      if (latestPage > 1) {
        await loadMessages(conv, latestPage);
      }
      setTimeout(() => msgListRef.current?.scrollTo({ top: msgListRef.current.scrollHeight, behavior: 'smooth' }), 100);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载消息失败');
    } finally {
      setMsgLoading(false);
    }
  };

  const isImageUrl = (s: string) => /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i.test(s);

  const msgTypeBadge = (type: string) => {
    switch (type) {
      case 'AI_SUGGESTION': return <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(167,139,250,.15)', color: '#A78BFA', marginRight: 4 }}>AI</span>;
      case 'SYSTEM': return <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(56,189,248,.15)', color: '#38BDF8', marginRight: 4 }}>系统</span>;
      case 'IMAGE': return <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(236,72,153,.15)', color: '#EC4899', marginRight: 4 }}>图片</span>;
      default: return null;
    }
  };

  const renderContent = (msg: Message) => {
    if (msg.type === 'IMAGE' || isImageUrl(msg.content)) {
      return (
        <img src={msg.content} alt="图片消息" style={{
          maxWidth: 200, maxHeight: 200, borderRadius: 8, display: 'block', cursor: 'pointer',
        }} onClick={() => window.open(msg.content, '_blank')} />
      );
    }
    return msg.content;
  };

  const loadOlderMessages = async () => {
    if (!selectedConv || msgPage <= 1 || msgLoading) return;
    setMsgLoading(true);
    try {
      await loadMessages(selectedConv, msgPage - 1, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载历史消息失败');
    } finally {
      setMsgLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>对话监控</h1>
        <p>查看和监控平台用户对话记录</p>
      </div>

      <div className="toolbar">
        <input
          className="input" placeholder="搜索用户昵称..."
          style={{ maxWidth: 240 }}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input" style={{ maxWidth: 140 }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">全部类型</option>
          <option value="AI_PRECHAT">AI 破冰</option>
          <option value="DIRECT">直接聊天</option>
        </select>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>共 {total} 个对话</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>参与者</th>
              <th>类型</th>
              <th>消息数</th>
              <th>最新消息</th>
              <th>状态</th>
              <th>更新时间</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>加载中...</td></tr>
            ) : conversations.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>暂无对话</td></tr>
            ) : conversations.map(c => {
              const lastMsg = c.messages?.[0];
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link to={`/users/${c.match?.userA?.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <UserAvatar name={c.match?.userA?.nickname || '?'} avatar={c.match?.userA?.avatar} size="sm" />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{c.match?.userA?.nickname}</span>
                      </Link>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>⟷</span>
                      <Link to={`/users/${c.match?.userB?.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <UserAvatar name={c.match?.userB?.nickname || '?'} avatar={c.match?.userB?.avatar} size="sm" />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{c.match?.userB?.nickname}</span>
                      </Link>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.type === 'AI_PRECHAT' ? 'badge-accepted' : 'badge-active'}`}>
                      {c.type === 'AI_PRECHAT' ? 'AI 破冰' : '直接聊天'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{c._count?.messages || 0}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {lastMsg?.content || <span style={{ color: 'var(--text3)' }}>暂无消息</span>}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(c.updatedAt).toLocaleString('zh-CN')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => viewMessages(c)}>
                      查看消息
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal
        open={!!selectedConv}
        onClose={() => { setSelectedConv(null); setMessages([]); setMsgPage(1); setMsgTotalPages(1); }}
        title={selectedConv ? `${selectedConv.match?.userA?.nickname || '?'} ⟷ ${selectedConv.match?.userB?.nickname || '?'}` : '对话详情'}
        wide
      >
        {msgLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>加载中...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
            <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 8 }}>◎</div>
            暂无消息记录
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>第 {msgPage}/{msgTotalPages} 页</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={loadOlderMessages}
                disabled={msgPage <= 1 || msgLoading}
              >
                {msgPage <= 1 ? '已是最早消息' : '加载更早消息'}
              </button>
            </div>
            <div ref={msgListRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '55vh', overflowY: 'auto', padding: '4px 0' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 10, padding: '6px 0' }}>
                  <UserAvatar name={msg.sender?.nickname || '系统'} avatar={msg.sender?.avatar} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        {msg.sender?.nickname || '系统'}
                      </span>
                      {msgTypeBadge(msg.type)}
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
                        {new Date(msg.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, wordBreak: 'break-all',
                      padding: '8px 12px', background: 'var(--surface2)', borderRadius: '4px 12px 12px 12px',
                    }}>
                      {renderContent(msg)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
