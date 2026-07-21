"use client";
import { useEffect } from "react";
import { CommsWorkspace } from "@/components/comms/CommsWorkspace";
import { BG, BORDER, TEXT, MUTED } from "@/lib/styles";

interface Props {
  code: string;
  clientName: string;
  onClose: () => void;
}

export function CommsCallOverlay({ code, clientName, onClose }: Props) {
  // Notify CommsFAB about call state
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("comms-call-state", { detail: { active: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("comms-call-state", { detail: { active: false } }));
    };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 1000, height: "90vh",
        background: BG, border: `1px solid ${BORDER}`, borderRadius: 16,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 2 }}>
              HOS · Direct Line
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
              {clientName}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close call overlay"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(243,241,236,0.06)", border: `1px solid ${BORDER}`,
              color: MUTED, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 300,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Discord-style workspace */}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <CommsWorkspace
            code={code}
            me="client"
            myName={clientName}
            peerName="HOS Team"
            autoJoin
            onLeave={onClose}
          />
        </div>
      </div>
    </div>
  );
}
