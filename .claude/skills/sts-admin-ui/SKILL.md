---
name: sts-admin-ui
description: Design and copy standard for STS Somalia's internal consoles (admin, partner, agent, affiliate, venue portals). Use whenever building or editing any page, form, card, or component under src/app/admin, src/app/partner, src/app/agent, src/app/affiliate, src/app/venue, or src/app/account — new UI or a revision to existing UI. Encodes the recurring feedback from this project's design passes so it doesn't need repeating each time.
---

# STS internal-console design standard

These are operator tools (admin staff, hotel/venue partners, agents, hotel
managers), not a marketing site. STS is an ISO-certified company; every
screen we ship reflects on that. The failure mode to avoid is the generic
shadcn-dashboard-tutorial look — every section wrapped in an identical card
with a colored icon and a title, every field padded out with explanatory
copy. Recurring, explicit feedback across this project: **crisp, minimal
text, professional — not generic AI-generated.** If a sentence reads like
placeholder tutorial copy explaining how a widget works ("Nights without a
cap are open-ended: bookings are accepted without limit. Set a cap to
control how many rooms can be sold per night...") it does not ship — that
register is a hard no on this project, not a style preference.

## Copy

- **No `CardDescription`, no `<p>` under a heading or a field, full stop.**
  This was previously "add one only if it states a real constraint" — that
  carve-out is exactly what let text like this ship, twice, on the same
  page, and it is now retired. Do not write it even when the sentence is
  true and the behavior is non-obvious. Banned on sight, verbatim examples
  that were shipped and had to be cut:
  - "Existing bookings are never lost when you re-run this."
  - "No caps set — every night is currently unrestricted."
  - "0 blocks the dates (maintenance, private events)."
  - "Nights that already have bookings keep their cap — only unbooked
    nights are cleared."
  - "Nights without a cap are open-ended: bookings are accepted without
    limit..."
  - "2 managers — hidden until viewed." (narrating a collapsed section's
    own state, when the count badge and the View/Hide toggle sitting right
    next to it already say exactly that)
  - "Add at least one photo so customers can see what they're booking."
    (GalleryManager's empty state — "No photos yet" alone was already
    enough; the dropzone right above it is the call to action)
  - "Shown on the public Hotels/Events & Halls/Umrah pages once
    published." (a `DialogDescription` under "Add hotel"/"Add venue"/"Add
    Umrah package" — shipped identically in three separate admin forms)
  - "No active agencies yet — approved agencies will appear here."
  - "Deposits, booking payments, refunds, and notes will appear here as
    they happen." (agent statement empty state)
  - "This booking hasn't been paid yet, so you can cancel it yourself at
    no cost." (sitting directly above a Cancel button that already is
    that affordance)
  These five shipped together, discovered in one sweep of files sitting
  near unrelated work rather than newly written — self-checking only the
  text you just typed is not enough; see [[sts-somalia-iso-copy-standard]]
  for the mandatory grep-the-touched-directory step this requires now.
  If a sentence *explains how a feature behaves*, *reassures about a
  consequence*, or *narrates a UI state the controls on screen already
  show* (a badge, a toggle's own label, a loading spinner, a disabled
  state), it is this pattern regardless of how short or how true it is —
  cut it. This applies to dynamically-rendered strings exactly as much as
  static JSX — "is this still true" is not the test, "does something
  already visible say it" is. A user learns behavior by using the control,
  from its label, or from an inline validation error when they hit the
  edge case — not from standing prose above or beside it. Before shipping
  any new UI text, read every other element already on screen and ask
  whether it already says this; if yes, the text is dead weight, not
  redundant confirmation.
- A heading stands alone: `<h2>`/`CardTitle` text and nothing under it.
  If you catch yourself writing a second sentence under any heading in
  this codebase, stop and delete it before finishing the edit — do not
  leave it for a later pass.
- If a value genuinely needs a caveat (e.g. what "0" means in a numeric
  field), it goes in the `placeholder` or is implied by a `min`/disabled
  state — not a caption line. If neither can carry it, it does not belong
  on this screen at all.
- Error and success messages: one line, plain, no filler ("Manager added."
  not "The manager has been successfully added to this hotel.").

## Structure

- Don't wrap every section in `<Card><CardHeader><CardTitle><Icon/>Title
  </CardTitle></CardHeader>` — that repeated icon-in-a-title pattern
  *is* the generic-AI-dashboard tell. Reserve a full Card treatment for
  genuinely card-like content (a compact info panel, a settings block).
  A table section, or a list under a plain `<h2 className="font-heading
  text-base font-semibold">`, needs no icon and no card header at all.
- One heading idiom per page. If some sections use a plain `<h2>` and
  others use `CardTitle` with an icon, that inconsistency reads as
  assembled, not designed — pick one and use it everywhere on the page.
- Group related compact panels side by side (`grid lg:grid-cols-2`)
  instead of stacking everything full-width in one column. Full-width
  stacking of unrelated small panels is the single biggest tell of an
  unplanned layout.
- A detail page for an entity (hotel, agency, partner account, ...) gets:
  a header (name + status badge + one-line meta: location · owner ·
  rating-style facts, joined with `·`, no bullet list), then an
  at-a-glance stat rail (`dl` of label/value pairs in a
  `bg-secondary/40` strip) before any section content — so the page
  answers "what's here" before the reader opens anything.
- Back navigation is one icon (`ArrowLeft`, `size-3.5`) plus a short
  label, styled as `text-sm text-muted-foreground hover:text-foreground`.
  Never a multi-segment breadcrumb trail (`Home > X > Y`) and never a
  second "Back to X" button elsewhere on the same page — one way back, in
  one place, top of the page.
- Don't nest a bordered box inside a Card's own content — Card already
  supplies the boundary (`ring-1 ring-foreground/10`). A list inside a
  card just needs `divide-y divide-border`, not its own `rounded-lg
  border`.

## Permissions / toggles

- A boolean capability (can this person do X) is a single click, not a
  form-then-save round trip: a small pill/chip button that submits
  immediately and re-renders in its new state, styled filled+primary
  when granted, outline+muted when not.

## Reuse before inventing

- Check `src/components/ui` and nearby pages in the same portal for an
  existing pattern before creating a new visual treatment. This project's
  tokens live in `src/app/globals.css` (`--primary`, `--brand-gold` for
  ratings, `--brand-accent` reserved for marketing only, `--radius`) —
  don't introduce new colors or spacing scales for an admin page.
