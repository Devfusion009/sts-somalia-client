import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms & Conditions" };

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "1. Who we are",
    body: "Scout Travel Solution LTD (STS) is a licensed travel and tourism management company headquartered at Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho, Somalia. These terms govern the use of our website and booking services, including flights, hotels, visa assistance, Umrah packages, and event hall bookings.",
  },
  {
    title: "2. Bookings and payments",
    body: "A booking is confirmed once payment has been received and a confirmation reference has been issued. Prices are shown in the currency indicated at checkout. Unless stated otherwise, visa service fees and government fees are non-refundable once an application has been submitted.",
  },
  {
    title: "3. Visa services",
    body: "STS acts as a facilitator between applicants and the relevant immigration authorities. The final decision on any visa application rests solely with the issuing authority. Processing times shown on our site are typical estimates, not guarantees. Providing inaccurate or incomplete information may result in delays or rejection without refund of government fees.",
  },
  {
    title: "4. Cancellations and changes",
    body: "Cancellation and change policies vary by product and supplier. Hotel and hall bookings may be changed or cancelled subject to the conditions shown at the time of booking. Umrah packages are subject to the package-specific terms communicated before departure.",
  },
  {
    title: "5. Your responsibilities",
    body: "You are responsible for ensuring that passports are valid for at least six months beyond your travel dates, that the information you provide matches your travel documents, and that you comply with the entry requirements of your destination.",
  },
  {
    title: "6. Liability",
    body: "STS is not liable for losses arising from events outside its reasonable control, including decisions of immigration authorities, airline schedule changes, or force majeure events. Nothing in these terms limits liability that cannot be limited under applicable law.",
  },
  {
    title: "7. Contact",
    body: "Questions about these terms? Call +252 611 444 420 or visit any STS office.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Terms &amp; Conditions</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 2026</p>
      <div className="mt-8 space-y-7">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
