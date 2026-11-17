import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// Identity-only GitHub OAuth: default scopes (read:user user:email), no repo
// or write access requested. JWT sessions, no database adapter needed.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  // Custom sign-in page: explains the identity-only scope before the OAuth
  // jump instead of sending people straight to github.com.
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
