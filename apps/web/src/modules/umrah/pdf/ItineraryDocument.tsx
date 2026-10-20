import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { pdfText } from "@/lib/pdf-text";
import { stsLogo, STS_LOGO_ASPECT } from "@/lib/pdf-logo";
import { CITY_LABEL } from "@/modules/umrah/itinerary";
import type { BookingTravel } from "@/modules/umrah/itinerary-queries";

/**
 * The pilgrim's dated itinerary: who is travelling, flights, hotels with
 * dates, and the day plan. Same paperwork family as the voucher and invoice.
 * Every string goes through pdfText() (WinAnsi-only Helvetica).
 */

const PRIMARY = "#00947c";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1f2937", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  brand: { fontSize: 20, fontWeight: 700, color: PRIMARY },
  logo: { width: 96, height: 96 / STS_LOGO_ASPECT, marginBottom: 6 },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  docTitle: { fontSize: 16, fontWeight: 700, textAlign: "right" },
  docMeta: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 2 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", marginTop: 14, marginBottom: 6 },
  line: { fontSize: 9, marginTop: 2 },
  muted: { fontSize: 9, color: MUTED, marginTop: 1 },
  dayRow: { flexDirection: "row", borderTop: `1px solid ${BORDER}`, paddingTop: 6, paddingBottom: 6 },
  dayDate: { width: 90 },
  dayDateText: { fontSize: 9, fontWeight: 700 },
  dayBody: { flex: 1 },
  dayTitle: { fontSize: 10, fontWeight: 700 },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, textAlign: "center", fontSize: 8, color: MUTED },
});

function day(value: string, pattern: string) {
  return format(new Date(`${value}T00:00:00`), pattern);
}

export function ItineraryDocument({
  orderNumber,
  title,
  pilgrims,
  travel,
  outbound,
  inbound,
}: {
  orderNumber: string;
  title: string;
  pilgrims: string[];
  travel: BookingTravel;
  outbound: string | null;
  inbound: string | null;
}) {
  const logo = stsLogo();
  const itinerary = travel.itinerary;
  const contact = travel.contact;

  return (
    <Document title={`STS Itinerary ${orderNumber}`} author="Scout Travel Solution Ltd">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image takes no alt prop. */}
            {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.brand}>STS</Text>}
            <Text style={styles.brandSub}>Scout Travel Solution Ltd</Text>
            <Text style={styles.brandSub}>+252 611 444 420 · info@scoutsts.com</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>UMRAH ITINERARY</Text>
            <Text style={styles.docMeta}>{orderNumber}</Text>
            <Text style={styles.docMeta}>{pdfText(title)}</Text>
          </View>
        </View>

        {pilgrims.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Pilgrims</Text>
            <Text style={styles.line}>{pdfText(pilgrims.join(", "))}</Text>
          </View>
        ) : null}

        {outbound || inbound ? (
          <View>
            <Text style={styles.sectionTitle}>Flights</Text>
            {outbound ? <Text style={styles.line}>{pdfText(`Outbound: ${outbound}`)}</Text> : null}
            {inbound ? <Text style={styles.line}>{pdfText(`Return: ${inbound}`)}</Text> : null}
          </View>
        ) : null}

        {travel.hotels.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Hotels</Text>
            {travel.hotels.map((hotel) => (
              <Text key={`${hotel.city}-${hotel.name}`} style={styles.line}>
                {pdfText(
                  [
                    hotel.name,
                    CITY_LABEL[hotel.city] ?? hotel.city,
                    hotel.checkIn && hotel.checkOut
                      ? `${day(hotel.checkIn, "d MMM yyyy")} – ${day(hotel.checkOut, "d MMM yyyy")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}
              </Text>
            ))}
          </View>
        ) : null}

        {itinerary ? (
          <View>
            <Text style={styles.sectionTitle}>Day by day</Text>
            {itinerary.entries.map((entry) => (
              <View key={entry.date} style={styles.dayRow} wrap={false}>
                <View style={styles.dayDate}>
                  <Text style={styles.dayDateText}>{day(entry.date, "EEE d MMM")}</Text>
                  <Text style={styles.muted}>Day {entry.dayNumber}</Text>
                </View>
                <View style={styles.dayBody}>
                  {entry.title ? <Text style={styles.dayTitle}>{pdfText(entry.title)}</Text> : null}
                  {entry.description ? <Text style={styles.muted}>{pdfText(entry.description)}</Text> : null}
                  {entry.travel.map((line) => (
                    <Text key={line} style={styles.line}>
                      {pdfText(line)}
                    </Text>
                  ))}
                  {entry.stay ? (
                    <Text style={styles.muted}>
                      {pdfText(`${entry.stay.name} · ${CITY_LABEL[entry.stay.city] ?? entry.stay.city}`)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionTitle}>Contact</Text>
          {contact?.name || contact?.phone ? (
            <Text style={styles.line}>
              {pdfText([contact?.name, contact?.phone, contact?.whatsapp ? `WhatsApp ${contact.whatsapp}` : null].filter(Boolean).join(" · "))}
            </Text>
          ) : null}
          <Text style={styles.line}>STS: +252 611 444 420</Text>
        </View>

        <Text style={styles.footer} fixed>
          Scout Travel Solution Ltd · ISO 9001:2015 certified · IATA TIDS accredited
        </Text>
      </Page>
    </Document>
  );
}
