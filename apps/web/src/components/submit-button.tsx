"use client";

import { useFormStatus } from "react-dom";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

type SubmitButtonProps = ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants> & {
    pendingText?: string;
  };

/** Submit button that reads its form's pending state: spinner + pendingText while the action runs. */
export function SubmitButton({
  children,
  pendingText = "Please wait…",
  loading,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending || loading} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
