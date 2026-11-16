import { Check, X } from "lucide-react";

function PhotoExample({ correct }: { correct: boolean }) {
  return (
    <svg viewBox="0 0 240 170" className="h-auto w-full" aria-hidden="true">
      <rect width="240" height="170" rx="12" fill={correct ? "#edf7f4" : "#f7f2ef"} />
      <rect x="61" y="15" width="118" height="140" rx="9" fill={correct ? "#ffffff" : "#d5d4d0"} stroke="#cadbd5" />
      {!correct ? <ellipse cx="145" cy="84" rx="33" ry="48" fill="#909891" opacity=".45" /> : null}
      <path d="M78 150v-15c0-25 18-40 42-40s42 15 42 40v15" fill="#488b7e" />
      <path d="M108 91v17c7 8 17 8 24 0V91" fill="#e8ba97" />
      <ellipse cx="120" cy="68" rx="27" ry="34" fill="#f2ccad" />
      <path d="M93 66c-7-40 48-51 54-11v12l-8-17c-13 8-25 7-36 1l-10 15" fill="#233f39" />
      <path d="M106 70h5m18 0h5" stroke="#334d45" strokeWidth="3" strokeLinecap="round" />
      <path d="M114 84q6 4 12 0" fill="none" stroke="#b37e67" strokeWidth="2" strokeLinecap="round" />
      {!correct ? <path d="M120 34c20 0 28 17 27 34s-8 33-27 35Z" fill="#34483f" opacity=".38" /> : null}
      {correct ? <path d="M49 39V18h21m100 0h21v21M49 131v21h21m100 0h21v-21" fill="none" stroke="#74b5a2" strokeWidth="2" strokeLinecap="round" /> : null}
    </svg>
  );
}

function PassportExample({ correct }: { correct: boolean }) {
  return (
    <svg viewBox="0 0 240 170" className="h-auto w-full" aria-hidden="true">
      <rect width="240" height="170" rx="12" fill={correct ? "#edf7f4" : "#f7f2ef"} />
      <g transform={correct ? "translate(27 30)" : "translate(8 25) rotate(-7 100 60)"}>
        <rect width="186" height="112" rx="8" fill="#fffefa" stroke="#bbd2c7" strokeWidth="2" />
        <path d="M0 26h186" stroke="#dce9df" />
        <text x="13" y="18" fontSize="9" fontWeight="600" fill="#477268" letterSpacing="2">PASSPORT</text>
        <rect x="13" y="37" width="43" height="48" rx="4" fill="#dcebe4" />
        <circle cx="34" cy="52" r="9" fill="#87b2a1" />
        <path d="M19 80c0-25 30-25 30 0" fill="#87b2a1" />
        {[41, 53, 65, 77].map((y, i) => <rect key={y} x="68" y={y} width={i % 2 ? 75 : 100} height="4" rx="2" fill={correct ? "#799c8c" : "#c8d0c8"} />)}
        {[95, 102].map(y => <path key={y} d={`M13 ${y}h160`} stroke={correct ? "#477268" : "#c8d0c8"} strokeWidth="3" strokeDasharray="2 2" />)}
      </g>
      {!correct ? <><path d="M0 130h240v40H0Z" fill="#e8ded7" /><path d="m160 0 70 170h-35L125 0Z" fill="#ffffff" opacity=".65" /></> : null}
    </svg>
  );
}

export function DocumentGuideArt({ kind }: { kind: "photo" | "passport" }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      {[true, false].map(correct => (
        <figure key={String(correct)} className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="p-2">{kind === "photo" ? <PhotoExample correct={correct} /> : <PassportExample correct={correct} />}</div>
          <figcaption className="space-y-1 px-4 pb-4 text-sm">
            <span className={`flex items-center gap-1.5 font-semibold ${correct ? "text-primary" : "text-destructive"}`}>
              {correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}{correct ? "Correct" : "Avoid"}
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">{kind === "photo" ? correct ? "Even lighting · Plain white background" : "Face shadows · Dark background" : correct ? "Full page · Clear details · All edges visible" : "Cropped page · Glare · Unreadable details"}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
