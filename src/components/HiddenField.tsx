"use client";

import { useState, ReactNode, useRef } from "react";
import { useAnalytics } from "./PageViewAnalytics";

interface HiddenFieldProps {
  eventName: string;
  actualValue: ReactNode;
  placeholder: ReactNode;
}

export function HiddenField({ eventName, actualValue, placeholder }: HiddenFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const analytics = useAnalytics();

  const handleReveal = async () => {
    setIsRevealed(true);

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    await analytics.trackEvent(eventName, {
      signal: abortController.signal,
    });
  };

  return (
    <div className="relative">
      {/* Actual value - always rendered but invisible when not revealed */}
      <div className={isRevealed ? "visible" : "invisible"}>
        {actualValue}
      </div>

      {/* Placeholder button - positioned absolutely on top when not revealed */}
      {!isRevealed && (
        <button
          onClick={handleReveal}
          className="absolute inset-0 text-gray-700 hover:text-gray-900 flex items-center gap-1 underline whitespace-nowrap"
        >
          {placeholder}
        </button>
      )}
    </div>
  );
}
