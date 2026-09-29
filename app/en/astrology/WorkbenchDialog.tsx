"use client";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./workspace.module.css";

export function WorkbenchDialog({ title, closeLabel, onClose, children, busy = false, busyLabel }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode; busy?: boolean; busyLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={styles.workbenchDialog} aria-label={title} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.dialogHeading}><h2>{title}</h2><button type="button" autoFocus aria-label={closeLabel} disabled={busy} onClick={onClose}>×</button></div>
    {busy && busyLabel && <p role="status" className={styles.hint}>{busyLabel}</p>}
    {children}
  </dialog>;
}
