import { NotFoundScreen } from "@/components/status/not-found-screen";
import { portalHref } from "@/lib/subdomain";

export default function SegmentNotFound() {
  return <NotFoundScreen href={portalHref("manager")} label="Back to properties" />;
}
