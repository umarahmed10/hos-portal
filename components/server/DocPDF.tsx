// Server-only PDF template — rendered by /api/pdf via @react-pdf/renderer.
// Must NOT have 'use client'. Do not import this in any Client Component.
import {
  Document, Page, Text, View, Image, StyleSheet,
} from "@react-pdf/renderer";
import { money, rowTotal, fmt } from "@/lib/utils";
import type { Doc } from "@/types";

// @react-pdf/renderer uses its own styling system (not CSS).
const s = StyleSheet.create({
  page:       { backgroundColor: "#ffffff", padding: 48, fontFamily: "Helvetica" },
  header:     { backgroundColor: "#090909", margin: -48, marginBottom: 32, padding: "24 48" },
  hBrand:     { fontSize: 8, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  hTitle:     { fontSize: 18, color: "#f5f0eb", fontFamily: "Helvetica-Bold" },
  hSub:       { fontSize: 10, color: "#777", marginTop: 2 },
  section:    { marginBottom: 24 },
  sLabel:     { fontSize: 8, color: "#aaa", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  bodyText:   { fontSize: 10, lineHeight: 1.8, color: "#333" },
  tableHead:  { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e5e5e5", paddingBottom: 6, marginBottom: 4 },
  tableRow:   { flexDirection: "row", borderBottomWidth: 1, borderColor: "#f0f0f0", paddingVertical: 8 },
  thDesc:     { flex: 3, fontSize: 8, color: "#aaa", letterSpacing: 1, textTransform: "uppercase" },
  thNum:      { flex: 1, fontSize: 8, color: "#aaa", letterSpacing: 1, textTransform: "uppercase", textAlign: "right" },
  tdDesc:     { flex: 3, fontSize: 10, color: "#222" },
  tdNum:      { flex: 1, fontSize: 10, color: "#555", textAlign: "right", fontFamily: "Courier" },
  tdNumBold:  { flex: 1, fontSize: 10, color: "#111", textAlign: "right", fontFamily: "Courier-Bold" },
  totalBox:   { alignSelf: "flex-end", backgroundColor: "#f9f9f9", borderRadius: 4, padding: 12, marginTop: 8, minWidth: 180 },
  totalRow:   { flexDirection: "row", justifyContent: "space-between", gap: 32, marginBottom: 4 },
  totalLabel: { fontSize: 9, color: "#888" },
  totalAmt:   { fontSize: 9, color: "#555", fontFamily: "Courier" },
  totalDivider: { borderBottomWidth: 1, borderColor: "#ddd", marginVertical: 6 },
  grandLabel: { fontSize: 12, color: "#111", fontFamily: "Helvetica-Bold" },
  grandAmt:   { fontSize: 16, color: "#111", fontFamily: "Courier-Bold" },
  sigSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: "#e5e5e5" },
  sigLabel:   { fontSize: 8, color: "#aaa", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  sigImg:     { width: 200, height: 48, objectFit: "contain", backgroundColor: "#f5f5f5", borderRadius: 4 },
  footer:     { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#bbb" },
  metaRow:    { flexDirection: "row", gap: 32, marginBottom: 16 },
  metaCol:    { flex: 1 },
  metaLabel:  { fontSize: 8, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 },
  metaValue:  { fontSize: 10, color: "#333" },
});

export function DocPDF({ doc }: { doc: Doc }) {
  const showAg  = doc.type === "agreement" || doc.type === "both";
  const showInv = doc.type === "invoice"   || doc.type === "both";

  return (
    <Document title={`HOS — ${doc.name} — ${doc.code}`}>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.hBrand}>HOS Automations</Text>
          <Text style={s.hTitle}>
            {showAg && showInv ? "Service Agreement & Invoice"
              : showAg ? "Service Agreement"
              : "Invoice"}
          </Text>
          <Text style={s.hSub}>Generated {fmt(new Date())}</Text>
        </View>

        {/* Client meta */}
        <View style={s.metaRow}>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Client</Text>
            <Text style={s.metaValue}>{doc.name}{doc.company ? `, ${doc.company}` : ""}</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Service Type</Text>
            <Text style={s.metaValue}>{doc.service_type || "—"}</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Service Area</Text>
            <Text style={s.metaValue}>{doc.service_area || "—"}</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Doc Code</Text>
            <Text style={[s.metaValue, { fontFamily: "Courier-Bold", letterSpacing: 2 }]}>{doc.code}</Text>
          </View>
        </View>

        {/* Agreement */}
        {showAg && doc.agreement_text && (
          <View style={s.section}>
            <Text style={s.sLabel}>Service Agreement</Text>
            <Text style={s.bodyText}>{doc.agreement_text}</Text>
          </View>
        )}

        {/* Invoice */}
        {showInv && (
          <View style={s.section}>
            <Text style={s.sLabel}>Invoice</Text>
            {/* Table header */}
            <View style={s.tableHead}>
              <Text style={s.thDesc}>Description</Text>
              <Text style={s.thNum}>Qty</Text>
              <Text style={s.thNum}>Unit Price</Text>
              <Text style={s.thNum}>Total</Text>
            </View>
            {/* Line items */}
            {doc.items.map((item, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={s.tdDesc}>{item.desc}</Text>
                <Text style={s.tdNum}>{item.qty || "—"}</Text>
                <Text style={s.tdNum}>{money(item.price)}</Text>
                <Text style={s.tdNumBold}>{money(rowTotal(item))}</Text>
              </View>
            ))}
            {/* Total */}
            <View style={s.totalBox}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Subtotal</Text>
                <Text style={s.totalAmt}>{money(doc.invoice_total)}</Text>
              </View>
              <View style={s.totalDivider} />
              <View style={s.totalRow}>
                <Text style={s.grandLabel}>TOTAL DUE</Text>
                <Text style={s.grandAmt}>{money(doc.invoice_total)}</Text>
              </View>
            </View>
            {doc.pay_notes && (
              <Text style={[s.bodyText, { marginTop: 8, color: "#888" }]}>{doc.pay_notes}</Text>
            )}
          </View>
        )}

        {/* Signature */}
        {doc.signature && (
          <View style={s.sigSection}>
            <Text style={s.sigLabel}>Client Signature</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={doc.signature} style={s.sigImg} />
            <Text style={[s.footerText, { marginTop: 4 }]}>
              {doc.name}{doc.company ? `, ${doc.company}` : ""} — Signed {fmt(doc.signed_at)}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>HOS Automations Client Portal</Text>
          <Text style={s.footerText}>Doc #{doc.code} · {fmt(doc.created_at)}</Text>
        </View>

      </Page>
    </Document>
  );
}
