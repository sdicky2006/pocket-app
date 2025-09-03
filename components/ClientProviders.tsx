"use client";

import React, { useEffect, useState } from "react";
import { ToastProvider } from "@/lib/useToasts";
import { useSessionHeartbeat } from "@/lib/useSessionHeartbeat";
import LiveWSStream from "@/components/LiveWSStream";

function HeartbeatMount() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(true);
  }, []);
  useSessionHeartbeat(enabled);
  return null;
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <LiveWSStream />
      <HeartbeatMount />
      {children}
    </ToastProvider>
  );
}


