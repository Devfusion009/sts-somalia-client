import type { Metadata } from "next";
import { getServerTrpc } from "@/lib/trpc/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { BroadcastForm } from "./broadcast-form";
import { BroadcastHistory } from "./broadcast-history";
import styles from "../operations.module.css";

export const metadata: Metadata = { title: "Broadcasts" };

export default async function AdminBroadcastsPage() {
  const trpc = await getServerTrpc();
  const history = await trpc.notifications.admin.broadcastHistory.query();
  return (
    <div className={`${styles.page} space-y-6`}>
      <PageHeader title="Broadcasts" status={<Badge variant="outline">Agency communications</Badge>} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className={styles.panel}>
          <h2 className={styles.panelHeading}>New broadcast</h2>
          <div className="p-5 sm:p-6"><BroadcastForm /></div>
        </section>
        <section className={styles.panel}>
          <h2 className={`${styles.panelHeading} flex items-center justify-between gap-3`}>Send history <Badge variant="neutral">{history.length} recent</Badge></h2>
          <div className="p-5 sm:p-6"><BroadcastHistory history={history} /></div>
        </section>
      </div>
    </div>
  );
}
