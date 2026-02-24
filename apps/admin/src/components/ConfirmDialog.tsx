import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmCtx {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmCtx>({ confirm: () => Promise.resolve(false) });

export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  const btnClass = state?.variant === 'danger' ? 'btn-danger' : state?.variant === 'warning' ? 'btn-warning' : 'btn-primary';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-label={state.title} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{state.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>{state.message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => handleClose(false)}>
                {state.cancelText || '取消'}
              </button>
              <button className={`btn ${btnClass}`} onClick={() => handleClose(true)}>
                {state.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
