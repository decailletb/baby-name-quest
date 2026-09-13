import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** Accessible name of the close button. */
  closeLabel?: string;
}

/** Modal panel sliding from the bottom on phones, centred on larger screens. */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
  footer,
  closeLabel = 'Fermer',
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Move focus inside, lock the page scroll and listen for Escape while open; give focus back after.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Keep Tab inside the dialog.
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-stone-900/40"
        aria-hidden="true"
        onClick={onClose}
        data-testid="sheet-backdrop"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-3xl bg-stone-50 shadow-xl outline-none sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-bold text-stone-800">
            {title}
          </h2>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-stone-500 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-stone-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
