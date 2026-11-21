import type { Metadata } from "next";
import { ReferencePreview } from "@/components/reference-preview/reference-preview";
import { previewPages } from "@/components/reference-preview/data";
import "@/components/reference-preview/reference-preview.css";

export const metadata: Metadata = {
  title: "STS — Reference UI preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return [
    ...previewPages.map(([page]) => ({
      screen: page === "home" ? [] : page.split("/"),
    })),
    { screen: ["legal", "privacy"] },
    { screen: ["legal", "refunds"] },
  ];
}
export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  const { screen } = await params;
  const page = screen?.join("/") || "home";
  return <ReferencePreview key={page} screen={page} />;
}
