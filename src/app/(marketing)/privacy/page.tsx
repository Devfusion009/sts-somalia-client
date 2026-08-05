import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "1. What we collect",
    body: "To process bookings and visa applications we collect the details you provide: names, dates of birth, passport information, contact details, travel plans, and the documents you upload (passport scans, photos, supporting documents).",
  },
  {
    title: "2. How we use it",
    body: "Your information is used solely to deliver the service you requested — submitting visa applications to immigration authorities, confirming hotel, Umrah, flight, and hall bookings, processing payments, and keeping you informed about your booking status.",
  },
  {
    title: "3. Storage and security",
    body: "Data is stored with role-based access controls and row-level security; uploaded documents live in private storage accessible only to you, staff processing your application, and (where applicable) the travel agency that submitted on your behalf. All traffic is encrypted in transit with TLS (256-bit SSL).",
  },
  {
    title: "4. Sharing",
    body: "We share your details only with the parties required to fulfil your booking: immigration authorities for visa applications, hotels and suppliers for accommodation, and payment providers for processing payments. We never sell personal data.",
  },
  {
    title: "5. Retention and your rights",
    body: "We retain booking records as required for legal and accounting purposes. You may request a copy of your data or ask us to delete data we are not legally required to keep by contacting our support team.",
  },
  {
    title: "6. Contact",
    body: "Privacy questions? Call +252 611 444 420 or visit any STS office.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
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
