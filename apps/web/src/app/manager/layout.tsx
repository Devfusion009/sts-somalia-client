import type { Metadata } from "next";

/** Portal-scoped title — see the admin portal layout for why this lives on the layout. */
export const metadata: Metadata = {
  title: {
    default: "Manager Portal",
    template: "%s | Manager Portal",
  },
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
