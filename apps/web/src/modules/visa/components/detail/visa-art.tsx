import { cn } from "@/lib/utils";

/**
 * Illustrations for the visa detail page: one scene per required document and
 * one per application step. Layered paper, soft depth and the brand's teal,
 * orange and gold. Decorative only. All scenes reference one shared set of
 * gradients and a shadow filter, defined once by <VisaArtDefs /> on the page.
 */

export function VisaArtDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="va-teal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a9b85" />
          <stop offset="1" stopColor="#073c34" />
        </linearGradient>
        <linearGradient id="va-teal-soft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f6ed" />
          <stop offset="1" stopColor="#d9e6db" />
        </linearGradient>
        <linearGradient id="va-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e8eee4" />
        </linearGradient>
        <linearGradient id="va-orange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#deb985" />
          <stop offset="1" stopColor="#bb7950" />
        </linearGradient>
        <linearGradient id="va-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6d0a5" />
          <stop offset="1" stopColor="#bc9459" />
        </linearGradient>
        <linearGradient id="va-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f4a40" />
          <stop offset="1" stopColor="#06231e" />
        </linearGradient>
        <radialGradient id="va-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5a9b85" stopOpacity="0.12" />
          <stop offset="1" stopColor="#5a9b85" stopOpacity="0" />
        </radialGradient>
        <filter id="va-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#06312a" floodOpacity="0.16" />
        </filter>
        <filter id="va-shadow-sm" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#06312a" floodOpacity="0.2" />
        </filter>
      </defs>
    </svg>
  );
}

type ArtProps = { className?: string };

const SVG = "h-full w-full overflow-visible";

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

/** Passport: booklet with an emblem, a gold globe and a stamped corner. */
function PassportArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="80" cy="60" rx="64" ry="50" fill="url(#va-glow)" />
      <g transform="rotate(-6 80 60)" filter="url(#va-shadow)">
        <rect x="46" y="12" width="68" height="94" rx="7" fill="#04382f" />
        <rect x="44" y="10" width="68" height="94" rx="7" fill="url(#va-teal)" />
        <path d="M52 10v94" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
        <rect x="52" y="16" width="52" height="82" rx="4" fill="none" stroke="url(#va-gold)" strokeWidth="1.4" strokeOpacity=".8" />
        <circle cx="78" cy="48" r="17" fill="none" stroke="url(#va-gold)" strokeWidth="2.4" />
        <ellipse cx="78" cy="48" rx="7" ry="17" fill="none" stroke="url(#va-gold)" strokeWidth="1.6" />
        <path d="M61 48h34M64 39h28M64 57h28" stroke="url(#va-gold)" strokeWidth="1.5" fill="none" />
        <rect x="62" y="74" width="32" height="4" rx="2" fill="url(#va-gold)" />
        <rect x="68" y="82" width="20" height="3" rx="1.5" fill="url(#va-gold)" opacity=".6" />
      </g>
      <g transform="rotate(14 120 86)">
        <circle cx="120" cy="86" r="17" fill="none" stroke="url(#va-orange)" strokeWidth="3" />
        <circle cx="120" cy="86" r="12" fill="none" stroke="url(#va-orange)" strokeWidth="1.2" strokeDasharray="2 2.4" />
        <path d="M113 87l5 5 9-11" fill="none" stroke="url(#va-orange)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>


    </svg>
  );
}

/** Bio page: photo, holder lines and the machine-readable strip. */
function BioPageArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="80" cy="62" rx="66" ry="48" fill="url(#va-glow)" />
      <g transform="rotate(-4 80 60)" filter="url(#va-shadow)">
        <rect x="18" y="18" width="124" height="84" rx="9" fill="url(#va-paper)" />
        <rect x="18" y="18" width="124" height="84" rx="9" fill="none" stroke="#0a8f79" strokeOpacity=".25" strokeWidth="1.2" />
        <path d="M18 27a9 9 0 0 1 9-9h106a9 9 0 0 1 9 9v6H18z" fill="url(#va-teal)" />
        <rect x="26" y="22" width="30" height="4" rx="2" fill="#fff" opacity=".85" />
        <rect x="28" y="42" width="34" height="42" rx="5" fill="url(#va-teal-soft)" stroke="#0a8f79" strokeOpacity=".35" />
        <circle cx="45" cy="57" r="8" fill="url(#va-teal)" />
        <path d="M30 84c1-13 8-17 15-17s14 4 15 17z" fill="url(#va-teal)" />
        <rect x="72" y="42" width="52" height="5" rx="2.5" fill="#0a8f79" opacity=".75" />
        <rect x="72" y="52" width="38" height="4" rx="2" fill="#0a8f79" opacity=".3" />
        <rect x="72" y="61" width="46" height="4" rx="2" fill="#0a8f79" opacity=".3" />
        <rect x="72" y="70" width="30" height="4" rx="2" fill="#0a8f79" opacity=".3" />
        <rect x="26" y="90" width="106" height="3" rx="1.5" fill="url(#va-gold)" />
        <rect x="26" y="95" width="88" height="3" rx="1.5" fill="url(#va-gold)" opacity=".55" />
      </g>


    </svg>
  );
}

/** Photograph: framed portrait with crop marks. */
function PhotoArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="80" cy="62" rx="62" ry="50" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)" transform="rotate(5 80 60)">
        <rect x="46" y="12" width="68" height="92" rx="6" fill="#fff" />
        <rect x="46" y="12" width="68" height="92" rx="6" fill="none" stroke="#0a8f79" strokeOpacity=".25" />
        <rect x="52" y="18" width="56" height="64" rx="3" fill="url(#va-teal-soft)" />
        <circle cx="80" cy="43" r="13" fill="url(#va-teal)" />
        <path d="M54 82c1-17 12-24 26-24s25 7 26 24z" fill="url(#va-teal)" />
        <rect x="58" y="90" width="44" height="4" rx="2" fill="#0a8f79" opacity=".35" />
        <rect x="68" y="97" width="24" height="3" rx="1.5" fill="#0a8f79" opacity=".2" />
      </g>
      <path d="M34 28h-8v8M126 28h8v8M34 94h-8v-8M126 94h8v-8" fill="none" stroke="url(#va-orange)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />

    </svg>
  );
}

/** Bank statement: ledger rows, a rising bar chart and a coin. */
function StatementArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="80" cy="62" rx="66" ry="50" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)" transform="rotate(-3 70 60)">
        <rect x="26" y="10" width="86" height="100" rx="8" fill="url(#va-paper)" />
        <rect x="26" y="10" width="86" height="100" rx="8" fill="none" stroke="#0a8f79" strokeOpacity=".25" />
        <rect x="34" y="18" width="34" height="7" rx="3.5" fill="url(#va-teal)" />
        {[34, 46, 58].map((y, i) => (
          <g key={y}>
            <rect x="34" y={y} width="38" height="4.5" rx="2.25" fill="#0a8f79" opacity=".22" />
            <rect x="82" y={y} width={22 - i * 3} height="4.5" rx="2.25" fill="#0a8f79" opacity=".5" />
          </g>
        ))}
        <path d="M34 74h70" stroke="#0a8f79" strokeOpacity=".3" strokeDasharray="3 3" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={36 + i * 17} y={98 - (10 + i * 7)} width="11" height={10 + i * 7} rx="2.5" fill={i === 3 ? "url(#va-orange)" : "url(#va-teal)"} />
        ))}
      </g>
      <g filter="url(#va-shadow-sm)">
        <circle cx="122" cy="82" r="20" fill="url(#va-gold)" />
        <circle cx="122" cy="82" r="15" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" />
        <path d="M122 72v20M116.5 77.5c0-3 11-3 11 .5s-11 3.5-11 7 11 3 11 .5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </g>

    </svg>
  );
}

/** Flight or hotel booking: boarding pass with a plane. */
function TicketArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="80" cy="64" rx="68" ry="48" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)" transform="rotate(-5 80 60)">
        <path
          d="M16 34a9 9 0 0 1 9-9h110a9 9 0 0 1 9 9v16a8 8 0 0 0 0 16v16a9 9 0 0 1-9 9H25a9 9 0 0 1-9-9V66a8 8 0 0 0 0-16z"
          fill="url(#va-paper)"
        />
        <path d="M16 34a9 9 0 0 1 9-9h110a9 9 0 0 1 9 9v10H16z" fill="url(#va-teal)" />
        <rect x="26" y="31" width="38" height="4.5" rx="2.25" fill="#fff" opacity=".9" />
        <path d="M108 25v70" stroke="#0a8f79" strokeOpacity=".4" strokeWidth="1.6" strokeDasharray="4 4" />
        <rect x="26" y="54" width="34" height="9" rx="3" fill="#0a8f79" opacity=".8" />
        <rect x="70" y="54" width="26" height="9" rx="3" fill="#0a8f79" opacity=".2" />
        <rect x="26" y="72" width="22" height="4" rx="2" fill="#0a8f79" opacity=".3" />
        <rect x="54" y="72" width="30" height="4" rx="2" fill="#0a8f79" opacity=".3" />
        {Array.from({ length: 11 }).map((_, i) => (
          <rect key={i} x={26 + i * 4.4} y="84" width={i % 3 === 0 ? 2.6 : 1.4} height="9" fill="#0a8f79" opacity=".55" />
        ))}
        <path d="M119 66h20M133 56l11 10-11 10" fill="none" stroke="url(#va-orange)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

    </svg>
  );
}

/** Letter: letterhead lines and an approval seal. */
function LetterArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="80" cy="62" rx="62" ry="50" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)" transform="rotate(-4 70 60)">
        <rect x="32" y="10" width="78" height="100" rx="8" fill="url(#va-paper)" />
        <rect x="32" y="10" width="78" height="100" rx="8" fill="none" stroke="#0a8f79" strokeOpacity=".25" />
        <rect x="40" y="19" width="26" height="6" rx="3" fill="url(#va-teal)" />
        {[34, 43, 52, 61, 70].map((y, i) => (
          <rect key={y} x="40" y={y} width={i === 4 ? 30 : 62} height="3.6" rx="1.8" fill="#0a8f79" opacity=".24" />
        ))}
      </g>
      <g filter="url(#va-shadow-sm)">
        <circle cx="106" cy="86" r="21" fill="url(#va-orange)" />
        <circle cx="106" cy="86" r="16" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" strokeDasharray="2.4 2.6" />
        <path d="M97 87l7 7 12-14" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

    </svg>
  );
}

/** Picks the illustration that matches a document's name. */
export function DocumentArt({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  if (/photo|picture|selfie/.test(text)) return <PhotoArt className={className} />;
  if (/bio|data page|information page/.test(text)) return <BioPageArt className={className} />;
  if (/passport/.test(text)) return <PassportArt className={className} />;
  if (/bank|statement|salary|income|financ|fund|payslip/.test(text)) return <StatementArt className={className} />;
  if (/flight|itinerar|ticket|hotel|booking|reservation|invitation/.test(text)) return <TicketArt className={className} />;
  return <LetterArt className={className} />;
}

/* ------------------------------------------------------------------ */
/* Application steps                                                   */
/* ------------------------------------------------------------------ */

/** Fill the application: a form on a device with a pen. */
function FormStep({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="100" cy="82" rx="86" ry="60" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)">
        <rect x="48" y="14" width="86" height="118" rx="11" fill="url(#va-night)" />
        <rect x="53" y="19" width="76" height="108" rx="7" fill="url(#va-paper)" />
        <rect x="60" y="27" width="34" height="7" rx="3.5" fill="url(#va-teal)" />
        {[42, 62, 82].map((y, i) => (
          <g key={y}>
            <rect x="60" y={y} width="62" height="13" rx="4" fill="url(#va-teal-soft)" stroke="#0a8f79" strokeOpacity=".3" />
            <rect x="65" y={y + 4.5} width={34 - i * 5} height="4" rx="2" fill="#0a8f79" opacity=".55" />
          </g>
        ))}
        <rect x="60" y="103" width="62" height="14" rx="7" fill="url(#va-orange)" />
        <rect x="76" y="108.5" width="30" height="3.4" rx="1.7" fill="#fff" opacity=".9" />
      </g>
      <g filter="url(#va-shadow-sm)" transform="rotate(32 150 92)">
        <rect x="142" y="52" width="14" height="66" rx="4" fill="url(#va-orange)" />
        <path d="M142 118l7 14 7-14z" fill="#ffe2c2" />
        <path d="M147 126l2 6 2-6z" fill="#06312a" />
        <rect x="142" y="52" width="14" height="10" rx="4" fill="url(#va-gold)" />
      </g>



    </svg>
  );
}

/** Upload documents: a cloud receiving files. */
function UploadStep({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="100" cy="84" rx="88" ry="58" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)">
        <path d="M54 98a24 24 0 0 1 5-47 34 34 0 0 1 64-4 26 26 0 0 1 8 51z" fill="url(#va-teal-soft)" />
        <path d="M54 98a24 24 0 0 1 5-47 34 34 0 0 1 64-4 26 26 0 0 1 8 51z" fill="none" stroke="#0a8f79" strokeOpacity=".35" strokeWidth="1.6" />
      </g>
      <g filter="url(#va-shadow-sm)">
        <circle cx="96" cy="76" r="26" fill="url(#va-teal)" />
        <circle cx="96" cy="76" r="26" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2" />
        <path d="M96 90V62M84 73l12-12 12 12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="rotate(-12 150 100)" filter="url(#va-shadow-sm)">
        <rect x="136" y="82" width="34" height="44" rx="5" fill="url(#va-paper)" stroke="#bb7950" strokeWidth="2.4" />
        <path d="M158 82l12 12h-12z" fill="url(#va-orange)" />
        <rect x="142" y="100" width="22" height="3.6" rx="1.8" fill="#bb7950" opacity=".55" />
        <rect x="142" y="108" width="16" height="3.6" rx="1.8" fill="#bb7950" opacity=".35" />
      </g>
      <g transform="rotate(10 46 112)" filter="url(#va-shadow-sm)">
        <rect x="32" y="96" width="30" height="38" rx="5" fill="url(#va-paper)" stroke="#0a8f79" strokeWidth="2" />
        <circle cx="47" cy="111" r="6" fill="url(#va-teal)" />
        <path d="M37 128c1-8 5-10 10-10s9 2 10 10z" fill="url(#va-teal)" />
      </g>


    </svg>
  );
}

/** Pay: card, phone and a confirmed payment. */
function PayStep({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="100" cy="84" rx="88" ry="58" fill="url(#va-glow)" />
      <g filter="url(#va-shadow)" transform="rotate(-8 70 80)">
        <rect x="22" y="40" width="98" height="62" rx="10" fill="url(#va-teal)" />
        <rect x="22" y="54" width="98" height="12" fill="#04382f" opacity=".45" />
        <rect x="32" y="78" width="40" height="7" rx="3.5" fill="#fff" opacity=".85" />
        <rect x="32" y="90" width="24" height="4.4" rx="2.2" fill="#fff" opacity=".5" />
        <rect x="32" y="46" width="18" height="4" rx="2" fill="#fff" opacity=".7" />
        <circle cx="96" cy="86" r="9" fill="url(#va-orange)" />
        <circle cx="106" cy="86" r="9" fill="url(#va-gold)" opacity=".92" />
      </g>
      <g filter="url(#va-shadow)">
        <rect x="108" y="16" width="52" height="108" rx="11" fill="url(#va-night)" />
        <rect x="112.5" y="21" width="43" height="98" rx="7.5" fill="url(#va-paper)" />
        <rect x="124" y="23.5" width="20" height="4" rx="2" fill="#06231e" opacity=".5" />
        <rect x="119" y="34" width="30" height="12" rx="4" fill="url(#va-teal-soft)" />
        <rect x="123" y="38.5" width="14" height="3.4" rx="1.7" fill="#0a8f79" opacity=".7" />
        <circle cx="134" cy="80" r="17" fill="url(#va-orange)" />
        <path d="M125.5 80l6 6 11-12" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="120" y="104" width="28" height="7" rx="3.5" fill="url(#va-teal)" />
      </g>


    </svg>
  );
}

/** We handle the rest: a protective shield, approved. */
function DoneStep({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 150" className={cn(SVG, className)} aria-hidden>
      <ellipse cx="100" cy="84" rx="88" ry="58" fill="url(#va-glow)" />
      <circle cx="100" cy="76" r="61" fill="none" stroke="#9db9a9" strokeWidth="0.8" />
      <circle cx="100" cy="76" r="68" fill="none" stroke="#9db9a9" strokeWidth="0.6" strokeDasharray="2 5" />
      <g filter="url(#va-shadow)">
        <path d="M100 14l44 15v32c0 30-19 48-44 59-25-11-44-29-44-59V29z" fill="url(#va-teal)" />
        <path d="M100 14l44 15v32c0 30-19 48-44 59z" fill="#04382f" opacity=".22" />
        <path d="M100 24l35 12v25c0 23-15 38-35 47-20-9-35-24-35-47V36z" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" />
        <path d="M80 70l14 14 28-30" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g filter="url(#va-shadow-sm)">
        <circle cx="152" cy="30" r="14" fill="url(#va-orange)" />
        <path d="M145 30l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g filter="url(#va-shadow-sm)" transform="rotate(-14 40 110)">
        <rect x="22" y="96" width="38" height="28" rx="5" fill="url(#va-paper)" stroke="#0a8f79" strokeWidth="1.8" />
        <rect x="28" y="103" width="18" height="3.6" rx="1.8" fill="#0a8f79" opacity=".6" />
        <rect x="28" y="110" width="26" height="3.2" rx="1.6" fill="#0a8f79" opacity=".3" />
        <circle cx="52" cy="116" r="6" fill="none" stroke="url(#va-orange)" strokeWidth="2.2" />
      </g>



    </svg>
  );
}

export const STEP_ART = [FormStep, UploadStep, PayStep, DoneStep];
