import type { ReactNode } from "react";
import Image from "next/image";
import styles from "./workspace-cover.module.css";

export function WorkspaceCover({ image, title, meta, status, actions, headingLevel = 1, compact = false }: {
  image: string;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  compact?: boolean;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <header className={styles.cover} data-compact={compact || undefined}>
      <Image src={image} alt="" fill unoptimized className="object-cover" />
      <div className={styles.content}>
        <div className="min-w-0">
          <div className={styles.title}><Heading>{title}</Heading>{status ? <span className={styles.status}>{status}</span> : null}</div>
          {meta ? <div className={styles.meta}>{meta}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
