"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { createRoom, updateRoom } from "@/modules/hotels/partner-actions";

type Room = {
  id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
  bed_type: string | null;
  base_price: number;
  currency: string;
  status: string;
};

export function RoomDialog({ hotelId, room }: { hotelId: string; room?: Room }) {
  const [open, setOpen] = useState(false);
  const action = room ? updateRoom : createRoom;
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (!state || state.error) return;
    queueMicrotask(() => setOpen(false));
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={room ? "outline" : "default"} size="sm" />}>
        {room ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add room
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Edit room" : "Add room"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          {room ? <input type="hidden" name="roomId" value={room.id} /> : null}

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="room-name">Room name</Label>
            <Input id="room-name" name="name" defaultValue={room?.name} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-description">Description</Label>
            <Textarea id="room-description" name="description" rows={2} defaultValue={room?.description ?? ""} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxOccupancy">Max occupancy</Label>
              <Input
                id="maxOccupancy"
                name="maxOccupancy"
                type="number"
                min={1}
                defaultValue={room?.max_occupancy ?? 2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedType">Bed type</Label>
              <Input id="bedType" name="bedType" defaultValue={room?.bed_type ?? ""} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Price / night</Label>
              <Input
                id="basePrice"
                name="basePrice"
                type="number"
                min={0}
                step="0.01"
                defaultValue={room?.base_price}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" maxLength={3} defaultValue={room?.currency ?? "USD"} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-status">Status</Label>
            <Select name="status" defaultValue={room?.status ?? "draft"}>
              <SelectTrigger id="room-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending review</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SubmitButton pendingText="Saving…">{room ? "Save changes" : "Add room"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
