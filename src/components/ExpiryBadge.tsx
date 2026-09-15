"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { formatTimeRemaining } from "@/lib/utils";

interface ExpiryBadgeProps {
  expiresAt: string;
  onExpired?: () => void;
  className?: string;
}

export default function ExpiryBadge({
  expiresAt,
  onExpired,
  className = "",
}: ExpiryBadgeProps) {
  const [remaining, setRemaining] = useState(() =>
    formatTimeRemaining(expiresAt)
  );

  useEffect(() => {
    const update = () => {
      const status = formatTimeRemaining(expiresAt);
      setRemaining(status);
      if (status.isExpired && onExpired) {
        onExpired();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (remaining.isExpired) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/70 border border-rose-600/40 text-rose-300 shadow-sm ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        <span>Expired & Purged</span>
      </div>
    );
  }

  const isCritical = remaining.totalSeconds <= 60;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide shadow-sm transition-colors ${
        isCritical
          ? "bg-amber-950/70 border border-amber-500/50 text-amber-300 animate-pulse"
          : "bg-indigo-950/50 border border-indigo-500/30 text-indigo-300"
      } ${className}`}
    >
      <Clock className={`w-3.5 h-3.5 ${isCritical ? "text-amber-400" : "text-indigo-400"}`} />
      <span>
        Auto-destroys in <strong className="font-mono font-bold">{remaining.formatted}</strong>
      </span>
    </div>
  );
}
