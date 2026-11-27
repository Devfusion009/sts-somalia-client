import { Ban, LogOut, Mail, Phone } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
import styles from "./portal-suspended-notice.module.css";

/** Suspension blocks the workspace while keeping support and sign-out available. */
export function PortalSuspendedNotice({ portalLabel, agencyName, agentCode }: {
  portalLabel: string; agencyName?: string; agentCode?: string | null;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="suspended-title">
        <header className={styles.header}><span>STS SOMALIA</span><span>{portalLabel}</span></header>
        <div className={styles.body}>
          <span className={styles.icon} aria-hidden="true"><Ban size={32} strokeWidth={1.7} /></span>
          <span className={styles.status}>ACCOUNT SUSPENDED</span>
          <h1 id="suspended-title">Your portal access is suspended</h1>
          {(agencyName || agentCode) && <div className={styles.identity}>{agencyName && <strong>{agencyName}</strong>}{agentCode && <span>{agentCode}</span>}</div>}
          <p className={styles.message}>Contact STS Somalia support to discuss reactivation.</p>
          <div className={styles.contacts}>
            <a href="mailto:support@scoutsts.com"><Mail size={17} aria-hidden="true" />Contact support</a>
            <a href={SUPPORT_PHONE_TEL}><Phone size={16} aria-hidden="true" /><span>{SUPPORT_PHONE_DISPLAY}</span></a>
          </div>
        </div>
        <footer className={styles.footer}><span>Access restricted by STS Somalia</span><form action={signOutAction}><button type="submit"><LogOut size={15} aria-hidden="true" />Sign out</button></form></footer>
      </section>
    </main>
  );
}
