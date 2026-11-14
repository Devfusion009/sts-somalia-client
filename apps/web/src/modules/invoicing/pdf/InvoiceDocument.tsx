import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { differenceInCalendarDays, format } from "date-fns";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { pdfText } from "@/lib/pdf-text";
import { stsLogo, STS_LOGO_ASPECT } from "@/lib/pdf-logo";

const PRIMARY = "#00947c";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: PRIMARY },
  page: { padding: 40, paddingTop: 48, fontSize: 10, color: "#1f2937", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: 700, color: PRIMARY },
  // Width chosen so the mark sits level with the INVOICE title opposite it.
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
  pendingBadge: { backgroundColor: "#d97706" },
  dueBlock: { marginTop: 24, padding: 12, backgroundColor: "#fffbeb", borderRadius: 4, borderLeft: "3px solid #d97706" },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  partyBlock: { width: "48%" },
  partyLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700 },
  partyLine: { fontSize: 9, color: MUTED, marginTop: 1 },
  table: { marginTop: 8, borderTop: `1px solid ${BORDER}` },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottom: `1px solid ${BORDER}`,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottom: `1px solid ${BORDER}`,
  },
  colItem: { width: "60%" },
  colQty: { width: "15%", textAlign: "right" },
  colAmount: { width: "25%", textAlign: "right" },
  thText: { fontSize: 8, color: MUTED, textTransform: "uppercase", fontWeight: 700 },
  itemTitle: { fontSize: 10, fontWeight: 700 },
  itemSubtitle: { fontSize: 8, color: MUTED, marginTop: 2 },
  totalsBlock: { marginTop: 16, alignSelf: "flex-end", width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: MUTED },
  totalsValue: { fontSize: 9 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTop: `1px solid ${BORDER}`,
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700, color: PRIMARY },
  paymentBlock: { marginTop: 24, padding: 12, backgroundColor: "#f9fafb", borderRadius: 4 },
  paymentLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 3 },
  paymentText: { fontSize: 10 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 10,
  },
  footerText: { fontSize: 8, color: MUTED, textAlign: "center" },
});

function money(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export function InvoiceDocument({
  order,
  invoiceNumber,
  issuedAt,
  customer,
  agencyName,
  proforma = false,
}: {
  order: CheckoutOrderRow;
  invoiceNumber: string;
  issuedAt: string;
  customer: { full_name: string | null; email: string | null; phone?: string | null };
  agencyName: string | null;
  /** Unpaid order: titled and labelled as a proforma, with the amount due. */
  proforma?: boolean;
}) {
  const succeededPayment = order.payments.find((p) => p.status === "succeeded");
  const logo = stsLogo();
  const isSettled = order.status === "paid" || order.status === "processing" || order.status === "completed";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} fixed />
        <View style={styles.headerRow}>
          <View>
            {/* Falls back to the wordmark if the asset can't be read, so a
                missing file degrades the header rather than failing the PDF. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's
                Image is not an HTML <img>: it takes no alt prop, and a PDF has no
                alt-text channel for it to land in. The rule is matching on the
                component name alone. */}
            {logo ? <Image src={logo} style={styles.logo} /> : (
              <Text style={styles.brand}>STS Somalia</Text>
            )}
            <Text style={styles.brandSub}>Scout Travel Solution</Text>
            <Text style={styles.brandSub}>First Floor 111, Sultan Business Park, Waaberi District, Mogadishu</Text>
            <Text style={styles.brandSub}>+252 611 444 420 · info@scoutsts.com</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>{proforma ? "PROFORMA INVOICE" : isSettled ? "INVOICE / RECEIPT" : "INVOICE"}</Text>
            <Text style={styles.docMeta}>{invoiceNumber}</Text>
            <Text style={styles.docMeta}>Issued {format(new Date(issuedAt), "d MMM yyyy")}</Text>
            <Text style={styles.docMeta}>Order {order.order_number}</Text>
            {isSettled ? (
              <Text style={styles.statusBadge}>Paid</Text>
            ) : proforma ? (
              <Text style={[styles.statusBadge, styles.pendingBadge]}>Payment pending</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Billed to</Text>
            <Text style={styles.partyName}>{customer.full_name ?? "Customer"}</Text>
            {customer.email ? <Text style={styles.partyLine}>{customer.email}</Text> : null}
            {customer.phone ? <Text style={styles.partyLine}>{customer.phone}</Text> : null}
            {agencyName ? <Text style={styles.partyLine}>Booked via {agencyName}</Text> : null}
          </View>
          {succeededPayment ? (
            <View style={[styles.partyBlock, { alignItems: "flex-end" }]}>
              <Text style={styles.partyLabel}>Payment method</Text>
              <Text style={styles.partyName}>{succeededPayment.method_label ?? succeededPayment.provider}</Text>
              {succeededPayment.paid_at ? (
                <Text style={styles.partyLine}>
                  Paid {format(new Date(succeededPayment.paid_at), "d MMM yyyy, HH:mm")}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colItem, styles.thText]}>Item</Text>
            <Text style={[styles.colQty, styles.thText]}>Qty</Text>
            <Text style={[styles.colAmount, styles.thText]}>Amount</Text>
          </View>
          {order.order_items.map((item) => {
            const info = describeOrderItem(item);
            const guestNames =
              item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
            return (
              <View key={item.id} style={styles.tableRow}>
                <View style={styles.colItem}>
                  <Text style={styles.itemTitle}>{pdfText(info.title)}</Text>
                  {info.subtitle ? <Text style={styles.itemSubtitle}>{pdfText(info.subtitle)}</Text> : null}
                  {item.item_type === "hotel" && item.hotel_booking ? (
                    <Text style={styles.itemSubtitle}>
                      {differenceInCalendarDays(
                        new Date(item.hotel_booking.check_out),
                        new Date(item.hotel_booking.check_in)
                      )}{" "}
                      night(s)
                    </Text>
                  ) : null}
                  {guestNames.length > 0 ? (
                    <Text style={styles.itemSubtitle}>Guests: {guestNames.join(", ")}</Text>
                  ) : null}
                </View>
                <Text style={[styles.colQty, { fontSize: 10 }]}>{item.quantity}</Text>
                <Text style={[styles.colAmount, { fontSize: 10, fontWeight: 700 }]}>
                  {money(item.total_price, order.currency)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{money(order.subtotal, order.currency)}</Text>
          </View>
          {Number(order.markup_amount) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Service fee</Text>
              <Text style={styles.totalsValue}>{money(order.markup_amount, order.currency)}</Text>
            </View>
          ) : null}
          {Number(order.discount_total) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>-{money(order.discount_total, order.currency)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{money(order.total, order.currency)}</Text>
          </View>
        </View>

        {proforma && !isSettled ? (
          <View style={styles.dueBlock}>
            <Text style={styles.paymentLabel}>Amount due</Text>
            <Text style={[styles.paymentText, { fontWeight: 700 }]}>{money(order.total, order.currency)}</Text>
            <Text style={[styles.paymentText, { marginTop: 4 }]}>
              Quote ref {order.order_number}. A tax invoice is issued once payment is received.
            </Text>
          </View>
        ) : (
        <View style={styles.paymentBlock}>
          <Text style={styles.paymentLabel}>Booking status</Text>
          <Text style={styles.paymentText}>
            {isSettled
              ? "This order is paid and confirmed. This document also serves as your booking confirmation / voucher — please present it if requested at check-in or during your trip."
              : `Order status: ${order.status.replace(/_/g, " ")}.`}
          </Text>
        </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {proforma ? "STS Somalia — proforma invoice, not a receipt." : "STS Somalia — this invoice also serves as your booking voucher."} Questions? WhatsApp us
            at +252 611 444 420 with your order number {order.order_number}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
