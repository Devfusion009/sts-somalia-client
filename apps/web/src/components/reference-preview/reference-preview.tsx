"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plane,
  BedDouble,
  Stamp,
  Landmark,
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Search,
  ArrowRight,
  Check,
  Menu,
  X,
  Users,
  ChevronDown,
  MessageCircle,
  Plus,
  Minus,
  FileText,
  Camera,
} from "lucide-react";
import { StsBrandLogo } from "../marketing/sts-brand-logo";
import {
  destinations,
  faqs,
  halls,
  hotels,
  packages,
  previewPages,
} from "./data";

const base = "/design-preview";
const href = (page: string) => (page === "home" ? base : `${base}/${page}`);
const nav = [
  ["flights", "Flights"],
  ["hotels", "Hotels"],
  ["visa", "Visa"],
  ["umrah", "Umrah"],
  ["events", "Events & Halls"],
  ["about", "About"],
];
const icons = [Plane, BedDouble, Stamp, Landmark, Building2];
function Picture({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={800}
      className={`rp-photo ${className}`}
    />
  );
}
function Button({
  children,
  to,
  secondary = false,
}: {
  children: ReactNode;
  to?: string;
  secondary?: boolean;
}) {
  const cls = `rp-button ${secondary ? "rp-button-secondary" : ""}`;
  return to ? (
    <Link className={cls} href={href(to)}>
      {children}
    </Link>
  ) : (
    <button className={cls} type="submit">
      {children}
    </button>
  );
}
function Label({ children }: { children: ReactNode }) {
  return (
    <div className="rp-eyebrow">
      <span />
      {children}
    </div>
  );
}
function Block({
  children,
  tint = false,
  className = "",
}: {
  children: ReactNode;
  tint?: boolean;
  className?: string;
}) {
  return (
    <section className={`rp-section ${tint ? "rp-tint" : ""} ${className}`}>
      <div className="rp-container">{children}</div>
    </section>
  );
}
function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rp-heading">
      {eyebrow && <Label>{eyebrow}</Label>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
function Fields({ items }: { items: string[] }) {
  return (
    <div className="rp-fields">
      {items.map((label) => (
        <label key={label}>
          <span>{label}</span>
          {/service|room|city|people|country|guest/i.test(label) ? (
            <select defaultValue="">
              <option value="" disabled>
                Choose {label.toLowerCase()}
              </option>
              {[
                "Mogadishu",
                "Hargeisa",
                "Nairobi",
                "Dubai",
                "2 adults",
                "4 guests",
                "Flights",
                "Hotels",
                "Visa",
                "Umrah",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              required={!/optional/i.test(label)}
              type={
                /date|arrival|departure|check-in|check-out/i.test(label)
                  ? "date"
                  : /email/i.test(label)
                    ? "email"
                    : /password/i.test(label)
                      ? "password"
                      : /number|travellers/i.test(label)
                        ? "number"
                        : "text"
              }
              placeholder={/phone/i.test(label) ? "+252 61…" : label}
            />
          )}
        </label>
      ))}
    </div>
  );
}
function SearchForm({ mode = "Flights" }: { mode?: string }) {
  const [tab, setTab] = useState(mode);
  const router = useRouter();
  return (
    <form
      className="rp-search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(
          href(
            tab === "Flights"
              ? "flights/results"
              : tab === "Hotels"
                ? "hotels"
                : tab === "Visa"
                  ? "visa/uae"
                  : "umrah",
          ),
        );
      }}
    >
      <div className="rp-tabs">
        {["Flights", "Hotels", "Visa", "Umrah"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? "is-selected" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      <Fields
        items={
          tab === "Flights"
            ? ["From", "To", "When"]
            : tab === "Hotels"
              ? ["City", "Check-in date", "Check-out date"]
              : tab === "Visa"
                ? ["Destination country", "Departure date"]
                : ["Departure city", "Departure date", "Travellers"]
        }
      />
      <Button>
        <Search size={15} />
        Search
      </Button>
    </form>
  );
}
function Faq({ full = false }: { full?: boolean }) {
  const [query, setQuery] = useState("");
  const visible = (full ? faqs : faqs.slice(0, 4)).filter(([q]) =>
    q.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      {full && (
        <input
          className="rp-faq-search"
          placeholder="Search for a question…"
          aria-label="Search questions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="rp-faq">
        {visible.map(([q, a], i) => (
          <details key={q} open={!full && i === 0}>
            <summary>
              {q}
              <Plus size={15} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
        {!visible.length && <p>No matching questions.</p>}
      </div>
    </>
  );
}
function PackageCards({ all = false }: { all?: boolean }) {
  return (
    <div className="rp-grid rp-packages">
      {(all ? [...packages, ...packages.slice(0, 2)] : packages).map((p, i) => (
        <Link
          href={href("umrah/premium")}
          className="rp-card rp-package"
          key={i}
        >
          <div className="rp-card-image">
            <Picture src={p.image} alt={p.name} />
            <span className="rp-tag">{p.tier}</span>
          </div>
          <div className="rp-card-body">
            <h3>{p.name}</h3>
            <small>MGQ – JED · {p.days}</small>
            <div className="rp-room-pair">
              <div>
                <small>Makkah</small>
                <strong>{p.makkah}</strong>
              </div>
              <div>
                <small>Madinah</small>
                <strong>{p.madinah}</strong>
              </div>
            </div>
            <p className="rp-price">
              USD {p.price.toLocaleString()}
              <small> / pilgrim</small>
            </p>
            <small>Price depends on room type, deposit or full payment</small>
            {all && (
              <span className="rp-mini-button">
                Explore <ArrowRight size={12} />
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
function Services() {
  return (
    <div className="rp-grid rp-services">
      {nav.slice(0, 5).map(([page, name], i) => {
        const Icon = icons[i];
        return (
          <Link
            className={`rp-card ${page === "umrah" ? "rp-warm" : ""}`}
            href={href(page)}
            key={page}
          >
            <span className="rp-icon">
              <Icon size={22} />
            </span>
            <h3>{name}</h3>
            <p>
              {
                [
                  "Somali routes and international tickets, booked by our IATA-accredited desk.",
                  "From guesthouses to five-star towers in Somalia, Nairobi, Dubai, Istanbul and the holy cities.",
                  "We check your documents before they reach the embassy — tourist, business and family visas.",
                  "Flights, visa, hotels in Makkah and Madinah, transport and a guide — one price per pilgrim.",
                  "Wedding halls, conference rooms and venues across Somalia, with clear capacity and prices.",
                ][i]
              }
            </p>
            <b>
              {
                [
                  "Find a flight",
                  "Find a stay",
                  "Check a visa",
                  "See packages",
                  "Find a venue",
                ][i]
              }{" "}
              →
            </b>
          </Link>
        );
      })}
    </div>
  );
}
function Credentials() {
  return (
    <div className="rp-credentials">
      {[
        [ShieldCheck, "ISO 9001:2015", "Certified quality system"],
        [Plane, "IATA TIDS", "Accredited ticketing desk"],
        [Landmark, "Hajj & Umrah licence", "Ministry of Commerce, Somalia"],
        [Building2, "2 real offices", "Mogadishu & Nairobi"],
      ].map(([Icon, title, sub]) => {
        const I = Icon as typeof Plane;
        return (
          <div key={String(title)}>
            <span className="rp-icon">
              <I size={20} />
            </span>
            <span>
              <b>{String(title)}</b>
              <small>{String(sub)}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
function Callback() {
  const [saved, setSaved] = useState(false);
  return (
    <div className="rp-callback">
      <div>
        <Label>Talk to a real person</Label>
        <h2>Not sure yet? We’ll call you.</h2>
        <p>
          Tell us where you want to go. Our booking desks call you back with
          options and prices.
        </p>
        <div className="rp-contact-pair">
          <a href="tel:+252611444420">
            <small>Call us</small>
            <b>+252 611 444 420</b>
          </a>
          <a href="https://wa.me/252611444420">
            <small>WhatsApp</small>
            <b>Message us</b>
          </a>
        </div>
        <small>
          Saturday–Thursday · 8:00–18:00 EAT · emergency support 24/7
        </small>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
      >
        <h3>Request a callback</h3>
        <Fields
          items={["Your name", "Phone / WhatsApp", "What do you need?"]}
        />
        <label>
          <span>Anything we should know? (optional)</span>
          <textarea placeholder="Dates, destination, number of travellers…" />
        </label>
        <Button>Call me back</Button>
        {saved && (
          <p role="status">Preview request saved. No message was sent.</p>
        )}
      </form>
    </div>
  );
}
function Footer() {
  return (
    <footer className="rp-footer">
      <div className="rp-container">
        <div className="rp-safety">
          <ShieldCheck size={19} />
          <p>
            <b>Payment safety.</b> STS only takes payment on this website and at
            our Mogadishu office. We never ask you to pay through another
            website, a personal account or a payment link. If in doubt, call{" "}
            <a href="tel:+252611444420">+252 611 444 420</a> before you pay.
          </p>
        </div>
        <div className="rp-footer-grid">
          <div>
            <Link href={href("home")}>
              <StsBrandLogo white className="rp-footer-logo" />
            </Link>
            <p>
              Flights, hotels, visas, Umrah and event halls — from our offices
              in Mogadishu and Nairobi.
            </p>
            <Link className="rp-cert" href={href("iso")}>
              <ShieldCheck size={14} />
              ISO 9001:2015 certified
            </Link>
            <div className="rp-footer-contact">
              <h4>Contact</h4>
              <a href="tel:+252611444420">+252 611 444 420</a>
              <a href="mailto:info@scoutsts.com">info@scoutsts.com</a>
              <h4>Mogadishu · head office</h4>
              <p>
                First Floor 111, Sultan Business Park,
                <br />
                Waaberi District
              </p>
              <h4>Nairobi · Kenya office</h4>
              <p>
                Yare Plaza, 3rd Floor, Office 308,
                <br />
                Eastleigh
              </p>
            </div>
          </div>
          {[
            ["Services", ...nav.slice(0, 5).map(([p, n]) => `${n}|${p}`)],
            [
              "Company",
              "About us|about",
              "Our team|team",
              "ISO certification|iso",
              "Become a travel agent|contact",
              "List your hotel|contact",
              "List your event hall|contact",
              "Affiliate programme|contact",
            ],
            [
              "Help",
              "Contact us|contact",
              "FAQ|faq",
              "My bookings|account",
              "Terms & conditions|legal",
              "Privacy policy|legal/privacy",
              "Refund policy|legal/refunds",
            ],
          ].map(([title, ...links]) => (
            <div key={title}>
              <h4>{title}</h4>
              {links.map((item) => {
                const [label, page] = item.split("|");
                return (
                  <Link href={href(page)} key={label}>
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="rp-footer-bottom">
          <span>
            © 2026 Scout Travel Solution · Sat–Thu 8:00–18:00 EAT · emergencies
            24/7
          </span>
          <span className="rp-social">
            <Camera size={15} />
            <MessageCircle size={15} />
          </span>
        </div>
      </div>
    </footer>
  );
}
function Intro({
  tag,
  title,
  text,
  image,
  dark = false,
  children,
}: {
  tag?: string;
  title: ReactNode;
  text?: string;
  image?: string;
  dark?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={`rp-intro ${dark ? "rp-intro-dark" : ""}`}>
      <div className={`rp-container ${image ? "rp-two-column" : ""}`}>
        <div>
          {tag && <span className="rp-pill">{tag}</span>}
          <h1>{title}</h1>
          {text && <p>{text}</p>}
          {children}
        </div>
        {image && (
          <Picture
            src={image}
            alt={typeof title === "string" ? title : "STS travel"}
          />
        )}
      </div>
    </section>
  );
}
function RequestForm({
  title = "Your booking",
  price,
  fields = ["Full name", "Email address", "Phone / WhatsApp"],
  button = "Send request",
}: {
  title?: string;
  price?: string;
  fields?: string[];
  button?: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="rp-card rp-booking-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
    >
      <h3>{title}</h3>
      {price && <p className="rp-price">{price}</p>}
      <Fields items={fields} />
      <label>
        <span>Anything else? (optional)</span>
        <textarea placeholder="Tell us about your trip…" />
      </label>
      <Button>{button}</Button>
      {saved && (
        <div className="rp-confirm" role="status">
          <Check size={18} />
          Preview only — no booking or payment was submitted.
        </div>
      )}
    </form>
  );
}

export function ReferencePreview({ screen }: { screen: string }) {
  const [mobile, setMobile] = useState(false),
    [directory, setDirectory] = useState(false),
    [filter, setFilter] = useState("All"),
    [people, setPeople] = useState(1),
    [room, setRoom] = useState("Quad"),
    [loginTab, setLoginTab] = useState("Customer");
  const root = screen.split("/")[0];
  const crumb = (
    <div className="rp-container rp-breadcrumb">
      <Link href={href("home")}>Home</Link>
      <span>/</span>
      <span>{previewPages.find(([p]) => p === screen)?.[1] || root}</span>
    </div>
  );
  let content: ReactNode;
  if (screen === "home")
    content = (
      <>
        <Intro
          tag="ISO 9001:2015 · IATA-accredited · Licensed for Umrah"
          title={
            <>
              Travel from Somalia,
              <br />
              <em>done properly.</em>
            </>
          }
          text="Flights, hotels, visas, Umrah and event halls — booked online with our team in Mogadishu and Nairobi."
          image="/about/umrah-group.webp"
        >
          <SearchForm />
          <small className="rp-under-search">
            Pay with EVC Plus, WAAFI or card · Support in Somali, English &
            Arabic
          </small>
        </Intro>
        <div className="rp-container">
          <Credentials />
        </div>
        <Block>
          <Heading
            eyebrow="Our services"
            title="One team for every part of your trip"
          />
          <Services />
        </Block>
        <Block tint>
          <div className="rp-heading-row">
            <Heading
              eyebrow="Upcoming Umrah packages"
              title={
                <>
                  Flights, hotels, visa and a guide —<br />
                  one price per pilgrim
                </>
              }
            />
            <Button secondary to="umrah">
              All packages
            </Button>
          </div>
          <PackageCards />
        </Block>
        <Block>
          <div className="rp-two-column rp-why">
            <Picture src="/about/reception.webp" alt="STS reception" />
            <div>
              <Heading
                eyebrow="Why travellers book with STS"
                title="A travel company you can actually reach"
              />
              {[
                [
                  "Responsive",
                  "Calls and WhatsApp answered by people who know your booking — before you pay and long after you travel.",
                ],
                [
                  "Built around your trip",
                  "From Umrah groups to business trips — itineraries built around how your family actually travels.",
                ],
                [
                  "One account",
                  "Flights, hotels, visas, Umrah and venues behind one account, one invoice and one support number.",
                ],
              ].map(([t, d], i) => (
                <div className="rp-number-point" key={t}>
                  <span>{i + 1}</span>
                  <div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                </div>
              ))}
              <small>STS IN 2024</small>
              <div className="rp-stats">
                {[
                  ["1,500", "Flight tickets"],
                  ["900", "Visas processed"],
                  ["383", "Umrah pilgrims"],
                  ["100", "Hajj pilgrims"],
                ].map(([n, l]) => (
                  <div key={l}>
                    <b>{n}</b>
                    <small>{l}</small>
                  </div>
                ))}
              </div>
              <blockquote>
                I booked flights and a hotel in Dubai for my whole family from
                my phone. When our return flight moved, STS called me before the
                airline’s SMS even arrived.
                <br />
                <b>Amina Hassan</b> · Mogadishu
              </blockquote>
            </div>
          </div>
        </Block>
        <Block tint>
          <Callback />
        </Block>
        <Block>
          <div className="rp-faq-layout">
            <Heading
              eyebrow="FAQ"
              title={
                <>
                  Questions
                  <br />
                  people ask us
                </>
              }
            >
              Can’t find your answer?
              <br />
              <Link href={href("faq")}>
                Contact our team or see all questions
              </Link>
            </Heading>
            <Faq />
          </div>
        </Block>
      </>
    );
  else if (screen === "flights")
    content = (
      <>
        <Intro
          tag="Flight tickets"
          title={
            <>
              A new view. <em>A flight away.</em>
            </>
          }
          text="Domestic and international flights, booked and managed by our IATA-accredited ticketing desk."
          image="/marketing/flights-hero-bg.webp"
        >
          <SearchForm />
        </Intro>
        <Block>
          <Heading
            eyebrow="A change of scenery"
            title="Where will you fly next?"
          />
          <div className="rp-grid">
            {destinations.slice(1, 5).map((d) => (
              <Link
                className="rp-destination"
                href={href("flights/results")}
                key={d.name}
              >
                <Picture src={d.image} alt={d.city} />
                <h3>{d.city}</h3>
                <small>From Mogadishu</small>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </Block>
        <Block tint>
          <div className="rp-split">
            <Heading
              eyebrow="Popular routes"
              title={
                <>
                  The routes our
                  <br />
                  desk books
                  <br />
                  every week
                </>
              }
            >
              Fares change every day. Ask our desk for availability.
            </Heading>
            <div className="rp-route-list">
              {[
                "Mogadishu → Dubai",
                "Mogadishu → Istanbul",
                "Mogadishu → Nairobi",
                "Hargeisa → Addis Ababa",
                "Mogadishu → Jeddah",
              ].map((r) => (
                <Link href={href("flights/results")} key={r}>
                  <Plane size={18} />
                  <span>
                    <b>{r}</b>
                    <small>Daily flights · Economy</small>
                  </span>
                  <strong>View fares →</strong>
                </Link>
              ))}
            </div>
          </div>
        </Block>
        <Block>
          <Credentials />
        </Block>
        <Block tint>
          <Callback />
        </Block>
        <Block>
          <div className="rp-faq-layout">
            <Heading eyebrow="Before you fly" title="Your flight questions" />
            <Faq />
          </div>
        </Block>
      </>
    );
  else if (screen === "hotels")
    content = (
      <>
        {crumb}
        <Block className="rp-compact">
          <div className="rp-image-hero">
            <Picture
              src="/marketing/hotels-hero-bg.webp"
              alt="Hotels at sunset"
            />
            <div>
              <Label>Hotels</Label>
              <h1>
                Find your stay.
                <br />
                <strong>Somalia & beyond.</strong>
              </h1>
            </div>
          </div>
          <SearchForm mode="Hotels" />
        </Block>
        <Block className="rp-compact">
          <div className="rp-list-layout">
            <aside className="rp-filters">
              <h4>Refine your stay</h4>
              {["Star rating", "Amenities", "Room type", "Price range"].map(
                (title) => (
                  <fieldset key={title}>
                    <legend>{title}</legend>
                    {(title === "Star rating"
                      ? ["★★★★★", "★★★★", "★★★"]
                      : title === "Amenities"
                        ? ["Wifi", "Parking", "Pool", "Restaurant", "Gym"]
                        : title === "Room type"
                          ? ["Standard room", "Deluxe room", "Family room"]
                          : ["Under USD 100", "USD 100–200", "USD 200+"]
                    ).map((t) => (
                      <label key={t}>
                        <input type="checkbox" />
                        {t}
                      </label>
                    ))}
                  </fieldset>
                ),
              )}
            </aside>
            <div>
              <div className="rp-heading-row">
                <h3>
                  {filter === "All"
                    ? "54 properties"
                    : hotels.filter((h) => h.city === filter).length +
                      " properties"}
                </h3>
                <select
                  aria-label="Filter hotel city"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["All", "Mogadishu", "Hargeisa", "Berbera", "Bosaso"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </div>
              <div className="rp-hotel-results">
                {hotels
                  .filter((h) => filter === "All" || h.city === filter)
                  .map((h) => (
                    <Link
                      className="rp-card rp-hotel-row"
                      key={h.name}
                      href={href("hotels/berbera")}
                    >
                      <Picture src={h.image} alt={h.name} />
                      <div>
                        <span className="rp-stars">{"★".repeat(h.stars)}</span>
                        <h3>{h.name}</h3>
                        <small>
                          <MapPin size={12} />
                          {h.city}, Somalia
                        </small>
                        <p>
                          Comfortable rooms, a welcoming team and confirmed
                          rates. Wifi · Restaurant · Parking
                        </p>
                        <b>
                          USD {h.price} <small>/ night</small>
                        </b>
                      </div>
                      <span className="rp-mini-button">View rooms</span>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </Block>
      </>
    );
  else if (screen === "visa")
    content = (
      <>
        <Intro
          tag="Visa assistance"
          title={
            <>
              Your destination. <em>Our visa expertise.</em>
            </>
          }
          text="Tourist, business and family visas — with your documents checked by our team before they reach the embassy."
          image="/marketing/dubai.webp"
        >
          <SearchForm mode="Visa" />
        </Intro>
        <Block>
          <Heading
            eyebrow="Visa destinations"
            title="Places worth the paperwork"
          />
          <div className="rp-grid rp-three">
            {destinations.map((d) => (
              <Link
                className="rp-destination"
                href={href("visa/uae")}
                key={d.name}
              >
                <Picture src={d.image} alt={d.name} />
                <h3>{d.name}</h3>
                <small>Tourist visa · Processing varies</small>
                <p>From USD {d.price}</p>
              </Link>
            ))}
          </div>
        </Block>
        <Block tint>
          <Heading title="From documents to visa, in four steps" />
          <div className="rp-grid">
            {[
              "Choose your destination",
              "Upload your documents",
              "Our desk checks every detail",
              "Receive your visa",
            ].map((s, i) => (
              <div className="rp-step" key={s}>
                <span>{i + 1}</span>
                <h3>{s}</h3>
              </div>
            ))}
          </div>
        </Block>
        <Block>
          <div className="rp-faq-layout">
            <Heading eyebrow="Visa questions" title="Before you apply" />
            <Faq />
          </div>
        </Block>
      </>
    );
  else if (screen === "umrah")
    content = (
      <>
        {crumb}
        <Block className="rp-compact">
          <div className="rp-image-hero rp-umrah-hero">
            <Picture src="/marketing/umrah-hero.webp" alt="Makkah courtyard" />
            <div>
              <Label>Umrah with STS</Label>
              <h1>
                Group Umrah at{" "}
                <strong>
                  one
                  <br />
                  fixed price.
                </strong>
              </h1>
              <p>
                Flights, visa, hotels, transport and a guide.
                <br />
                One account, one team, one journey.
              </p>
              <Button to="umrah/premium">Browse packages</Button>
              <Button secondary to="contact">
                Ask an Umrah expert
              </Button>
            </div>
          </div>
          <Credentials />
        </Block>
        <Block>
          <div className="rp-heading-row">
            <Heading eyebrow="Choose your journey" title="Choose your Umrah" />
            <div className="rp-chips">
              {["All", "Economy", "Standard", "Premium"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={filter === t ? "is-selected" : ""}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {filter === "All" ? (
            <PackageCards all />
          ) : (
            <div className="rp-grid rp-packages">
              {packages
                .filter((p) => p.tier === filter)
                .map((p) => (
                  <Link
                    href={href("umrah/premium")}
                    className="rp-card rp-package"
                    key={p.name}
                  >
                    <Picture src={p.image} alt={p.name} />
                    <div className="rp-card-body">
                      <h3>{p.name}</h3>
                      <p>{p.days}</p>
                      <b>USD {p.price}</b>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </Block>
        <Block tint>
          <Heading title="Your room. Your group. Your choice." />
          <div className="rp-grid rp-three">
            {["Quad sharing", "Triple sharing", "Double room"].map((t, i) => (
              <div className="rp-card rp-card-body" key={t}>
                <Users />
                <h3>{t}</h3>
                <p>{4 - i} pilgrims per room</p>
              </div>
            ))}
          </div>
        </Block>
        <Block>
          <div className="rp-two-column">
            <Picture
              src="/about/ziyarah-guide.webp"
              alt="STS guide with pilgrims"
            />
            <div>
              <Heading
                eyebrow="A guide throughout"
                title="We travel with our pilgrims"
              />
              <p>
                Our guides fly with Umrah groups and stay with them through
                ziyarah. Support in Somali, English and Arabic, from departure
                to return.
              </p>
              <Button secondary to="about">
                Meet STS
              </Button>
            </div>
          </div>
        </Block>
        <Block tint>
          <Callback />
        </Block>
        <Block>
          <div className="rp-faq-layout">
            <Heading title="Your Umrah questions" />
            <Faq />
          </div>
        </Block>
      </>
    );
  else if (screen === "events")
    content = (
      <>
        {crumb}
        <Block className="rp-compact">
          <div className="rp-image-hero">
            <Picture src="/marketing/events-hall.webp" alt="Event ballroom" />
            <div>
              <Label>Events & halls</Label>
              <h1>
                Event halls{" "}
                <strong>
                  across
                  <br />
                  Somalia.
                </strong>
              </h1>
              <p>
                Weddings, conferences, graduations and celebrations —<br />
                find a space that fits your event.
              </p>
            </div>
          </div>
          <form
            className="rp-search rp-inline-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <Fields items={["City", "Event date", "Number of guests"]} />
            <Button>Find a venue</Button>
          </form>
        </Block>
        <Block className="rp-compact">
          <div className="rp-chips">
            {[
              "All",
              "Wedding",
              "Community Event",
              "Conference",
              "Corporate Event",
              "Exhibition",
              "Party",
              "Graduation",
            ].map((t) => (
              <button
                className={filter === t ? "is-selected" : ""}
                onClick={() => setFilter(t)}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
          <Heading title="27 venues" />
          <div className="rp-grid rp-three">
            {halls.map((h) => (
              <Link
                href={href("events/sultan")}
                className="rp-card rp-hall"
                key={h.name}
              >
                <Picture src={h.image} alt={h.name} />
                <div className="rp-card-body">
                  <small>
                    {h.city} · {h.capacity}
                  </small>
                  <h3>{h.name}</h3>
                  <div className="rp-heading-row">
                    <b>{h.price}</b>
                    <span className="rp-mini-button">Explore</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Block>
      </>
    );
  else if (screen === "about")
    content = (
      <>
        <Intro
          tag="About Scout Travel Solution"
          title={
            <>
              Licensed travel, run
              <br />
              from{" "}
              <em>
                Mogadishu and
                <br />
                Nairobi.
              </em>
            </>
          }
          text="Scout Travel Solution arranges flights, hotels, visas, Hajj and Umrah — with a real team on the ground, not just a website."
          image="/about/sultan-business-park.webp"
        >
          <Button to="iso">Our credentials</Button>
          <Button secondary to="contact">
            Find an office
          </Button>
        </Intro>
        <Block>
          <Heading
            eyebrow="STS in numbers"
            title="Years of travel, in numbers"
          />
          <div className="rp-stats rp-stats-large">
            {[
              ["2009", "Our first journeys"],
              ["1,500", "Flight tickets"],
              ["900", "Visas processed"],
              ["383", "Umrah pilgrims"],
              ["100", "Hajj pilgrims"],
            ].map(([n, l]) => (
              <div key={l}>
                <b>{n}</b>
                <small>{l}</small>
              </div>
            ))}
          </div>
        </Block>
        <Block tint>
          <div className="rp-split">
            <Heading
              eyebrow="On the record"
              title={
                <>
                  The details, on
                  <br />
                  the record
                </>
              }
            />
            <dl className="rp-record">
              {[
                ["Legal name", "Scout Travel Solution Limited"],
                ["Registration", "Private limited company, Kenya"],
                ["Incorporated", "22 June 2022"],
                [
                  "Head office",
                  "Sultan Business Park, Waaberi District, Mogadishu",
                ],
                ["Nairobi office", "Yare Plaza, Eastleigh, Nairobi"],
                [
                  "Hajj and Umrah licence",
                  "Ministry of Commerce and Industry, Somalia",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Block>
        <Block>
          <Heading title="One team for every journey" />
          <Services />
        </Block>
        <Block tint>
          <Heading title="We travel with our pilgrims" />
          <div className="rp-grid rp-three">
            {["umrah-group", "ziyarah-guide", "umrah-team"].map((i) => (
              <Picture
                src={`/about/${i}.webp`}
                alt="STS pilgrim team"
                key={i}
              />
            ))}
          </div>
        </Block>
        <Block>
          <Callback />
        </Block>
      </>
    );
  else if (screen === "contact")
    content = (
      <>
        <Intro
          tag="Contact"
          title={
            <>
              Talk to a real person,{" "}
              <em>
                in Somali,
                <br />
                English or Arabic.
              </em>
            </>
          }
          text="Call, WhatsApp or visit our offices. A real booking desk, before you book and long after you travel."
        />
        <Block>
          <div className="rp-grid rp-three rp-contact-cards">
            {[
              [Phone, "Call us", "+252 611 444 420"],
              [MessageCircle, "WhatsApp", "Message our desk"],
              [Mail, "Email", "info@scoutsts.com"],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Phone;
              return (
                <div key={String(title)}>
                  <I />
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </div>
              );
            })}
          </div>
          <div className="rp-two-column rp-contact-layout">
            <div>
              <Picture
                src="/about/sultan-business-park.webp"
                alt="STS office"
              />
              {["Mogadishu", "Nairobi"].map((c, i) => (
                <div className="rp-office" key={c}>
                  <Label>{i ? "Kenya office" : "Head office"}</Label>
                  <h3>{c}</h3>
                  <p>
                    {i
                      ? "Yare Plaza, 3rd Floor, Office 308, Eastleigh"
                      : "First Floor 111, Sultan Business Park, Waaberi District"}
                  </p>
                  <Button secondary to="about">
                    Directions →
                  </Button>
                </div>
              ))}
            </div>
            <RequestForm
              title="Send us a message"
              fields={[
                "Your name",
                "Email address",
                "Phone / WhatsApp",
                "Service",
              ]}
              button="Send message"
            />
          </div>
        </Block>
      </>
    );
  else if (screen === "faq")
    content = (
      <>
        <Intro
          tag="FAQ"
          title={
            <>
              Questions people ask us,
              <br />
              <em>answered.</em>
            </>
          }
          text="Straight answers from our team. If your question isn’t here, call or message us."
        />
        <Block>
          <div className="rp-list-layout">
            <aside className="rp-side-links">
              {[
                "Booking & payments",
                "Flights",
                "Hotels",
                "Umrah",
                "Visas",
                "Changes & refunds",
                "Travelling",
              ].map((t) => (
                <button
                  onClick={() => setFilter(t)}
                  className={filter === t ? "is-selected" : ""}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </aside>
            <Faq full />
          </div>
        </Block>
      </>
    );
  else if (screen === "iso")
    content = (
      <>
        <Intro
          tag="ISO 9001:2015"
          title={
            <>
              Quality you can check,{" "}
              <em>
                not just
                <br />a promise.
              </em>
            </>
          }
          text="STS is ISO 9001:2015 certified. Our quality management system covers the way we plan, book and support every journey."
        />
        <Block>
          <div className="rp-two-column">
            <div className="rp-certificate">
              <ShieldCheck size={44} />
              <h2>ISO 9001:2015</h2>
              <p>Certificate of Registration</p>
              <h3>Scout Travel Solution Limited</h3>
              <hr />
              <dl>
                <dt>Certification body</dt>
                <dd>TQC Cert</dd>
                <dt>Certificate</dt>
                <dd>TQC-25-1-1428</dd>
                <dt>Quality standard</dt>
                <dd>ISO 9001:2015</dd>
              </dl>
              <Button secondary to="contact">
                View the original certificate
              </Button>
            </div>
            <div>
              <Heading title="The same careful process, every booking" />
              {[
                "Documented steps",
                "Checks before confirmation",
                "A record of every booking",
                "Accountability you can reach",
              ].map((t, i) => (
                <div className="rp-number-point" key={t}>
                  <span>{i + 1}</span>
                  <div>
                    <h3>{t}</h3>
                    <p>
                      From your first enquiry to your return, our desks follow a
                      consistent quality process.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Block>
      </>
    );
  else if (screen === "team")
    content = (
      <>
        <Intro
          tag="Our team"
          title={
            <>
              The people{" "}
              <em>
                behind your
                <br />
                booking.
              </em>
            </>
          }
          text="A local team in Mogadishu, Nairobi and the holy cities — with experience in flights, visas, Umrah and travel operations."
        />
        <Block>
          <Label>Leadership</Label>
          <div className="rp-person">
            <span>DS</span>
            <div>
              <h3>Daahir Salad</h3>
              <p>Chief Executive Officer</p>
            </div>
          </div>
          <div className="rp-grid rp-three rp-team">
            {[
              "Flight ticketing",
              "Visa desk",
              "Umrah operations",
              "Hotel partnerships",
              "Event bookings",
              "Customer support",
            ].map((t, i) => (
              <div key={t}>
                <span className="rp-avatar">{i + 1}</span>
                <h3>{t}</h3>
                <p>Meet the people behind your trip.</p>
              </div>
            ))}
          </div>
        </Block>
      </>
    );
  else if (root === "legal")
    content = (
      <>
        <Intro
          tag="Legal"
          title={
            <>
              Terms, <em>privacy and refunds.</em>
            </>
          }
        />
        <Block>
          <div className="rp-list-layout">
            <aside className="rp-side-links">
              {[
                ["Terms & conditions", "legal"],
                ["Privacy policy", "legal/privacy"],
                ["Refund policy", "legal/refunds"],
              ].map(([t, p]) => (
                <Link
                  className={screen === p ? "is-selected" : ""}
                  href={href(p)}
                  key={p}
                >
                  {t}
                </Link>
              ))}
            </aside>
            <article className="rp-prose">
              <h2>
                {screen.endsWith("privacy")
                  ? "Privacy policy"
                  : screen.endsWith("refunds")
                    ? "Refund policy"
                    : "Terms & conditions"}
              </h2>
              <small>Last updated · November 2026</small>
              {[
                "Who we are",
                "Booking and confirmation",
                "Prices and payment",
                "Travel documents",
                "Changes and cancellations",
                "Refunds",
                "Your responsibilities",
                "Contact us",
              ].map((t, i) => (
                <section key={t}>
                  <h3>
                    {i + 1}. {t}
                  </h3>
                  <p>
                    Scout Travel Solution provides travel booking and support
                    through our offices in Mogadishu and Nairobi. Please review
                    the conditions shown for your selected service before
                    confirming a booking.
                  </p>
                </section>
              ))}
            </article>
          </div>
        </Block>
      </>
    );
  else if (screen === "flights/results")
    content = (
      <>
        {crumb}
        <Block>
          <div className="rp-heading-row">
            <div>
              <h1>Mogadishu (MGQ) – Dubai (DXB)</h1>
              <p>Return · 1 adult · Economy</p>
            </div>
            <Button secondary to="flights">
              Change search
            </Button>
          </div>
          <div className="rp-progress">
            Search <span>→</span> Select flights <span>→</span> Passengers{" "}
            <span>→</span> Payment <span>→</span> Confirmation
          </div>
          <div className="rp-note">
            Fares are indicative. Our ticketing desk confirms availability
            before payment.
          </div>
          <h3>Outbound</h3>
          {["Turkish Airlines", "Ethiopian Airlines", "Qatar Airways"].map(
            (air, i) => (
              <div className="rp-card rp-flight-result" key={air}>
                <span className="rp-icon">
                  <Plane />
                </span>
                <div>
                  <b>{air}</b>
                  <small>Economy · 1 stop</small>
                </div>
                <strong>
                  {["09:45", "12:00", "15:30"][i]} <small>MGQ</small>
                </strong>
                <span className="rp-flight-line">6h 20m ─── ✈ ───</span>
                <strong>
                  {["19:00", "21:15", "23:45"][i]} <small>DXB</small>
                </strong>
                <div>
                  <small>USD (fare)</small>
                  <Button to="login">Select</Button>
                </div>
              </div>
            ),
          )}
        </Block>
      </>
    );
  else if (screen === "hotels/berbera")
    content = (
      <>
        {crumb}
        <Block className="rp-compact">
          <div className="rp-gallery">
            <Picture src="/marketing/hotel.webp" alt="Berbera Pearl Resort" />
            <div>
              <Picture src="/marketing/hotel-room.webp" alt="Resort room" />
              <Picture src="/marketing/hotel-pool.webp" alt="Resort pool" />
            </div>
          </div>
          <div className="rp-detail-layout">
            <article>
              <small className="rp-stars">★★★★</small>
              <h1>Berbera Pearl Resort</h1>
              <p>
                <MapPin size={14} /> Berbera, Somalia
              </p>
              <div className="rp-chips">
                <span>Wifi</span>
                <span>Pool</span>
                <span>Restaurant</span>
                <span>Beachfront</span>
              </div>
              <h3>About the property</h3>
              <p>
                A beachfront stay on the Gulf of Aden, with comfortable rooms, a
                restaurant and space to unwind by the sea.
              </p>
              <h2>Choose your room</h2>
              {["Standard room", "Deluxe room", "Suite"].map((t, i) => (
                <div className="rp-card rp-room-option" key={t}>
                  <BedDouble />
                  <div>
                    <h3>{t}</h3>
                    <small>2 adults · Breakfast included</small>
                  </div>
                  <b>USD {130 + i * 40}</b>
                  <Button to="login">Select room</Button>
                </div>
              ))}
            </article>
            <RequestForm
              price="USD 130 / night"
              fields={["Check-in date", "Check-out date", "Guests"]}
              button="Continue to booking"
            />
          </div>
        </Block>
      </>
    );
  else if (screen === "umrah/premium")
    content = (
      <>
        {crumb}
        <Block className="rp-compact">
          <div className="rp-image-hero">
            <Picture
              src="/marketing/umrah-hero.webp"
              alt="Makkah premium Umrah"
            />
            <div>
              <span className="rp-tag">Premium</span>
              <h1>
                14-Day Premium
                <br />
                Umrah
              </h1>
              <p>MGQ → JED · 14 days / 13 nights · Flights + visa + hotels</p>
            </div>
          </div>
          <div className="rp-detail-layout">
            <article>
              <h3>What’s included</h3>
              <div className="rp-inclusions">
                {[
                  "Return flights",
                  "Umrah visa",
                  "Makkah accommodation",
                  "Madinah accommodation",
                  "Ground transport",
                  "Somali-speaking guide",
                  "Ziyarah visits",
                  "Group support",
                ].map((t) => (
                  <span key={t}>
                    <Check size={15} />
                    {t}
                  </span>
                ))}
              </div>
              <h2>1. Choose a departure</h2>
              <div className="rp-departures">
                {[
                  "Departure date 1",
                  "Departure date 2",
                  "Departure date 3",
                ].map((t, i) => (
                  <label key={t}>
                    <input type="radio" name="departure" defaultChecked={!i} />
                    <span>
                      <b>{t}</b>
                      <small>14 days · seats available</small>
                    </span>
                  </label>
                ))}
              </div>
              <h2>2. Choose a room type</h2>
              <div className="rp-room-types">
                {["Quad", "Triple", "Double"].map((t) => (
                  <button
                    className={room === t ? "is-selected" : ""}
                    key={t}
                    onClick={() => setRoom(t)}
                  >
                    <BedDouble />
                    <b>{t}</b>
                    <small>
                      {t === "Quad" ? "4" : t === "Triple" ? "3" : "2"} pilgrims
                      per room
                    </small>
                  </button>
                ))}
              </div>
              <div className="rp-heading-row">
                <h3>3. How many pilgrims?</h3>
                <div className="rp-counter">
                  <button
                    aria-label="Fewer pilgrims"
                    onClick={() => setPeople(Math.max(1, people - 1))}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{people}</span>
                  <button
                    aria-label="More pilgrims"
                    onClick={() => setPeople(Math.min(20, people + 1))}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </article>
            <RequestForm
              title="Your package"
              price={`USD ${(people * (room === "Quad" ? 1850 : room === "Triple" ? 2050 : 2350)).toLocaleString()}`}
              fields={["Full name", "Email address", "Phone / WhatsApp"]}
              button="Continue to pilgrim details"
            />
          </div>
        </Block>
      </>
    );
  else if (screen === "visa/uae")
    content = (
      <>
        {crumb}
        <Block>
          <div className="rp-two-column rp-visa-detail">
            <div>
              <span className="rp-pill">Visa assistance</span>
              <h1>
                United Arab Emirates visa for <em>Somali passport holders.</em>
              </h1>
              <p>Tourist visa · Document review by our desk</p>
            </div>
            <Picture src="/marketing/dubai.webp" alt="Dubai skyline" />
          </div>
          <div className="rp-detail-layout">
            <article>
              <div className="rp-progress">
                Requirements → Uploads → Review → Submit
              </div>
              <h2>What we need</h2>
              <div className="rp-document-list">
                {[
                  "Passport",
                  "Passport photo",
                  "Return ticket or itinerary",
                  "Accommodation details",
                ].map((t) => (
                  <div key={t}>
                    <FileText size={20} />
                    <span>
                      <h3>{t}</h3>
                      <small>Clear, readable copy</small>
                    </span>
                    <input
                      type="file"
                      aria-label={`Upload ${t}`}
                      accept="image/*,.pdf"
                    />
                  </div>
                ))}
              </div>
              <h2>Before you apply</h2>
              <p>
                Check that your passport is valid and that your details match
                every document.
              </p>
              <Button to="login">Start application</Button>
            </article>
            <div className="rp-card rp-card-body">
              <h3>Your application</h3>
              <dl className="rp-record">
                <div>
                  <dt>Destination</dt>
                  <dd>United Arab Emirates</dd>
                </div>
                <div>
                  <dt>Visa</dt>
                  <dd>Tourist</dd>
                </div>
                <div>
                  <dt>Processing</dt>
                  <dd>Desk confirmation</dd>
                </div>
              </dl>
              <p className="rp-price">USD 120</p>
            </div>
          </div>
        </Block>
      </>
    );
  else if (screen === "events/sultan")
    content = (
      <>
        {crumb}
        <Block className="rp-compact">
          <Picture
            src="/marketing/events-hall.webp"
            alt="Sultan Grand Ballroom"
            className="rp-detail-cover"
          />
          <div className="rp-detail-layout">
            <article>
              <small>Wedding · Mogadishu</small>
              <h1>Sultan Grand Ballroom</h1>
              <p>
                <MapPin size={15} /> Mogadishu, Somalia
              </p>
              <div className="rp-chips">
                <span>1,400 guests</span>
                <span>Catering available</span>
                <span>Parking</span>
                <span>Air conditioning</span>
              </div>
              <h3>About the venue</h3>
              <p>
                A spacious ballroom for weddings, conferences and celebrations,
                with flexible seating and catering arrangements.
              </p>
              <h3>Location</h3>
              <div className="rp-map">
                <MapPin size={30} />
                <span>Mogadishu</span>
              </div>
            </article>
            <RequestForm
              title="Request this hall"
              price="USD 2,500 / event"
              fields={[
                "Event date",
                "Number of guests",
                "Full name",
                "Email address",
                "Phone / WhatsApp",
              ]}
              button="Send request"
            />
          </div>
        </Block>
      </>
    );
  else if (screen === "account")
    content = (
      <>
        {crumb}
        <Intro
          tag="My account"
          title="Welcome back, Amina"
          text="Manage your bookings, payments and travellers."
        />
        <Block>
          <div className="rp-list-layout">
            <aside className="rp-side-links">
              {[
                "My bookings",
                "Personal information",
                "Saved travellers",
                "Payments & receipts",
                "Security",
                "Log out",
              ].map((t) => (
                <button
                  key={t}
                  className={filter === t ? "is-selected" : ""}
                  onClick={() => setFilter(t)}
                >
                  {t}
                </button>
              ))}
            </aside>
            <div>
              <div className="rp-heading-row">
                <h2>{filter === "All" ? "My bookings" : filter}</h2>
                <Button secondary to="home">
                  New booking
                </Button>
              </div>
              {[
                ["Mogadishu → Dubai", "Flights", "Confirmed"],
                ["14-Day Premium Umrah", "Umrah", "Payment pending"],
                ["Berbera Pearl Resort", "Hotel", "Confirmed"],
                ["UAE tourist visa", "Visa", "In review"],
              ].map(([n, s, t]) => (
                <div className="rp-card rp-account-row" key={n}>
                  <span className="rp-icon">
                    <Plane size={19} />
                  </span>
                  <div>
                    <h3>{n}</h3>
                    <small>{s} · Reference STS-2026-00124</small>
                  </div>
                  <span
                    className={`rp-status ${t === "Confirmed" ? "" : "rp-status-warm"}`}
                  >
                    {t}
                  </span>
                  <Link
                    href={href(
                      s === "Umrah"
                        ? "umrah/premium"
                        : s === "Hotel"
                          ? "hotels/berbera"
                          : s === "Visa"
                            ? "visa/uae"
                            : "flights/results",
                    )}
                  >
                    View booking →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </Block>
      </>
    );
  else if (screen === "404")
    content = (
      <Block>
        <div className="rp-not-found">
          <b>404</b>
          <h1>This page took a different flight.</h1>
          <p>The page you’re looking for may have moved or no longer exists.</p>
          <div className="rp-chips">
            {nav.slice(0, 4).map(([p, n]) => (
              <Link href={href(p)} key={p}>
                {n}
              </Link>
            ))}
          </div>
          <Button to="home">Back to home</Button>
        </div>
      </Block>
    );
  else
    content = (
      <Intro title="Page not found">
        <Button to="home">Back to home</Button>
      </Intro>
    );
  if (screen === "login")
    return (
      <div className="reference-preview rp-login">
        <div className="rp-login-photo">
          <Picture src="/about/reception.webp" alt="STS travel desk" />
          <div>
            <Label>Scout Travel Solution</Label>
            <h1>
              Your travel desk.
              <br />
              <strong>Wherever you go.</strong>
            </h1>
            <p>
              Flights, hotels, visas, Umrah and events —<br />
              from our team in Mogadishu and Nairobi.
            </p>
            <small>
              <ShieldCheck size={15} /> ISO 9001:2015 certified
            </small>
          </div>
        </div>
        <div className="rp-login-body">
          <div className="rp-heading-row">
            <StsBrandLogo className="rp-logo" />
            <Link href={href("home")}>← Back to website</Link>
          </div>
          <div className="rp-login-form">
            <h1>Welcome back.</h1>
            <p>Sign in to manage your bookings.</p>
            <div className="rp-tabs">
              {["Customer", "Agent", "Hotel partner", "Affiliate"].map((t) => (
                <button
                  type="button"
                  onClick={() => setLoginTab(t)}
                  className={loginTab === t ? "is-selected" : ""}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                window.location.assign(href("account"));
              }}
            >
              <Fields items={["Email address", "Password"]} />
              <Link href={href("contact")} className="rp-forgot">
                Forgot password?
              </Link>
              <label className="rp-check">
                <input type="checkbox" />
                Keep me signed in
              </label>
              <Button>Log in →</Button>
            </form>
            <p className="rp-login-bottom">
              New to STS? <Link href={href("contact")}>Create an account</Link>
            </p>
          </div>
          <small className="rp-preview-label">
            UI preview · sample content · no live transactions
          </small>
        </div>
      </div>
    );
  return (
    <div className="reference-preview">
      <header className="rp-header">
        <div className="rp-container">
          <Link href={href("home")} aria-label="STS home">
            <StsBrandLogo className="rp-logo" />
          </Link>
          <nav
            aria-label="Main navigation"
            className={mobile ? "rp-nav rp-nav-open" : "rp-nav"}
          >
            {nav.map(([p, n]) => (
              <Link
                className={root === p ? "is-active" : ""}
                href={href(p)}
                onClick={() => setMobile(false)}
                key={p}
              >
                {n}
              </Link>
            ))}
          </nav>
          <div className="rp-header-actions">
            <Button secondary to={screen === "account" ? "account" : "login"}>
              {screen === "account" ? "My account" : "Log in"}
            </Button>
            <Button to="contact">Plan my trip</Button>
          </div>
          <button
            className="rp-mobile-toggle"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>{content}</main>
      <Footer />
      <button
        className="rp-preview-switch"
        onClick={() => setDirectory(!directory)}
        aria-expanded={directory}
      >
        UI preview · {previewPages.findIndex(([p]) => p === screen) + 1}/20{" "}
        <ChevronDown size={13} />
      </button>
      {directory && (
        <nav className="rp-preview-directory" aria-label="Reference screens">
          {previewPages.map(([p, n], i) => (
            <Link key={p} href={href(p)} onClick={() => setDirectory(false)}>
              {String(i + 1).padStart(2, "0")} · {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
