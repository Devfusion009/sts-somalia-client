import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-secondary/30 px-4 py-12">
      <Link href="/" className="flex items-center">
        <Image src="/logo.png" alt="STS Somalia" width={714} height={312} priority className="h-11 w-auto" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
