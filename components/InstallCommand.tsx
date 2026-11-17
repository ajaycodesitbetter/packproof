"use client";

import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";

// Show the exact command the copy button puts on the clipboard. The origin
// only exists in the browser ($SITE placeholder), so the visible command
// starts with the placeholder and resolves on mount - the same substitution
// CopyButton applies at copy time.
export default function InstallCommand({ text }: { text: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    setShown(text.replaceAll("$SITE", window.location.origin));
  }, [text]);
  return (
    <div className="install-cmd">
      <code>{shown}</code>
      <CopyButton text={text} label="copy" />
    </div>
  );
}
