import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastCtx {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastCtx>({ success: () => {}, error: () => {}, info: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message: string, type: ToastItem['type']) => {
    const id = ++idRef.current;
    setToasts(p => [...p, { id, message, type }]);
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((msg: string) => push(msg, 'success'), [push]);
  const error = useCallback((msg: string) => push(msg, 'error'), [push]);
  const info = useCallback((msg: string) => push(msg, 'info'), [push]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div role="status" aria-live="polite" style={{ position: 'fixed', top: 20, right: 20, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}
            onClick={() => dismiss(t.id)}
            style={{ cursor: 'pointer' }}
            title="点击关闭">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
