"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Ban, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ButtonProps = Omit<ComponentProps<typeof Button>, "type" | "onClick" | "title">;

/** Named (not a component) so server components can pass it across the client boundary. */
const ICONS = { trash: Trash2, x: X, ban: Ban } as const;
type ConfirmIcon = keyof typeof ICONS;

/**
 * The app-wide guard for destructive actions. Renders the trigger button;
 * a click opens a Cancel / Confirm dialog instead of acting. Confirming
 * either submits the form the button sits in (server-action forms need no
 * change beyond swapping their submit button for this) or, with
 * `onConfirm`, runs a client-side removal.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "Delete",
  icon = "trash",
  destructive = true,
  onConfirm,
  children,
  className,
  disabled,
  ...buttonProps
}: ButtonProps & {
  /** Question shown in the dialog, e.g. "Delete this photo?" */
  title: string;
  /** Optional line naming what is affected (a file name, a person). */
  description?: ReactNode;
  confirmLabel?: string;
  icon?: ConfirmIcon;
  destructive?: boolean;
  onConfirm?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();
  const busy = pending && !onConfirm;

  function confirm() {
    setOpen(false);
    if (onConfirm) onConfirm();
    else ref.current?.form?.requestSubmit();
  }

  return (
    <>
      <Button
        ref={ref}
        type="button"
        {...buttonProps}
        className={className}
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        {busy ? <Spinner className="size-3.5" /> : children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        icon={icon}
        destructive={destructive}
        onConfirm={confirm}
      />
    </>
  );
}

/** The dialog on its own, for controls that decide when to ask (e.g. a status select). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  icon = "trash",
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  icon?: ConfirmIcon;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const Icon = ICONS[icon];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className={cn(destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
            <Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription className="break-words">{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
