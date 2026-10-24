import { NotFoundScreen } from "@/components/status/not-found-screen";
import { portalHref } from "@/lib/subdomain";

export default function SegmentNotFound() {
  return <NotFoundScreen href={portalHref("venue")} label="Back to dashboard" />;
}
