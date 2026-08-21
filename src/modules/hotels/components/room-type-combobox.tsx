"use client";

import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
} from "@/components/ui/combobox";

/**
 * "Pick a common room type, or type your own" — same MCQ-or-custom pattern
 * as the partner-application RoomTypeCombobox
 * (modules/partner-applications/components/room-types-field.tsx), sourced
 * from the shared hotel_room_types catalog instead of a hardcoded list.
 * Shared between the admin hotel-management room form and the hotel-partner
 * portal's own room form — both let someone register a real room, so both
 * get the same "pick from the shared list, or add a custom one" flow.
 * inputValue is the single source of truth: picking a suggestion fills the
 * input with that text, and anything typed — matched or not — is accepted.
 */
export function RoomTypeCombobox({
  id,
  value,
  onValueChange,
  types,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  types: string[];
}) {
  return (
    <Combobox
      items={types}
      inputValue={value}
      onInputValueChange={onValueChange}
      value={value || null}
      onValueChange={(next) => onValueChange(typeof next === "string" ? next : "")}
      autoHighlight
    >
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder="e.g. Deluxe Room" />
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty>No matching room type — your typed name will be added to the shared list.</ComboboxEmpty>
            <ComboboxList>
              {(type: string) => (
                <ComboboxItem key={type} value={type}>
                  {type}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </Combobox>
  );
}
