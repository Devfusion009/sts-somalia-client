import type { Metadata } from "next";
import { ReferencePreview } from "@/components/reference-preview/reference-preview";
import "@/components/reference-preview/reference-preview.css";

export const metadata: Metadata = {
  title: "STS — Reference UI preview",
  robots: { index: false, follow: false },
};
export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  const { screen } = await params;
  return <ReferencePreview screen={screen?.join("/") || "home"} />;
}
