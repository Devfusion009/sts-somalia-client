import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { AgencyCommissionEntry } from "@/modules/agencies/queries";

// Mirrors src/modules/invoicing/pdf/InvoiceDocument.tsx's palette/layout
// (teal STS branding) rather than introducing a new visual style.
const PRIMARY = "#00947c";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1f2937", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: 700, color: PRIMARY },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  docTitle: { fontSize: 16, fontWeight: 700, textAlign: "right" },
  docMeta: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 2 },
  partyBlock: { marginBottom: 20 },
  partyLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 4 },
  partyName: { fontSize: 12, fontWeight: 700 },
  summaryRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  summaryBox: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  summaryLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase" },
  summaryValue: { fontSize: 14, fontWeight: 700, color: PRIMARY, marginTop: 3 },
  table: { marginTop: 8, borderTop: `1px solid ${BORDER}` },
  tableHeaderRow: { flexDirection: "row", paddingVertical: 6, borderBottom: `1px solid ${BORDER}` },
  tableRow: { flexDirection: "row", paddingVertical: 7, borderBottom: `1px solid ${BORDER}` },
  colOrder: { width: "28%" },
  colRate: { width: "12%", textAlign: "right" },
  colAmt: { width: "18%", textAlign: "right" },
  colStatus: { width: "18%", paddingLeft: 16 },
  thText: { fontSize: 8, color: MUTED, textTransform: "uppercase", fontWeight: 700 },
  cellText: { fontSize: 9 },
  cellMuted: { fontSize: 8, color: MUTED, marginTop: 1 },
  footer: { position: "absolute", bottom: 32, left: 40, right: 40, borderTop: `1px solid ${BORDER}`, paddingTop: 10 },
  footerText: { fontSize: 8, color: MUTED, textAlign: "center" },
});

function money(amount: number, currency = "USD") {
  return `${currency} ${amount.toFixed(2)}`;
}

// Rows are split into explicit pages. One auto-wrapping page re-lays out the
// remaining rows at every break, so render time grew with the square of the
// row count (1,500 entries: 13.6 s). Sized below what fits — 15 rows under
// the header on page 1, 22 on later pages — so no page has to wrap.
const FIRST_PAGE_ROWS = 14;
const PAGE_ROWS = 20;

function chunkRows<T>(rows: T[]): T[][] {
  const pages = [rows.slice(0, FIRST_PAGE_ROWS)];
  for (let i = FIRST_PAGE_ROWS; i < rows.length; i += PAGE_ROWS) pages.push(rows.slice(i, i + PAGE_ROWS));
  return pages;
}

export function StatementDocument({
  agencyName,
  periodLabel,
  entries,
}: {
  agencyName: string;
  periodLabel: string;
  entries: AgencyCommissionEntry[];
}) {
  const earning = entries.filter((e) => e.status !== "reversed");
  const total = earning.reduce((sum, e) => sum + Number(e.amount), 0);
  const commission = earning.reduce((sum, e) => sum + Number(e.commission_amount), 0);
  const markup = earning.reduce((sum, e) => sum + Number(e.markup_amount), 0);

  const pages = chunkRows(earning);

  return (
    <Document>
      {pages.map((rows, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {pageIndex === 0 ? (
            <>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.brand}>STS Somalia</Text>
                  <Text style={styles.brandSub}>Scout Travel Solution</Text>
                  <Text style={styles.brandSub}>Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho</Text>
                </View>
                <View>
                  <Text style={styles.docTitle}>COMMISSION STATEMENT</Text>
                  <Text style={styles.docMeta}>{periodLabel}</Text>
                  <Text style={styles.docMeta}>Generated {format(new Date(), "d MMM yyyy")}</Text>
                </View>
              </View>

              <View style={styles.partyBlock}>
                <Text style={styles.partyLabel}>Agency</Text>
                <Text style={styles.partyName}>{agencyName}</Text>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Commission</Text>
                  <Text style={styles.summaryValue}>{money(commission)}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Markup</Text>
                  <Text style={styles.summaryValue}>{money(markup)}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Total Earned</Text>
                  <Text style={styles.summaryValue}>{money(total)}</Text>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colOrder, styles.thText]}>Order</Text>
              <Text style={[styles.colRate, styles.thText]}>Rate</Text>
              <Text style={[styles.colAmt, styles.thText]}>Commission</Text>
              <Text style={[styles.colAmt, styles.thText]}>Markup</Text>
              <Text style={[styles.colStatus, styles.thText]}>Status</Text>
            </View>
            {earning.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.cellMuted}>No earnings in this period.</Text>
              </View>
            ) : (
              rows.map((entry) => (
                <View key={entry.id} style={styles.tableRow}>
                  <View style={styles.colOrder}>
                    <Text style={styles.cellText}>{entry.order?.order_number ?? "—"}</Text>
                    <Text style={styles.cellMuted}>{format(new Date(entry.created_at), "d MMM yyyy")}</Text>
                  </View>
                  <Text style={[styles.colRate, styles.cellText]}>{entry.rate_applied}%</Text>
                  <Text style={[styles.colAmt, styles.cellText]}>{money(Number(entry.commission_amount))}</Text>
                  <Text style={[styles.colAmt, styles.cellText]}>{money(Number(entry.markup_amount))}</Text>
                  <Text style={[styles.colStatus, styles.cellText]}>{entry.status.replace(/_/g, " ")}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>
              STS Somalia — for bookkeeping purposes. Questions? WhatsApp us at +252 611 444 420.
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
