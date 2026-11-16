"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./reports.module.css";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Date range for the earnings report; the product filter is link chips on the page and is carried through. */
export function ReportFilters({
  defaultFrom,
  defaultTo,
  defaultType,
}: {
  defaultFrom?: string;
  defaultTo?: string;
  defaultType?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(defaultFrom ?? "");
  const [to, setTo] = useState(defaultTo ?? "");

  function push(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    if (defaultType) params.set("type", defaultType);
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function clear() {
    setFrom("");
    setTo("");
    push("", "");
  }

  return (
    <form
      role="search"
      aria-label="Date range"
      onSubmit={(event) => {
        event.preventDefault();
        push(from, to);
      }}
      className={styles.dateFilters}
    >
      <div className={styles.dateField}>
        <label htmlFor="reportFrom">From</label>
        <Input id="reportFrom" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className={styles.dateField}>
        <label htmlFor="reportTo">To</label>
        <Input id="reportTo" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="submit">Apply</Button>
      {defaultFrom || defaultTo ? (
        <Button type="button" variant="ghost" size="icon" aria-label="Clear dates" title="Clear dates" onClick={clear}>
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </form>
  );
}
