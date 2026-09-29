"use client";
import type { ReactNode } from "react";
import styles from "./workspace.module.css";

export function ToolMenu({ label, active = false, children, icon }: { label: string; active?: boolean; children: ReactNode; icon?: ReactNode }) {
  return <details className={styles.toolMenu} data-active={active || undefined} onKeyDown={event => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
    <summary>{icon ? <>{icon}<span className={styles.srOnly}>{label}</span></> : label}</summary>
    <div className={styles.menuItems} onClick={event => {
      if ((event.target as HTMLElement).closest("button")) event.currentTarget.parentElement?.removeAttribute("open");
    }}>{children}</div>
  </details>;
}
