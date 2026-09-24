"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GoogleConnect({
  connected,
  connectedEmail,
  returnTo,
}: {
  connected: boolean;
  connectedEmail: string | null;
  returnTo: string;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/google/disconnect", { method: "POST" });
    setDisconnecting(false);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Google: {connectedEmail ?? "connected"}</span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="underline hover:text-slate-700 disabled:opacity-40"
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <a
      href={`/api/google/oauth/start?returnTo=${encodeURIComponent(returnTo)}`}
      className="text-xs text-blue-600 underline hover:text-blue-800"
    >
      Connect Google Account
    </a>
  );
}
