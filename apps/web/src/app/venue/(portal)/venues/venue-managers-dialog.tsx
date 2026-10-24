"use client";

import { useState } from "react";
import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VenueManagersSection } from "@/modules/hotels/components/manager-form";

type Manager = {
  id: string;
  permissions: string[];
  profile: { id: string; full_name: string | null; email: string | null } | null;
};

export function VenueManagersDialog({
  venueId,
  venueName,
  managers,
}: {
  venueId: string;
  venueName: string;
  managers: Manager[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={`Managers of ${venueName}${managers.length > 0 ? ` (${managers.length})` : ""}`}
        title="Managers"
        onClick={() => setOpen(true)}
      >
        <UsersRound aria-hidden="true" />
        {managers.length > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums"
          >
            {managers.length}
          </span>
        ) : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{venueName}</DialogTitle>
          </DialogHeader>
          <VenueManagersSection venueId={venueId} managers={managers} />
        </DialogContent>
      </Dialog>
    </>
  );
}
