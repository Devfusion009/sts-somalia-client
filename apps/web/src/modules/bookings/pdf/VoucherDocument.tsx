import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { pdfText } from "@/lib/pdf-text";
import { stsLogo, STS_LOGO_ASPECT } from "@/lib/pdf-logo";

/**
 * The travel voucher — the document a customer shows at a hotel desk, an
 * airline counter, or an embassy appointment.
 *
 * Distinct from the invoice: an invoice answers "what was paid", a voucher
 * answers "what was booked and who is travelling". Styling deliberately mirrors
 * InvoiceDocument so the two read as one family of paperwork.
 */

const PRIMARY = "#00947c";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1f2937", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: 700, color: PRIMARY },
  logo: { width: 96, height: 96 / STS_LOGO_ASPECT, marginBottom: 6 },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  docTitle: { fontSize: 16, fontWeight: 700, textAlign: "right" },
  docMeta: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 2 },
  statusBadge: {
    marginTop: 6,
    alignSelf: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#ffffff",
    backgroundColor: PRIMARY,
  },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  partyBlock: { width: "48%" },
  partyLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700 },
  partyLine: { fontSize: 9, color: MUTED, marginTop: 1 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 6,
  },
  itemCard: {
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 10,
    paddingBottom: 10,
  },
  itemHeadRow: { flexDirection: "row", justifyContent: "space-between" },
  itemType: {
    fontSize: 8,
    fontWeight: 700,
    color: PRIMARY,
    textTransform: "uppercase",
  },
  itemTitle: { fontSize: 11, fontWeight: 700, marginTop: 3 },
  itemSubtitle: { fontSize: 9, color: MUTED, marginTop: 2 },
  itemDetail: { fontSize: 9, marginTop: 4 },
  detailLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase" },
  notice: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderLeft: `3px solid ${PRIMARY}`,
  },
  noticeText: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
  },
});

// Departure times are stored as local wall time tagged UTC; render them as-is.
const FLIGHT_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function flightLine(
  airline: string | null,
  flightNumber: string | null,
  departsAt: string | null,
  arrivesAt: string | null
): string | null {
  const parts = [
    [airline, flightNumber].filter(Boolean).join(" ") || null,
    departsAt ? `Departs ${FLIGHT_TIME.format(new Date(departsAt))}` : null,
    arrivesAt ? `Arrives ${FLIGHT_TIME.format(new Date(arrivesAt))}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  flight: "Flight",
  visa: "Visa",
  umrah: "Umrah package",
  hall: "Event hall",
};

export function VoucherDocument({
  order,
  customer,
}: {
  order: CheckoutOrderRow;
  customer: { full_name: string | null; email: string | null };
}) {
  const logo = stsLogo();
  const issuedAt = new Date().toISOString();

  return (
    <Document
      title={`STS Voucher ${order.order_number}`}
      author="Scout Travel Solution Ltd"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's
                Image is not an HTML <img>: it takes no alt prop, and a PDF has no
                alt-text channel for it to land in. The rule is matching on the
                component name alone. */}
            {logo ? <Image src={logo} style={styles.logo} /> : (
              <Text style={styles.brand}>STS</Text>
            )}
            <Text style={styles.brandSub}>Scout Travel Solution Ltd</Text>
            <Text style={styles.brandSub}>
              First Floor 111, Sultan Business Park, Waaberi District, Mogadishu
            </Text>
            <Text style={styles.brandSub}>+252 611 444 420 · info@scoutsts.com</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>TRAVEL VOUCHER</Text>
            <Text style={styles.docMeta}>{order.order_number}</Text>
            <Text style={styles.docMeta}>
              Issued {format(new Date(issuedAt), "d MMM yyyy")}
            </Text>
            <Text style={styles.statusBadge}>{order.status.replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Issued to</Text>
            <Text style={styles.partyName}>{customer.full_name ?? "Traveller"}</Text>
            {customer.email ? <Text style={styles.partyLine}>{customer.email}</Text> : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Booking reference</Text>
            <Text style={styles.partyName}>{order.order_number}</Text>
            <Text style={styles.partyLine}>
              Booked {format(new Date(order.created_at), "d MMM yyyy")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Itinerary</Text>

        {order.order_items.map((item) => {
          const described = describeOrderItem(item);
          const guests =
            item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
          const umrah = item.item_type === "umrah" ? item.umrah_booking : null;
          const umrahPilgrims = (umrah?.umrah_pilgrims ?? []).map((p) => p.full_name);
          const umrahDeparture = umrah?.departure ?? null;
          const outbound = umrahDeparture
            ? flightLine(
                umrahDeparture.outbound_airline,
                umrahDeparture.outbound_flight_number,
                umrahDeparture.outbound_departs_at,
                umrahDeparture.outbound_arrives_at
              )
            : null;
          const inbound = umrahDeparture
            ? flightLine(
                umrahDeparture.return_airline,
                umrahDeparture.return_flight_number,
                umrahDeparture.return_departs_at,
                umrahDeparture.return_arrives_at
              )
            : null;

          return (
            <View key={item.id} style={styles.itemCard} wrap={false}>
              <View style={styles.itemHeadRow}>
                <Text style={styles.itemType}>
                  {TYPE_LABEL[item.item_type] ?? item.item_type}
                </Text>
                <Text style={styles.detailLabel}>
                  {item.quantity > 1 ? `Qty ${item.quantity}` : ""}
                </Text>
              </View>
              <Text style={styles.itemTitle}>{pdfText(described.title)}</Text>
              {described.subtitle ? (
                <Text style={styles.itemSubtitle}>{pdfText(described.subtitle)}</Text>
              ) : null}

              {guests.length > 0 ? (
                <View style={styles.itemDetail}>
                  <Text style={styles.detailLabel}>Guests</Text>
                  <Text>{guests.join(", ")}</Text>
                </View>
              ) : null}

              {umrahPilgrims.length > 0 ? (
                <View style={styles.itemDetail}>
                  <Text style={styles.detailLabel}>Pilgrims</Text>
                  <Text>{pdfText(umrahPilgrims.join(", "))}</Text>
                </View>
              ) : null}

              {outbound ? (
                <View style={styles.itemDetail}>
                  <Text style={styles.detailLabel}>Outbound flight</Text>
                  <Text>{pdfText(outbound)}</Text>
                </View>
              ) : null}

              {inbound ? (
                <View style={styles.itemDetail}>
                  <Text style={styles.detailLabel}>Return flight</Text>
                  <Text>{pdfText(inbound)}</Text>
                </View>
              ) : null}

              {umrahDeparture?.baggage_note ? (
                <View style={styles.itemDetail}>
                  <Text style={styles.detailLabel}>Baggage</Text>
                  <Text>{pdfText(umrahDeparture.baggage_note)}</Text>
                </View>
              ) : null}

              {item.item_type === "flight" && item.flight_booking ? (
                <View style={styles.itemDetail}>
                  <Text style={styles.detailLabel}>Departure</Text>
                  <Text>
                    {format(new Date(item.flight_booking.depart_at), "EEEE d MMMM yyyy, HH:mm")}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Present this voucher together with the passport used to book. It confirms the booking
            listed above; it is not a receipt — see the invoice for payment details. Changes and
            cancellations are subject to the supplier&apos;s fare rules. For assistance while
            travelling, contact STS on +252 611 444 420.
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          Scout Travel Solution Ltd · Licensed by the Ministry of Commerce and Industry, Somalia ·
          ISO 9001:2015 certified · IATA TIDS accredited
        </Text>
      </Page>
    </Document>
  );
}
