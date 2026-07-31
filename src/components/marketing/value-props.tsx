import { ShieldCheck, Headset, Wallet, Globe2 } from "lucide-react";

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description: "Every booking is protected with encrypted payments and verified partners.",
  },
  {
    icon: Headset,
    title: "Real human support",
    description: "A Mogadishu-based team is one call away, before and after you travel.",
  },
  {
    icon: Wallet,
    title: "Transparent pricing",
    description: "No hidden fees — the price you see at search is the price you pay.",
  },
  {
    icon: Globe2,
    title: "Local & international",
    description: "Domestic Somali routes and international journeys, one platform.",
  },
];

export function ValueProps() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_PROPS.map((item) => (
          <div key={item.title} className="flex flex-col items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="size-5" />
            </span>
            <h3 className="font-heading text-base font-semibold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
