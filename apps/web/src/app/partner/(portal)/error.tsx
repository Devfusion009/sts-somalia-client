"use client";

import { RouteError, type RouteErrorProps } from "@/components/status/route-error";

export default function SegmentError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
