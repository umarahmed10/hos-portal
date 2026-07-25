"use client";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { usePushSubscription } from "@/lib/comms/usePushSubscription";
import { IncomingCallModal } from "@/components/comms/IncomingCallModal";

// Lazy-loaded: this pulls in livekit-client (~541 KB decoded / ~140 KB gzipped),
// which was 48% of the JS on EVERY portal page — including the login screen —
// even though the overlay only mounts once a call is actually accepted.
// The polling that detects an incoming call is lightweight and stays eager.
const CommsCallOverlay = dynamic(
  () => import("@/components/comms/CommsCallOverlay").then(m => m.CommsCallOverlay),
  { ssr: false },
);

interface Props {
  code: string;
  clientName: string;
}

export function IncomingCallListener({ code, clientName }: Props) {
  const [incoming, setIncoming] = useState<{ caller: string; expiresAt: number } | null>(null);
  const [accepted, setAccepted] = useState(false);

  const onIncoming = useCallback((call: { caller: string; expiresAt: number }) => {
    if (accepted) return;
    setIncoming(call);
  }, [accepted]);

  const onJoinCall = useCallback(() => {
    setAccepted(true);
    setIncoming(null);
  }, []);

  usePushSubscription({
    code,
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    ready: true,
    onIncoming,
    onJoinCall,
  });

  const handleAccept = () => {
    setAccepted(true);
    setIncoming(null);
  };

  const handleDecline = () => {
    setIncoming(null);
  };

  const handleClose = () => {
    setAccepted(false);
  };

  return (
    <>
      {incoming && !accepted && (
        <IncomingCallModal
          callerName={incoming.caller}
          expiresAt={incoming.expiresAt}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}
      {accepted && (
        <CommsCallOverlay
          code={code}
          clientName={clientName}
          onClose={handleClose}
        />
      )}
    </>
  );
}
