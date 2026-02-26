import { StrictMode } from 'react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAdminMe, isLoggedIn, logout } from './api';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { UserDetailPage } from './pages/UserDetail';
import { MatchesPage } from './pages/Matches';
import { ReportsPage } from './pages/Reports';
import { ConversationsPage } from './pages/Conversations';
import { AnalyticsPage } from './pages/Analytics';
import { PersonalityPage } from './pages/Personality';
import { OpMessagesPage } from './pages/OpMessages';
import { SettingsPage } from './pages/Settings';
import { SoulSessionsPage } from './pages/SoulSessions';
import { AuditLogPage } from './pages/AuditLog';
import './index.css';

function resolveBasename() {
  const pathname = window.location.pathname;
  return pathname.startsWith('/linksoul/mobile') ? '/linksoul/mobile' : '/linksoul/admin';
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!isLoggedIn()) {
      setAllowed(false);
      return;
    }
    getAdminMe()
      .then(() => {
        if (active) setAllowed(true);
      })
      .catch(() => {
        if (active) {
          setAllowed(false);
          logout();
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (allowed === null) return null;
  return allowed ? <>{children}</> : <Navigate to="/login" replace />;
}

function NotFoundPage() {
  return (
    <div className="empty" style={{ minHeight: '60vh' }}>
      <div className="icon">404</div>
      <div className="title">页面不存在</div>
      <div className="desc">请检查地址是否正确</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter basename={resolveBasename()}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="users/:id" element={<UserDetailPage />} />
                <Route path="matches" element={<MatchesPage />} />
                <Route path="conversations" element={<ConversationsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="personality" element={<PersonalityPage />} />
                <Route path="op-messages" element={<OpMessagesPage />} />
                <Route path="soul-sessions" element={<SoulSessionsPage />} />
                <Route path="audit-log" element={<AuditLogPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
