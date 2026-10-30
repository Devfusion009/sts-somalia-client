import { useId } from "react";

export type VisaScene = "destination" | "application" | "review" | "decision" | "passport" | "photo" | "funds" | "flight" | "stay" | "insurance" | "tracking" | "family" | "payment" | "support" | "appointment" | "invitation";

/** Small, static SVG scenes: no image downloads, animation loop or canvas runtime. */
export function VisaIllustration({ scene, className }: { scene: VisaScene; className?: string }) {
  const id = useId().replace(/:/g, "");
  const teal = `url(#${id}-teal)`;
  const paper = `url(#${id}-paper)`;
  const gold = `url(#${id}-gold)`;
  const shadow = `url(#${id}-shadow)`;
  const ink = "#0c5547";
  const line = "#b6d0c2";
  const globe = (
    <g fill="none" stroke="#c8b07d" strokeWidth="1.3">
      <circle cx="140" cy="92" r="35" /><ellipse cx="140" cy="92" rx="15" ry="35" />
      <path d="M105 92h70M110 76h60M110 108h60" />
    </g>
  );
  const booklet = (
    <g transform="rotate(-12 140 100)" filter={shadow}>
      <rect x="91" y="26" width="104" height="144" rx="10" fill="#062f28" />
      <rect x="85" y="22" width="104" height="144" rx="10" fill={teal} />
      <path d="M96 26v136" stroke="#8bb6a2" strokeOpacity=".4" />
      <rect x="103" y="34" width="74" height="116" rx="5" fill="none" stroke="#d3bc88" strokeOpacity=".5" />
      {globe}
      <path d="M122 137h36M129 143h22" stroke="#dcc591" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
  const sheet = (
    <g filter={shadow}>
      <rect x="78" y="31" width="125" height="147" rx="12" fill="#c7d9ca" transform="rotate(-8 140 100)" />
      <rect x="68" y="23" width="125" height="147" rx="12" fill={paper} stroke="#d8e2d6" />
      <rect x="84" y="40" width="36" height="8" rx="4" fill={teal} />
      <path d="M85 65h90M85 73h59" stroke={line} strokeWidth="4" strokeLinecap="round" />
      {[92, 117, 142].map(y => <g key={y}><rect x="84" y={y - 7} width="12" height="12" rx="3" fill="#dcece2" /><path d={`M106 ${y}h66`} stroke={line} strokeWidth="4" strokeLinecap="round" /></g>)}
    </g>
  );
  const seal = (x: number, y: number) => (
    <g transform={`translate(${x} ${y})`} filter={shadow}>
      <circle r="27" fill={teal} stroke="#e9f2e8" strokeWidth="4" />
      <circle r="18" fill="none" stroke="#b6d2bc" strokeOpacity=".5" />
      <path d="m-9 0 6 6L10-7" fill="none" stroke="#f8f4df" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  const person = (x: number, y: number, scale: number, light = false) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cy="-15" r="14" fill={light ? "#a4c5af" : teal} />
      <path d="M-26 35v-8a26 26 0 0 1 52 0v8z" fill={light ? "#a4c5af" : teal} />
    </g>
  );
  const plane = <path d="m-21 1 17-3 7-21 5 1-2 21 16 6-1 4-17-1-7 10-4-1 3-12-17-1z" fill="#c89456" stroke="#f7ebd5" strokeWidth="1" />;

  const scenes: Record<VisaScene, React.ReactNode> = {
    appointment: <>{sheet}<g transform="translate(184 111)" filter={shadow}><rect x="-39" y="-40" width="79" height="77" rx="9" fill={paper} stroke={line} /><path d="M-39-29a11 11 0 0 1 11-11h57a11 11 0 0 1 11 11v12h-79" fill={teal} /><path d="M-20-48v16M20-48v16" stroke="#c6a16b" strokeWidth="5" strokeLinecap="round" />{[-19,0,19].map(x => [-3,15].map(y => <rect key={`${x}-${y}`} x={x-4} y={y} width="8" height="8" rx="2" fill={x===19 ? "#c6a16b" : "#b4cdb8"} />))}</g></>,
    invitation: <><g transform="rotate(-8 140 100)" filter={shadow}><rect x="87" y="24" width="110" height="126" rx="9" fill={paper} stroke={line} /><path d="M105 48h65M105 59h43M105 80h65M105 91h65" stroke={line} strokeWidth="4" strokeLinecap="round" /><path d="m57 85 84 43 84-43v75a12 12 0 0 1-12 12H69a12 12 0 0 1-12-12z" fill={teal} /><path d="m57 164 65-53m103 53-65-53" stroke="#85ad94" strokeWidth="1.5" /></g>{seal(204,143)}</>,
    passport: <>{booklet}<g transform="translate(211 137) rotate(10)"><rect x="-28" y="-20" width="54" height="39" rx="6" fill={paper} stroke={line} /><path d="M-18-7h30M-18 0h22M-18 7h12" stroke={line} strokeWidth="3" strokeLinecap="round" /></g></>,
    destination: <><g transform="translate(0 2)"><circle cx="141" cy="96" r="68" fill="#dce9dd" stroke="#bed3bf" /><g transform="translate(-26 -22) scale(1.2)">{globe}</g><path d="M91 135C84 60 200 41 202 107" fill="none" stroke={ink} strokeWidth="1.5" strokeDasharray="4 5" /><circle cx="91" cy="135" r="5" fill={ink} /><g transform="translate(202 95) rotate(32)">{plane}</g><path d="M148 43c-13 0-22 9-22 22 0 17 22 36 22 36s22-19 22-36c0-13-9-22-22-22" fill={teal} stroke="#eef4e7" strokeWidth="3" /><circle cx="148" cy="65" r="7" fill="#d9c58f" /></g></>,
    application: <>{sheet}<g transform="translate(187 119) rotate(32)" filter={shadow}><rect x="-5" y="-53" width="12" height="86" rx="4" fill={gold} /><path d="m-5 31 6 17 6-17" fill="#c7a475" /><path d="m-1 42 2 6 2-6" fill={ink} /><rect x="-5" y="-53" width="12" height="12" rx="3" fill={teal} /></g></>,
    review: <>{sheet}<g transform="translate(186 119) rotate(-25)" filter={shadow}><rect x="-5" y="25" width="13" height="45" rx="6" fill={teal} /><circle r="36" fill="#e7f1e6" fillOpacity=".92" stroke={ink} strokeWidth="6" /><circle r="26" fill="none" stroke="#b2d0bb" /><path d="m-13 0 9 9 18-19" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M-21-13a24 24 0 0 1 21-11" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" /></g></>,
    decision: <>{booklet}{seal(199, 139)}<path d="m202 32 4-8m10 19 9-3m-10 16 8 4" stroke="#c6a26b" strokeWidth="2" strokeLinecap="round" /></>,
    photo: <><g transform="rotate(-9 140 100)" filter={shadow}><rect x="79" y="25" width="114" height="146" rx="10" fill={paper} stroke="#d8e2d6" /><rect x="90" y="36" width="92" height="108" rx="6" fill="#dcebe0" />{person(136, 89, 1.25)}<path d="M108 157h53" stroke={line} strokeWidth="4" strokeLinecap="round" /></g><g fill="none" stroke="#bc8d53" strokeWidth="3" strokeLinecap="round"><path d="M64 66V49h17m124 79v17h-17M203 61V44h-17M63 130v17h17" /></g></>,
    funds: <>{sheet}<g transform="translate(95 137)"><rect width="13" height="18" rx="3" fill="#89b29b" /><rect x="21" y="-13" width="13" height="31" rx="3" fill="#4c8b71" /><rect x="42" y="-28" width="13" height="46" rx="3" fill={teal} /><rect x="63" y="-42" width="13" height="60" rx="3" fill={gold} /></g><g transform="translate(211 145)" filter={shadow}><circle r="25" fill={gold} stroke="#f9edce" strokeWidth="3" /><circle r="17" fill="none" stroke="#f9edce" /><path d="M0-12v24m8-19H-3a5 5 0 0 0 0 10h6a5 5 0 0 1 0 10H-8" fill="none" stroke="#fff5d7" strokeWidth="2" strokeLinecap="round" /></g></>,
    flight: <><g transform="rotate(-9 140 100)" filter={shadow}><rect x="46" y="49" width="190" height="105" rx="13" fill={paper} stroke={line} /><path d="M59 49h164a13 13 0 0 1 13 13v15H46V62a13 13 0 0 1 13-13" fill={teal} /><path d="M65 63h57" stroke="#b8d4bf" strokeWidth="4" strokeLinecap="round" /><path d="M190 80v66" stroke={line} strokeDasharray="4 4" /><path d="M65 100h32m41 0h30M65 117h49" stroke={line} strokeWidth="5" strokeLinecap="round" /><path d="M65 135h105" stroke={ink} strokeWidth="8" strokeDasharray="2 3 1 3" /><g transform="translate(212 111) scale(.7)">{plane}</g></g></>,
    stay: <><g transform="translate(80 26)" filter={shadow}><path d="m-10 137 9-122 98 0 9 122" fill={paper} stroke={line} /><path d="M-1 15 49-7 98 15" fill={teal} /><rect x="37" y="97" width="25" height="40" rx="3" fill={teal} />{[35, 63].map(y => [16, 42, 68].map(x => <rect key={`${x}-${y}`} x={x} y={y} width="13" height="16" rx="2" fill="#91b7a1" />))}<path d="M-22 138h144" stroke={ink} strokeWidth="4" strokeLinecap="round" /></g><g transform="translate(209 122)" filter={shadow}><rect x="-23" y="-26" width="46" height="65" rx="5" fill={teal} /><rect x="-16" y="-18" width="12" height="9" rx="2" fill={gold} /><path d="M-15 25h28" stroke="#a8c7b1" strokeWidth="3" /></g></>,
    insurance: <>{sheet}<g transform="translate(180 110)" filter={shadow}><path d="m0-45 42 15v34c0 30-42 52-42 52S-42 34-42 4v-34z" fill={teal} stroke="#dce9d7" strokeWidth="4" /><path d="m0-33 31 11v26c0 20-31 39-31 39S-31 24-31 4v-26z" fill="none" stroke="#83ad91" /><path d="M-16 1h32M0-15v32" stroke="#e5cf9c" strokeWidth="9" strokeLinecap="round" /></g></>,
    tracking: <>{sheet}<path d="M91 94v47" stroke="#82b29b" strokeWidth="2" />{[94, 117, 141].map((y,i) => <circle key={y} cx="91" cy={y} r="5" fill={i===2 ? "#c79559" : ink} stroke="#eef4e9" strokeWidth="2" />)}<g transform="translate(205 92)" filter={shadow}><circle r="29" fill={teal} stroke="#dce9d7" strokeWidth="4" /><path d="M0-17V0l12 7" fill="none" stroke="#e1c78d" strokeWidth="3" strokeLinecap="round" /></g></>,
    family: <><path d="M53 154c0-53 37-95 86-95s87 42 87 95" fill="#e2ecdf" /><g filter={shadow}>{person(95, 92, 1.05, true)}{person(184, 92, 1.05, true)}{person(139, 115, 1.15)}</g><path d="m139 26 4 8 9 1-7 7 2 9-8-5-8 5 2-9-7-7 9-1z" fill={gold} /></>,
    payment: <><g transform="rotate(-12 140 100)" filter={shadow}><rect x="63" y="40" width="149" height="100" rx="13" fill={gold} /><rect x="51" y="65" width="164" height="103" rx="13" fill={teal} /><rect x="69" y="85" width="25" height="19" rx="4" fill={gold} /><path d="M69 143h55m14 0h28" stroke="#a9c6b2" strokeWidth="5" strokeLinecap="round" /><path d="M72 90h18m-18 8h18M81 86v17" stroke="#a7844f" strokeWidth="1" /></g>{seal(211, 62)}</>,
    support: <><circle cx="140" cy="95" r="66" fill="#e0ebde" /><g filter={shadow}>{person(140, 107, 1.65)}<path d="M94 97V75a46 46 0 0 1 92 0v22" fill="none" stroke="#c79f64" strokeWidth="9" /><rect x="87" y="81" width="17" height="38" rx="8" fill={teal} /><rect x="176" y="81" width="17" height="38" rx="8" fill={teal} /><path d="M185 112v12c0 12-18 15-31 15" fill="none" stroke="#c79f64" strokeWidth="4" /><rect x="144" y="133" width="19" height="10" rx="5" fill="#e5cb95" /></g></>,
  };

  return (
    <svg viewBox="0 0 280 200" fill="none" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={`${id}-teal`} x1="70" y1="30" x2="210" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#348d72" /><stop offset="1" stopColor="#063c31" /></linearGradient>
        <linearGradient id={`${id}-paper`} x1="65" y1="25" x2="205" y2="175" gradientUnits="userSpaceOnUse"><stop stopColor="#fffef8" /><stop offset="1" stopColor="#edf2e6" /></linearGradient>
        <linearGradient id={`${id}-gold`} x1="60" y1="40" x2="200" y2="170" gradientUnits="userSpaceOnUse"><stop stopColor="#e7d2a1" /><stop offset="1" stopColor="#b88143" /></linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#164e3b" floodOpacity=".16" /></filter>
      </defs>
      <ellipse cx="140" cy="173" rx="83" ry="10" fill="#91b19c" opacity=".13" />
      {scenes[scene]}
    </svg>
  );
}
