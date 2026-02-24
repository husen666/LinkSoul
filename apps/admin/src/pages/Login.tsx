import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, padding: 36,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 200, color: '#E0E7FF', letterSpacing: 3 }}>Link</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#A78BFA' }}>Soul</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>管理后台登录</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>邮箱</label>
              <input
                className="input" type="email" placeholder="请输入管理员邮箱"
                value={email} onChange={e => setEmail(e.target.value)}
                autoFocus required
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>密码</label>
              <input
                className="input" type="password" placeholder="请输入密码"
                value={password} onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading || !email || !password}
              style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
