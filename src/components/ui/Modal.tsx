"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-surface-elevated border border-border p-0 max-w-lg w-full shadow-elevated text-text-primary max-h-[90dvh] overflow-y-auto mt-auto mb-0 mx-auto rounded-t-2xl rounded-b-none sm:my-auto sm:rounded-2xl animate-sheet-in sm:animate-fade-in ${className}`}
    >
      {/* Drag handle (mobile bottom sheet indicator) */}
      <div className="sm:hidden flex justify-center pt-3 pb-1">
        <span className="w-10 h-1 rounded-full bg-border/70" />
      </div>

      {/* Header */}
      {title && (
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface text-text-secondary hover:text-text-primary transition-colors focus-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}

export type { ModalProps };
