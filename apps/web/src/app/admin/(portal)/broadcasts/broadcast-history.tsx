"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Megaphone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AUDIENCE_LABELS } from "./broadcast-form";

type Entry = { broadcastId: string; title: string; body: string | null; audience: string; createdAt: string; recipientCount: number };

export function BroadcastHistory({ history }: { history: Entry[] }) {
  const [search, setSearch] = useState("");
  const entries = history.filter((item) => `${item.title} ${item.body ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <div className="relative mb-5"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden /><Input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search broadcast history" placeholder="Search history" className="pl-9" /></div>
    {entries.length === 0 ? <Empty className="min-h-64"><EmptyMedia variant="icon"><Megaphone /></EmptyMedia><EmptyTitle>{search ? "No broadcasts match" : "No broadcasts sent"}</EmptyTitle></Empty> :
      <ul className="divide-y divide-border">{entries.map((b) => <li key={b.broadcastId} className="py-5 first:pt-0 last:pb-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Badge variant="success">Sent</Badge><time dateTime={b.createdAt} className="text-xs text-muted-foreground tabular-nums">{format(new Date(b.createdAt), "d MMM yyyy, HH:mm")}</time></div>
        <h3 className="font-heading text-base font-semibold break-words">{b.title}</h3>
        {b.body ? <div className="mt-2 text-sm leading-6 whitespace-pre-wrap break-words text-muted-foreground">{b.body}</div> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge variant="neutral">{AUDIENCE_LABELS[b.audience as keyof typeof AUDIENCE_LABELS] ?? b.audience}</Badge><span className="text-xs text-muted-foreground tabular-nums">{b.recipientCount} {b.recipientCount === 1 ? "recipient" : "recipients"}</span></div>
      </li>)}</ul>}
  </>;
}
