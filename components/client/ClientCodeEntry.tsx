"use client";
import { useState }               from "react";
import { useRouter }              from "next/navigation";
import { toast }                  from "sonner";
import { supabase }               from "@/lib/supabase-browser";
import { cleanCode }              from "@/lib/utils";
import { BODY, FONT, MONO, MUTED, TEXT, css } from "@/lib/styles";

export function ClientCodeEntry() {
  const router   = useRouter();
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccess() {
    const clean = cleanCode(code);
    if (clean.length < 6) return;

    setLoading(true);

    const { data } = await supabase
      .from("docs")
      .select("code, status")
      .eq("code", clean)
      .single();

    setLoading(false);

    if (!data) {
      toast.error("Code not found. Double-check and try again.");
      return;
    }

    router.push(`/client/${clean}`);
  }

  return (
    <div style={{ maxWidth: 400, width: "100%", padding: "0 24px" }}>
      <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 10 }}>
        CLIENT ACCESS
      </div>
      <h2 style={{ fontFamily: FONT, fontSize: 48, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1, color: TEXT, marginBottom: 12 }}>
        ENTER YOUR<br />CODE
      </h2>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Your HOS rep shared a 6-character access code with you.
      </p>

      <input
        value={code}
        onChange={(e) => setCode(cleanCode(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && handleAccess()}
        maxLength={6}
        placeholder="A1B2C3"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        style={{
          ...css.inp,
          fontSize:      32,
          fontWeight:    700,
          letterSpacing: "10px",
          textAlign:     "center",
          padding:       "20px 14px",
          marginBottom:  16,
          fontFamily:    MONO,
        }}
      />

      <button
        onClick={handleAccess}
        disabled={code.length < 6 || loading}
        style={{
          ...css.btnP,
          width:   "100%",
          opacity: code.length < 6 || loading ? 0.35 : 1,
          cursor:  code.length < 6 || loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "CHECKING…" : "ACCESS MY DOCUMENTS →"}
      </button>

      <p style={{ fontSize: 12, color: "#333", marginTop: 20, textAlign: "center" }}>
        Forgot your code? Contact your HOS rep.
      </p>
    </div>
  );
}
