import styles from "./workspace.module.css";
export function WorkspaceIcon({ name }: { name: "share-2" | "mail" | "folder" | "user-round" | "calendar-days" | "settings" | "map-pin" }) {
  return <span aria-hidden="true" className={styles.workspaceIcon} style={{ maskImage: `url(/icons/lucide/${name}.svg)`, WebkitMaskImage: `url(/icons/lucide/${name}.svg)` }} />;
}
