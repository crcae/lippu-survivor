"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
}

const TOAST_DURATION_MS = 3_000;

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<
  ToastType,
  { icon: typeof Info; className: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-success/50 bg-success/10 text-success",
    iconColor: "text-success",
  },
  error: {
    icon: AlertCircle,
    className: "border-danger/50 bg-danger/10 text-danger",
    iconColor: "text-danger",
  },
  info: {
    icon: Info,
    className: "border-info/50 bg-info/10 text-info",
    iconColor: "text-info",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++nextIdRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message) => toast(message, "success"),
      error: (message) => toast(message, "error"),
      info: (message) => toast(message, "info"),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast stack — top layer so alerts always render above all modals/drawers */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const { icon: Icon, className, iconColor } = toastStyles[item.type];
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-elevated backdrop-blur-sm animate-toast-in ${className}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
              <p className="text-sm font-semibold text-text-primary max-w-xs">
                {item.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="text-text-secondary hover:text-text-primary transition-colors focus-ring rounded-lg p-1"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Access the global toast notification helpers. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  }
  return context;
}

export type { ToastContextValue, ToastItem, ToastType };
