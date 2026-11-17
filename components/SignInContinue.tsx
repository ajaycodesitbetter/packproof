"use client";

import { signIn } from "next-auth/react";

// The OAuth jump lives behind this button so the /signin page can explain
// what PackProof requests (identity only) before sending anyone to GitHub.
export default function SignInContinue({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button className="btn b1" onClick={() => signIn("github", { callbackUrl })}>
      Continue with GitHub
    </button>
  );
}
