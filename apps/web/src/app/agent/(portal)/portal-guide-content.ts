export type GuideStep = {
  id: "overview" | "account" | "wallet" | "customers" | "booking" | "tracking";
  label: string;
  title: string;
  description: string;
  location: string;
  tasks: string[];
  action: { label: string; href: string };
};

export function agentGuideSteps(role: string): GuideStep[] {
  const managesAgency = role === "owner" || role === "admin";
  const booksTravel = managesAgency || role === "booking_staff";
  return [
    {
      id: "overview", label: "Your workspace", title: "Welcome to your Agent Portal",
      description: "Follow your agency’s work from the first enquiry to the final booking.",
      location: "Dashboard",
      tasks: ["Read bookings, sales and commission in the top cards.", "Choose a date range to review a period.", "Use the left menu to move between sections."],
      action: { label: "Explore dashboard", href: "/agent" },
    },
    {
      id: "account", label: "Account setup", title: managesAgency ? "Set up your agency" : "Secure your account",
      description: managesAgency ? "Start with your agency details and account security." : "Keep your login details up to date before you begin.",
      location: "Agency settings",
      tasks: managesAgency
        ? ["Open Agency profile to update your logo and contact details.", "Add your payout account under Bank details.", "Change your initial password under Security."]
        : ["Open Security from Agency settings.", "Change your initial password.", "Ask your agency owner about changes to team access."],
      action: { label: managesAgency ? "Open agency profile" : "Open security", href: managesAgency ? "/agent/settings" : "/agent/security" },
    },
    {
      id: "wallet", label: "Wallet & payments", title: managesAgency ? "Prepare your booking funds" : "Know your agency wallet",
      description: "Keep an eye on your available balance and payment records.", location: "Finance → Wallet",
      tasks: ["Check the available amount on the Wallet balance card.", managesAgency ? "Choose Add funds to top up the agency wallet." : "Ask an agency owner or admin when funds need to be added.", "Find payment records under Finance → Transactions."],
      action: { label: managesAgency ? "Add wallet funds" : "View wallet", href: managesAgency ? "/agent/finance/top-up" : "/agent/finance" },
    },
    {
      id: "customers", label: "Your customers", title: "Keep traveller details together",
      description: "Find your customers and their travel records in one directory.", location: "Customers",
      tasks: ["Open Customers from the left menu.", "Search for a traveller before creating another record.", "Open a customer to review their details and booking history."],
      action: { label: "Open customers", href: "/agent/customers" },
    },
    {
      id: "booking", label: "Booking travel", title: booksTravel ? "Create your first booking" : "Understand the booking journey",
      description: "Flights, hotels, visas, Umrah and event halls each have a dedicated booking flow.", location: "New booking",
      tasks: ["Choose a service from Book travel or New booking.", "Select an existing customer or add a new traveller.", booksTravel ? "Review the service details, price and payment before confirming." : "Your agency’s booking staff handle new reservations and confirmations."],
      action: { label: booksTravel ? "Start a booking" : "View agency bookings", href: booksTravel ? "/agent/book" : "/agent/bookings" },
    },
    {
      id: "tracking", label: "Track & grow", title: "You’re ready to get started",
      description: "Return to your workspace to keep track of bookings and earnings.", location: "Bookings · Finance · Agency settings",
      tasks: ["Open Bookings to review reservations and their status.", "Check commissions under Finance → Commissions & earnings.", managesAgency ? "Set Pricing & markups and invite colleagues under Team." : "Use the booking calendar to review upcoming travel."],
      action: { label: booksTravel ? "Create a booking" : "View bookings", href: booksTravel ? "/agent/book" : "/agent/bookings" },
    },
  ];
}

export type GuideProgress = { status: "in_progress" | "dismissed" | "complete"; step: number };

/** Stored progress is untrusted and may belong to an earlier guide revision. */
export function parseGuideProgress(raw: string | null, count: number): GuideProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !["in_progress", "dismissed", "complete"].includes(value.status) || !Number.isInteger(value.step) || value.step < 0 || value.step >= count) return null;
    return { status: value.status, step: value.step };
  } catch {
    return null;
  }
}

/** Automatic welcome is limited to the first seven days of agency membership. */
export function isNewAgent(joinedAt: string, now = Date.now()): boolean {
  const joined = Date.parse(joinedAt);
  const age = now - joined;
  return Number.isFinite(joined) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}
