'use client';

import { useEffect, useCallback } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, title, children, className = '' }: ModalProps): React.ReactElement | null {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-lg rounded-lg border border-border bg-card p-2xl shadow-lg ${className}`}>
        {title && (
          <div className="mb-xl flex items-center justify-between">
            <h3 className="font-heading text-h3 text-text-primary">{title}</h3>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">
              &times;
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
