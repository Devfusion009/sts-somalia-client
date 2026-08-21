# Marketing photography

All photos sourced from Unsplash (unsplash.com) under the Unsplash License
(free for commercial use, no attribution required — kept here for provenance).
Downloaded 2026-08-10 as 1200–2000px webp.

| File | Unsplash photo ID | Subject |
| --- | --- | --- |
| hero-aircraft.webp | photo-1436491865332-7a61a109cc05 | Aircraft wing at sunset (hero) |
| airport.webp | photo-1569154941061-e231b4725ef1 | Widebody on taxiway |
| hotel.webp | photo-1566073771259-6a8506099945 | Resort pool at dusk |
| hotel-room.webp | photo-1611892440504-42a792e24d32 | Hotel room interior |
| beach.webp | photo-1507525428034-b723cf961d3e | Tropical beach (Mogadishu coast stand-in) |
| dubai.webp | photo-1512453979798-5ea266f8880c | Dubai skyline |
| burj-al-arab.webp | photo-1518684079-3c830dcef090 | Burj Al Arab aerial (unused, spare) |
| istanbul.webp | photo-1524231757912-21f4fe3a7200 | Galata Tower, Istanbul |
| blue-mosque.webp | photo-1466442929976-97f336a657be | Blue Mosque domes, Istanbul |
| madinah.webp | photo-1591604129939-f1efa4d9f7fa | Al-Masjid an-Nabawi, Madinah |
| kenya.webp | photo-1547471080-7cc2caa01a7e | Savanna sunset (Nairobi/Kenya) |
| event-hall.webp | photo-1519167758481-83f550bb49b3 | Ballroom / event hall |
| travel-flatlay.webp | photo-1488646953014-85cb44e25828 | Map + camera trip planning |
| support-team.webp | photo-1600880292203-757bb62b4baf | Office team (support band bg) |

## AI-generated assets (Higgsfield, 2026-08-10)

Generated via the Higgsfield MCP. `flights-skyline.svg` is Recraft V4.1 in
vector mode (STS brand palette passed as `colors`); the rest are Soul Location.
All are original generations, not photographs of the named real places —
treat the destination cards as evocative art direction and swap in licensed
photography of the actual cities before launch if literal accuracy matters.

| File | Model | Subject |
| --- | --- | --- |
| flights-skyline.svg | recraft_v4_1 (vector) | Flat-vector world landmark row on a teal→white gradient sky, for the flights hero |
| hotels-panorama.webp | soul_location | Seafront hotel + coastal promenade panorama at golden hour |
| visa-desk.webp | recraft_v4_1 | Overhead flat lay of blank travel documents (no readable text by design) |
| slide-dunes.webp | soul_location | Desert dunes at sunset — landing carousel |
| slide-gulf-city.webp | soul_location | Gulf metropolis at blue hour — landing carousel |
| slide-coast.webp | soul_location | East African coastline at sunrise — landing carousel |
| events-hall.webp | soul_location | Banquet hall set for a wedding |
| dest-jeddah.webp | soul_location | Red Sea corniche at dusk |
| dest-addis.webp | soul_location | Highland capital at sunrise |
| dest-cairo.webp | soul_location | Nile riverside at sunset |
| dest-kuala-lumpur.webp | soul_location | SE-Asian skyline at blue hour |
| dest-hargeisa.webp | soul_location | Horn of Africa town, late afternoon |

### Third batch (2026-08-10) — hotel & backdrop imagery

| File | Model | Subject |
| --- | --- | --- |
| flights-hero-bg.webp | soul_location | Dark cloudscape at dusk — flights hero backdrop (deliberately near-empty so overlaid text stays readable) |
| hotels-hero-bg.webp | soul_location | Grand hotel facade at golden hour — hotels hero backdrop |
| hotel-lobby / -pool / -breakfast / -budget / -suite / -exterior / -reception / -terrace / -family / -business .webp | soul_location | Hotel interiors and exteriors for the property rails |

### Fourth batch (2026-08-14) — 2 more landing carousel slides

| File | Model | Subject |
| --- | --- | --- |
| slide-istanbul.webp | soul_location | Bosphorus suspension bridge at blue hour, distant mosque silhouettes — landing carousel |
| slide-nairobi.webp | soul_location | Distant East African city skyline silhouette at golden hour — landing carousel |

First Nairobi generation was discarded before use: it rendered legible (and garbled) building signage resembling a real corporate tenant, and was cluttered with rooftop equipment — regenerated with an explicit "no readable text/signage, uncluttered" prompt.

These depict generic hospitality settings, not the actual partner properties.
Swap for real photography of each hotel before launch — a guest seeing a room
that isn't the one they booked is a trust problem, not just a design one.

### Umrah landing imagery (2026-08-19)

| File | Source | Subject |
| --- | --- | --- |
| umrah-private.webp | copy of `supabase/seed-assets/umrah/pilgrims-courtyard.webp` | Two pilgrims in ihram crossing an empty mosque courtyard — the "Individual / Private Umrah" card on /umrah |
| umrah-private-courtyard.webp | copy of `supabase/seed-assets/umrah/mosque-courtyard-day.webp` | Wide sunlit mosque courtyard, one figure crossing it — the /umrah/private hero (picked over the dusk shots because the copy column needs a bright left third and the subject kept to the right) |

Copied into `public/` rather than referenced from Storage because these have to
render for anonymous visitors in every environment, including before
`npm run seed:storage` has ever run — the same reasoning as the note in
`src/modules/umrah/images.ts`.

Provenance of the `supabase/seed-assets/umrah/*` set was never recorded here;
it predates this file's AI-batch sections and these two images are already
shipped as package-gallery photos via `supabase/seed.sql`, so putting one on
the landing page adds no licensing exposure that the catalog didn't already
carry. Worth pinning down before launch all the same.
