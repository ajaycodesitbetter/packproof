"use client";

import { useState } from "react";
import { Icon } from "./Icons";

export default function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="copybtn"
      aria-live="polite"
      title={failed ? "Clipboard unavailable. Select and copy the visible command." : undefined}
      onClick={async () => {
        // $SITE is a placeholder the server component cannot resolve: the
        // origin only exists in the browser, so substitute it at copy time.
        const finalText = text.replaceAll("$SITE", window.location.origin);
        setFailed(false);
        let copied = false;
        try {
          await navigator.clipboard.writeText(finalText);
          copied = true;
        } catch {
          const ta = document.createElement("textarea");
          ta.value = finalText;
          document.body.appendChild(ta);
          try {
            ta.select();
            copied = document.execCommand("copy");
          } catch {
            copied = false;
          } finally {
            document.body.removeChild(ta);
          }
        }
        if (!copied) { setFailed(true); return; }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      <Icon name="copy" />
      {failed ? "select command to copy" : done ? "copied" : label}
    </button>
  );
}
