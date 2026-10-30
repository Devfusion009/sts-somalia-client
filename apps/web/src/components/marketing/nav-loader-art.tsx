/**
 * Illustrations for the navigation loader, one per header section. Each is a
 * 96x96 line drawing in white with teal and orange accents; motion comes from
 * the `nav-fx-*` classes in globals.css (all of them gated on
 * prefers-reduced-motion), so a reduced-motion visitor sees the still frame.
 */

const ACCENT = "var(--brand-accent)";
const MINT = "var(--sidebar-primary)";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className="size-20" aria-hidden>
      {children}
    </svg>
  );
}

export function FlightArt() {
  const arc = "M10 72C24 22 62 12 88 34";
  return (
    <Frame>
      <path id="nav-flight-arc" d={arc} stroke="white" strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 6" />
      <path d={arc} stroke={MINT} strokeWidth="2.5" strokeLinecap="round" pathLength="1" strokeDasharray="1" className="nav-fx-draw" />
      <g>
        <path
          d="M-10 -1.8 L1 -1.8 L-3 -9 L0 -9 L8 -1.8 L10.5 -1.8 Q13 0 10.5 1.8 L8 1.8 L0 9 L-3 9 L1 1.8 L-10 1.8 Z"
          fill="white"
        />
        <animateMotion dur="2.6s" repeatCount="indefinite" rotate="auto" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1">
          <mpath href="#nav-flight-arc" />
        </animateMotion>
      </g>
      <circle cx="10" cy="72" r="3" fill={ACCENT} />
      <circle cx="88" cy="34" r="3" fill="white" fillOpacity=".5" />
    </Frame>
  );
}

const WINDOW_COLUMNS = [31, 44, 57];
const WINDOW_ROWS = [26, 40, 54];

export function HotelArt() {
  return (
    <Frame>
      <rect x="26" y="16" width="44" height="66" rx="6" stroke="white" strokeWidth="2" fill="white" fillOpacity=".05" />
      <path d="M26 24h44" stroke="white" strokeOpacity=".35" strokeWidth="2" />
      {WINDOW_ROWS.flatMap((y, row) =>
        WINDOW_COLUMNS.map((x, col) => (
          <rect
            key={`${row}-${col}`}
            x={x}
            y={y}
            width="8"
            height="9"
            rx="1.6"
            fill={ACCENT}
            className="nav-fx-window"
            style={{ animationDelay: `${(row * 3 + col) * 0.16}s` }}
          />
        ))
      )}
      <path d="M42 82V70a6 6 0 0 1 12 0v12" stroke="white" strokeWidth="2" />
      <path d="M12 82h72" stroke="white" strokeOpacity=".3" strokeWidth="2" strokeLinecap="round" />
      <path d="M80 18l1.6 4.4L86 24l-4.4 1.6L80 30l-1.6-4.4L74 24l4.4-1.6z" fill={MINT} className="nav-fx-twinkle" />
    </Frame>
  );
}

export function VisaArt() {
  return (
    <Frame>
      <rect x="20" y="14" width="44" height="60" rx="6" stroke="white" strokeWidth="2" fill="white" fillOpacity=".06" />
      <circle cx="42" cy="36" r="10" stroke={MINT} strokeWidth="2" />
      <ellipse cx="42" cy="36" rx="4.2" ry="10" stroke={MINT} strokeWidth="1.5" />
      <path d="M32 36h20" stroke={MINT} strokeWidth="1.5" />
      <rect x="30" y="54" width="24" height="3.5" rx="1.75" fill="white" fillOpacity=".7" />
      <rect x="30" y="61" width="15" height="3.5" rx="1.75" fill="white" fillOpacity=".4" />
      <g className="nav-fx-stamp">
        <circle cx="66" cy="62" r="15" fill="var(--sidebar)" fillOpacity=".85" />
        <circle cx="66" cy="62" r="15" stroke={ACCENT} strokeWidth="3" strokeDasharray="3.2 2.6" />
        <path d="M58.5 62.5l5.5 5.5 10-11.5" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

export function UmrahArt() {
  return (
    <Frame>
      <ellipse cx="48" cy="52" rx="20" ry="16" fill={MINT} className="nav-fx-glow" />
      <rect x="26" y="56" width="44" height="26" rx="2" stroke="white" strokeWidth="2" fill="white" fillOpacity=".05" />
      <path d="M28 56a20 20 0 0 1 40 0" stroke="white" strokeWidth="2" fill="white" fillOpacity=".08" />
      <path d="M48 36v-6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M49 14A6 6 0 1 0 49 26A8 8 0 0 1 49 14Z" fill={ACCENT} transform="translate(0 3)" className="nav-fx-sway" />
      <path d="M43 82V71a5 5 0 0 1 10 0v11" stroke="white" strokeWidth="2" />
      <rect x="13" y="42" width="6" height="40" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity=".05" />
      <path d="M13 42l3-9 3 9" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <rect x="77" y="42" width="6" height="40" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity=".05" />
      <path d="M77 42l3-9 3 9" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 82h72" stroke="white" strokeOpacity=".3" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="22" r="1.8" fill="white" className="nav-fx-twinkle" />
      <circle cx="74" cy="20" r="1.8" fill="white" className="nav-fx-twinkle" style={{ animationDelay: ".6s" }} />
      <circle cx="68" cy="32" r="1.4" fill={MINT} className="nav-fx-twinkle" style={{ animationDelay: "1.1s" }} />
    </Frame>
  );
}

const CONFETTI = [
  { x: 20, y: 40, c: ACCENT, s: "rect" },
  { x: 30, y: 26, c: MINT, s: "dot" },
  { x: 42, y: 18, c: "white", s: "rect" },
  { x: 56, y: 16, c: ACCENT, s: "dot" },
  { x: 68, y: 24, c: MINT, s: "rect" },
  { x: 77, y: 38, c: "white", s: "dot" },
  { x: 14, y: 56, c: MINT, s: "dot" },
  { x: 82, y: 56, c: ACCENT, s: "rect" },
] as const;

export function EventsArt() {
  return (
    <Frame>
      <path d="M18 6L8 72h26z" fill="white" fillOpacity=".08" className="nav-fx-beam-left" />
      <path d="M78 6l10 66H62z" fill="white" fillOpacity=".08" className="nav-fx-beam-right" />
      {CONFETTI.map((piece, i) => (
        <g key={i} className="nav-fx-confetti" style={{ animationDelay: `${i * 0.24}s` }}>
          {piece.s === "dot" ? (
            <circle cx={piece.x} cy={piece.y} r="2.4" fill={piece.c} />
          ) : (
            <rect x={piece.x - 2} y={piece.y - 3} width="4" height="6" rx="1" fill={piece.c} />
          )}
        </g>
      ))}
      <path
        d="M48 26l5.2 13.8L67 45l-13.8 5.2L48 64l-5.2-13.8L29 45l13.8-5.2z"
        fill={ACCENT}
        className="nav-fx-sparkle"
      />
      <rect x="20" y="72" width="56" height="9" rx="3" stroke="white" strokeWidth="2" fill="white" fillOpacity=".06" />
      <path d="M12 86h72" stroke="white" strokeOpacity=".3" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  );
}
