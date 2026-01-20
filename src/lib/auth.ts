import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function getAllowedEmails(): string[] {
  const envEmails = process.env.ADMIN_ALLOWED_EMAILS || "";
  return envEmails.split(";").map((e) => e.trim()).filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowed = getAllowedEmails();
      if (allowed.length === 0) return true; // No restriction if not configured
      return allowed.includes(user.email || "");
    },
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
};
