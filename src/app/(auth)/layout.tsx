import Link from "next/link";
import { Plane } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-secondary/30 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Plane className="size-5" />
        </span>
        <span className="font-heading text-lg font-semibold text-foreground">STS Somalia</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
