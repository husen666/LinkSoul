const TIMEOUT_MS = 30_000;
const ADMIN_KEY = 'admin_user';
function resolveProjectBasePath() {
  return window.location.pathname.startsWith('/linksoul/') ? '/linksoul' : '';
}
const BASE = `${resolveProjectBasePath()}/api/v1`;
function resolveBasePath() {
  return window.location.pathname.startsWith('/linksoul/mobile')
    ? '/linksoul/mobile/'
    : '/linksoul/admin/';
}
const LOGIN_PATH = `${resolveBasePath()}login`;
const LOGIN_PATHNAME = new URL(LOGIN_PATH, window.location.origin).pathname;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('admin_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('admin_token');
      if (window.location.pathname !== LOGIN_PATHNAME) {
        window.location.href = LOGIN_PATH;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '未授权，请重新登录');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `请求失败 (${res.status})`);
    }
    if (res.status === 204) return {} as T;
    return res.json();
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface AdminUser {
  id: string;
  nickname: string;
  email?: string;
  role: string;
  status?: string;
}

export async function login(email: string, password: string) {
  const data = await api.post<{ token: string; user: AdminUser }>(
    '/admin/auth/login', { email, password },
  );
  localStorage.setItem('admin_token', data.token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(data.user));
  return data;
}

export async function getAdminMe() {
  const me = await api.get<AdminUser>('/admin/auth/me');
  localStorage.setItem(ADMIN_KEY, JSON.stringify(me));
  return me;
}

export function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem(ADMIN_KEY);
  window.location.href = LOGIN_PATH;
}

export function isLoggedIn() {
  return !!localStorage.getItem('admin_token');
}

export function getCachedAdmin(): AdminUser | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}
