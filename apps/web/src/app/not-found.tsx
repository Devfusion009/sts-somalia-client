import { Button } from "@/components/ui/button";
import { AuthLogo } from "@/components/auth/auth-frame";
import { StatusScreen } from "@/components/status/status-screen";
import { rootOrigin } from "@/lib/subdomain";

export default function NotFound() {
  const home = rootOrigin() || "/";
  return (
    <div className="flex min-h-dvh flex-col bg-secondary/30">
      <title>Page not found | STS Somalia</title>
      <header className="flex justify-center px-4 pt-10">
        <AuthLogo href={home} />
      </header>
      <StatusScreen
        code="404"
        title="Page not found"
        actions={
          <Button size="lg" render={<a href={home} />}>
            Go to homepage
          </Button>
        }
      />
    </div>
  );
}
