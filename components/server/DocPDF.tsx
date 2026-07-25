// Server-only PDF template — rendered by /api/pdf via @react-pdf/renderer.
// Must NOT have 'use client'. Do not import this in any Client Component.
import {
  Document, Page, Text, View, Image, StyleSheet,
} from "@react-pdf/renderer";
import { money, rowTotal, fmt } from "@/lib/utils";
import type { Doc } from "@/types";

const BRONZE = "#8B6B3E";
const BONE   = "#F3F1EC";
const DARK   = "#111111";
const MID    = "#2A2A2A";
const GREY   = "#727272";
const LIGHT  = "#555555";

const s = StyleSheet.create({
  page:        { backgroundColor: "#ffffff", padding: 0, fontFamily: "Helvetica" },

  // ── Agreement page ──────────────────────────────────────────────────────────
  agHeader:    { backgroundColor: DARK, padding: "24 44 20 44" },
  agBrand:     { fontSize: 8, color: GREY, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 },
  agTitle:     { fontSize: 22, color: BONE, fontFamily: "Helvetica-Oblique", marginBottom: 2 },
  agSub:       { fontSize: 8, color: GREY, letterSpacing: 1 },

  metaStrip:   { backgroundColor: "#0D0C0B", flexDirection: "row", padding: "12 44" },
  metaCol:     { flex: 1 },
  metaLabel:   { fontSize: 7, color: GREY, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 },
  metaValue:   { fontSize: 9, color: BONE },
  metaCode:    { fontSize: 9, color: BONE, fontFamily: "Courier-Bold", letterSpacing: 2 },

  body:        { padding: "28 44 80 44" },
  sLabel:      { fontSize: 7.5, color: MID, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "Helvetica-Bold" },
  bodyText:    { fontSize: 10, lineHeight: 1.8, color: "#333333" },

  sigSection:  { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: "#e5e5e5" },
  sigLabel:    { fontSize: 7.5, color: GREY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  sigImg:      { width: 200, height: 48, objectFit: "contain", backgroundColor: "#f5f5f5", borderRadius: 4 },
  sigName:     { fontSize: 8, color: GREY, marginTop: 4 },

  footer:      { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderColor: "#dddddd", paddingTop: 8 },
  footerText:  { fontSize: 7.5, color: "#bbbbbb" },

  // ── Invoice page ────────────────────────────────────────────────────────────
  invPage:     { backgroundColor: "#ffffff", padding: 0, fontFamily: "Helvetica" },

  invAccent:   { backgroundColor: BRONZE, width: 4, position: "absolute", top: 0, bottom: 0, left: 0 },
  invHeader:   { backgroundColor: DARK, padding: "24 44 20 48" },
  invLabel:    { fontSize: 8, color: BRONZE, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "Helvetica-Bold" },
  invTitle:    { fontSize: 20, color: BONE, fontFamily: "Helvetica-Oblique" },
  invSub:      { fontSize: 9, color: GREY, marginTop: 2 },
  invDates:    { fontSize: 8, color: GREY, marginTop: 8 },

  invBody:     { padding: "28 44 80 44" },

  tableHead:   { flexDirection: "row", borderBottomWidth: 0.75, borderColor: MID, paddingBottom: 7, marginBottom: 2 },
  tableRow:    { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#eeeeee", paddingVertical: 9 },
  thDesc:      { flex: 3, fontSize: 7.5, color: GREY, letterSpacing: 1, textTransform: "uppercase" },
  thNum:       { flex: 1, fontSize: 7.5, color: GREY, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" },
  tdDesc:      { flex: 3, fontSize: 10, color: "#222222" },
  tdNum:       { flex: 1, fontSize: 10, color: LIGHT, textAlign: "right", fontFamily: "Courier" },
  tdNumBold:   { flex: 1, fontSize: 10, color: DARK, textAlign: "right", fontFamily: "Courier-Bold" },

  totalWrap:   { alignSelf: "flex-end", marginTop: 12 },
  totalBox:    { backgroundColor: DARK, borderRadius: 6, padding: "14 20", minWidth: 200 },
  totalRow:    { flexDirection: "row", justifyContent: "space-between", gap: 40, marginBottom: 5 },
  totalLabel:  { fontSize: 8, color: GREY },
  totalAmt:    { fontSize: 9, color: "#aaaaaa", fontFamily: "Courier" },
  totalDivider:{ borderBottomWidth: 0.75, borderColor: "#2A2A2A", marginVertical: 6 },
  grandLabel:  { fontSize: 9, color: BONE, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  grandAmt:    { fontSize: 16, color: BONE, fontFamily: "Courier-Bold" },

  payNotes:    { fontSize: 9, color: GREY, marginTop: 14, lineHeight: 1.6 },
});

function PageFooter({ code, date }: { code: string; date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>House Of Sales Client Portal</Text>
      <Text style={s.footerText}>Doc #{code} · {date}</Text>
    </View>
  );
}

export function DocPDF({ doc }: { doc: Doc }) {
  const showAg  = doc.type === "agreement" || doc.type === "both";
  const showInv = doc.type === "invoice"   || doc.type === "both";
  const dateStr = fmt(new Date());

  return (
    <Document title={`HOS — ${doc.name} — ${doc.code}`}>

      {/* ── Page 1: Agreement (or invoice-only) ─────────────────────────────── */}
      {showAg && (
        <Page size="A4" style={s.page}>

          {/* Dark header */}
          <View style={s.agHeader}>
            <Text style={s.agBrand}>House Of Sales</Text>
            <Text style={s.agTitle}>Service Agreement</Text>
            <Text style={s.agSub}>Generated {dateStr}</Text>
          </View>

          {/* Client meta strip */}
          <View style={s.metaStrip}>
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
              <Text style={s.metaCode}>{doc.code}</Text>
            </View>
          </View>

          {/* Agreement body */}
          <View style={s.body}>
            {doc.agreement_text && (
              <View style={{ marginBottom: 24 }}>
                <Text style={s.sLabel}>Service Agreement</Text>
                <Text style={s.bodyText}>{doc.agreement_text}</Text>
              </View>
            )}

            {/* Signature — only on agreement page */}
            {doc.signature && (
              <View style={s.sigSection}>
                <Text style={s.sigLabel}>Client Signature</Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={doc.signature} style={s.sigImg} />
                <Text style={s.sigName}>
                  {doc.name}{doc.company ? `, ${doc.company}` : ""} — Signed {fmt(doc.signed_at)}
                </Text>
              </View>
            )}
          </View>

          <PageFooter code={doc.code} date={dateStr} />
        </Page>
      )}

      {/* ── Invoice page (always own page when agreement also exists) ────────── */}
      {showInv && (
        <Page size="A4" style={s.invPage}>

          {/* Bronze left accent strip */}
          <View style={s.invAccent} />

          {/* Dark invoice header */}
          <View style={s.invHeader}>
            <Text style={s.invLabel}>Invoice</Text>
            <Text style={s.invTitle}>House Of Sales</Text>
            <Text style={s.invSub}>Lead Generation Services</Text>
            <Text style={s.invDates}>
              Issued {dateStr}{doc.due_date ? `  ·  Due ${fmt(doc.due_date)}` : ""}
            </Text>
          </View>

          <View style={s.invBody}>
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

            {/* Total box */}
            <View style={s.totalWrap}>
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
            </View>

            {doc.pay_notes && (
              <Text style={s.payNotes}>{doc.pay_notes}</Text>
            )}

            {/* Signature on invoice-only docs */}
            {!showAg && doc.signature && (
              <View style={s.sigSection}>
                <Text style={s.sigLabel}>Client Signature</Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={doc.signature} style={s.sigImg} />
                <Text style={s.sigName}>
                  {doc.name}{doc.company ? `, ${doc.company}` : ""} — Signed {fmt(doc.signed_at)}
                </Text>
              </View>
            )}
          </View>

          <PageFooter code={doc.code} date={dateStr} />
        </Page>
      )}

    </Document>
  );
}
