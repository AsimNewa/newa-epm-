import { useEffect } from 'react';
import { useToastStore } from '../store/toast-store';

function ToastItem({ id, message, variant }: { id: string; message: string; variant: 'error' | 'success' }): JSX.Element {
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), 6000);
    return () => clearTimeout(timer);
  }, [id, removeToast]);

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded px-4 py-3 text-sm text-white shadow-lg ${
        variant === 'error' ? 'bg-red-600' : 'bg-green-600'
      }`}
    >
      <span>{message}</span>
      <button className="text-white/80 hover:text-white" onClick={() => removeToast(id)}>
        ✕
      </button>
    </div>
  );
}

export function ToastContainer(): JSX.Element {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </div>
  );
}
