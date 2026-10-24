import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Partner terms and conditions" };

const SECTIONS: LegalSection[] = [
  {
    title: "1. Parties and scope",
    body:
      "These Partner Terms & Conditions (\"Partner Terms\") are a legal agreement between Scout Travel Solution LTD, trading as STS Somalia (\"STS\", \"we\", \"us\"), headquartered at Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho, Somalia, and any travel agency, hotel or accommodation provider, or affiliate marketer (\"Partner\", \"you\") approved to access the STS Somalia B2B platform (the \"Platform\"). They apply in addition to, and do not replace, the general Terms & Conditions that govern all bookings made through STS.",
  },
  {
    title: "2. Application, review, and account activation",
    body:
      "Access to the Platform is granted at STS's sole discretion following review of your application, including the business, contact, and operational details you submit and any supporting documents (trade license, identification, proof of address). STS may approve, reject, or request further information on any application. Approval does not take effect, and no Partner account is provisioned, until STS confirms it in writing (including by email or in-platform notice).",
    list: [
      "If your application is rejected, you may reapply after 30 days from the decision.",
      "You must keep your business, contact, and settlement details accurate and up to date at all times.",
      "STS may request refreshed documents (e.g. a renewed trade license) at any time and may suspend your account if requested documents are not provided within a reasonable period.",
    ],
  },
  {
    title: "3. Your Partner account",
    body:
      "The individual who submits and is approved on an application becomes the account owner and may invite additional team members with defined roles. You are responsible for all activity under your account, including actions taken by team members you invite, and for keeping your login credentials confidential. STS is not liable for losses arising from unauthorized use of your account unless caused by our own negligence.",
  },
  {
    title: "4. Approved products and service scope",
    body:
      "Your Partner account is approved for the specific product categories you declared and STS confirmed at approval (for example: flights, hotels, visa services, Umrah packages, or event halls). STS may restrict your account to those categories at the platform level. If you want to add a new category later, contact STS to request an update to your account's approved products — do not assume access extends automatically.",
  },
  {
    title: "5. Commission, markup, and pricing — travel agents",
    body:
      "Travel agent (\"Agent\") accounts earn income in two ways, both shown transparently in your agent portal: (a) a markup you set yourself on top of STS's net rates, within any limits STS applies to your account tier, and (b) where applicable, a platform commission STS credits on qualifying paid bookings at the rate assigned to your account. STS may adjust your commission rate, tier, or markup limits prospectively; changes do not apply retroactively to bookings already confirmed.",
  },
  {
    title: "6. Rates and payouts — hotel partners",
    body:
      "Hotel and accommodation Partners set their own room rates and availability through the Platform and are responsible for keeping them accurate and current. STS may charge a service or distribution fee on bookings made through the Platform, disclosed to you before it applies. You must honor confirmed bookings at the rate and terms shown at the time of booking, subject to the cancellation policy you configure.",
  },
  {
    title: "7. Referral commission — affiliates",
    body:
      "Affiliate accounts earn commission on qualifying bookings attributed to their referral link, tracked on a last-click basis for a limited attribution window. Self-referrals, fraudulent traffic, incentivized clicks that misrepresent the offer, and any attempt to manipulate attribution are prohibited and will forfeit the associated commission and may result in suspension.",
  },
  {
    title: "8. Wallet, credit, and settlement",
    body:
      "Where your account uses a prepaid wallet or an assigned credit limit, you authorize STS to deduct the net cost of each confirmed booking from your available balance. You are responsible for maintaining sufficient balance or credit headroom; STS may decline or hold bookings that would exceed your credit limit. Commission and payout amounts are settled on the schedule communicated to you (e.g. via recorded payouts to your registered bank account or mobile-money number) and are reflected in your account's transaction ledger, which is the authoritative record absent a demonstrated error.",
  },
  {
    title: "9. Holds, changes, and cancellations",
    body:
      "Where the Platform offers a booking hold, held inventory is reserved for a limited window (currently 24 hours) before it is automatically released if not confirmed. Cancellation, amendment, and refund terms follow the policy shown for each product at the time of booking and, for supplier-fulfilled products (flights, hotels, Umrah, visas), the underlying supplier's or authority's own terms — STS is not liable for a third-party supplier's refusal to refund or amend.",
  },
  {
    title: "10. Customer data and confidentiality",
    body:
      "You may only use customer data made available to you through the Platform to fulfill bookings and provide related support. You must not sell, rent, or use customer data for unrelated marketing without the customer's separate consent, and must handle personal data (including passport and payment-adjacent information) securely and in line with applicable data-protection law. Business terms disclosed to you that are not public — including your commission rate, credit limit, and tier — are confidential and must not be shared outside your organization.",
  },
  {
    title: "11. Compliance and conduct",
    body:
      "You must provide accurate, complete information in every booking and application you submit, comply with the immigration, aviation, and consumer-protection laws applicable to the services you offer, and not use the Platform for any unlawful purpose, including money laundering or misrepresenting travelers' identities. STS acts as a facilitator for visa and immigration services; final decisions rest solely with the relevant government authority.",
  },
  {
    title: "12. Branding and intellectual property",
    body:
      "STS grants you a limited, revocable, non-exclusive license to use the STS Somalia name and logo solely to identify yourself as an approved Partner while your account is active. You may not imply a broader relationship (such as exclusivity or joint ownership) than actually exists, and this license ends immediately if your account is suspended or terminated.",
  },
  {
    title: "13. Suspension and termination",
    body:
      "STS may suspend or terminate your Partner account for breach of these Partner Terms, suspected fraud, repeated customer complaints, providing false information, non-payment of amounts owed, or extended inactivity, with notice where practical. You may close your account at any time by written request, subject to settling any outstanding balance owed to STS and completing any bookings already confirmed. Sections that by their nature should survive termination (confidentiality, liability, governing law) continue to apply.",
  },
  {
    title: "14. Liability",
    body:
      "To the fullest extent permitted by law, STS's total liability to you under these Partner Terms is limited to the commission or fees actually paid to (or, for hotel partners, received by STS from) you in the three months preceding the claim. Neither party is liable for indirect or consequential losses, or for events outside its reasonable control (force majeure), including supplier failures, government decisions, or platform outages caused by third-party infrastructure. Nothing here limits liability that cannot be limited under applicable law.",
  },
  {
    title: "15. Changes to these terms",
    body:
      "STS may update these Partner Terms from time to time to reflect changes to the Platform or applicable law. Material changes will be communicated to active Partners in advance where practical; continued use of the Platform after an update takes effect constitutes acceptance of the revised terms.",
  },
  {
    title: "16. Governing law and disputes",
    body:
      "These Partner Terms are governed by the laws of the Federal Republic of Somalia. Both parties will first attempt to resolve any dispute in good faith through direct negotiation before pursuing formal proceedings in the competent courts of Mogadishu, Somalia.",
  },
  {
    title: "17. Contact",
    body:
      "Questions about these Partner Terms, your account, or your commission and settlement details can be directed to your STS account contact, by phone at +252 611 444 420, or at any STS office.",
  },
];

export default function PartnerTermsPage() {
  return (
    <LegalPage
      title="Partner terms and conditions"
      meta="For travel agent, hotel partner and affiliate accounts on the STS Somalia B2B platform. Last updated: August 2026."
      sections={SECTIONS}
    />
  );
}
