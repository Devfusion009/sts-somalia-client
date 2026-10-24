"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

/**
 * Password field with a show/hide toggle. `className` sizes the whole group
 * (height, width); `startAddon` renders a leading icon inside the field.
 */
export function PasswordInput({
  className,
  startAddon,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { startAddon?: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup className={className}>
      {startAddon ? <InputGroupAddon>{startAddon}</InputGroupAddon> : null}
      <InputGroupInput type={visible ? "text" : "password"} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={props.id}
          className="text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
