"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function RefreshOrdersButton() {
  const router=useRouter();
  const [pending,start]=useTransition();
  return <Button variant="outline" disabled={pending} onClick={()=>start(()=>router.refresh())}><RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />{pending ? "Refreshing…" : "Refresh"}</Button>;
}
