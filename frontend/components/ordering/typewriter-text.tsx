"use client";

/* eslint-disable react-hooks/set-state-in-effect -- animate refreshed admin-configured copy after mount. */
import { useEffect, useState } from "react";

export function TypewriterText({
  text,
  className,
  speed = 18,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const [visible, setVisible] = useState(text);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !text) {
      setVisible(text);
      return;
    }
    setVisible("");
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + 1);
      setVisible(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [speed, text]);

  return <span className={className}>{visible}</span>;
}
