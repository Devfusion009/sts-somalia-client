"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? "Copied" : "Copy link"}
      title={copied ? "Copied" : "Copy link"}
      className={cn("max-sm:size-10", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          toast.error("Copy failed.");
          return;
        }
        toast.success("Copied.");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="text-primary" aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}
