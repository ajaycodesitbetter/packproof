"use client";

import { useState } from "react";
import { Icon } from "./Icons";

export default function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copybtn"
      onClick={async () => {
        // $SITE is a placeholder the server component cannot resolve: the
        // origin only exists in the browser, so substitute it at copy time.
        const finalText = text.replaceAll("$SITE", window.location.origin);
        try {
          await navigator.clipboard.writeText(finalText);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = finalText;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      <Icon name="copy" />
      {done ? "copied" : label}
    </button>
  );
}
