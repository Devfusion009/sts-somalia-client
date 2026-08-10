"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { COMMON_ROLE_TITLES } from "./role-titles";

/**
 * Free-text role/title input with a filtered suggestion list — not a
 * restricted picker, since real job titles vary too much to enumerate.
 * Typing filters the common-titles list; picking one or typing your own
 * both work, and the value submits as plain text under `name`.
 */
export function RoleField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  const matches =
    value.trim().length > 0
      ? COMMON_ROLE_TITLES.filter((t) => t.toLowerCase().includes(value.trim().toLowerCase()))
      : COMMON_ROLE_TITLES;

  return (
    <div className="relative">
      <Input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="e.g. General Manager"
        required
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
      />
      {open && matches.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md ring-1 ring-foreground/10">
          {matches.map((title) => (
            <button
              key={title}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(title);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
