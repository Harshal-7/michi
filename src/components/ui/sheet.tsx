"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

import { IconButton } from "./icon-button";

/**
 * A sheet: a native modal <dialog> that rises from the bottom on a phone (radius 28 on top, a handle)
 * and sits in the middle on a laptop. raised ground, the raised shadow, the scrim behind. Esc, the
 * close button and a tap on the scrim all call `onClose`; focus moves in and comes back by itself.
 * Actions stack under the content: the primary first, then a quiet one.
 *
 * @example
 * <Sheet open={adding} onClose={() => setAdding(false)} title="Add a word"
 *   actions={<><Button size="lg" full icon="check" type="submit" form="add">Save word</Button>
 *            <Button variant="quiet" onClick={close}>Cancel</Button></>}>
 *   <form id="add">…</form>
 * </Sheet>
 */
export function Sheet({
  open,
  onClose,
  title,
  lead,
  actions,
  children,
  closeLabel = "Close",
  className,
}: {
  /** Shown or not. */
  open: boolean;
  /** Called on Esc, the close button, or a tap on the scrim. */
  onClose: () => void;
  /** The heading (h2) and the dialog's name. */
  title: ReactNode;
  /** A line under the title. */
  lead?: ReactNode;
  /** The buttons at the bottom, stacked. */
  actions?: ReactNode;
  children?: ReactNode;
  /** The close button's label. */
  closeLabel?: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A tap on the scrim (the dialog's own box, outside the panel) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={`m-auto mb-0 max-h-[calc(100dvh-12px)] w-full max-w-none overflow-y-auto rounded-t-sheet border-0 bg-raised p-0 text-ink shadow-raised backdrop:bg-scrim laptop:mb-auto laptop:w-[480px] laptop:rounded-sheet ${className ?? ""}`}
    >
      {open && (
        <div className="flex flex-col px-5 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))] laptop:px-7 laptop:pt-5 laptop:pb-7">
          <span aria-hidden="true" className="mx-auto mb-2.5 h-1.25 w-10 rounded-full bg-line-strong laptop:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 id={heading} className="m-0 text-title font-bold">
              {title}
            </h2>
            <IconButton icon="close" label={closeLabel} onClick={onClose} className="-mr-2" />
          </div>
          {lead && <p className="m-0 text-body text-ink2">{lead}</p>}
          {children && <div className="mt-2 flex flex-col gap-3.5">{children}</div>}
          {actions && <div className="mt-4.5 flex flex-col items-stretch gap-2 [&>a]:self-center [&>button:not(:first-child)]:self-center">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
