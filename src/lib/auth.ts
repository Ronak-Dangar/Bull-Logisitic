import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,   // 👈 ADD THIS LINE
  providers: [
    Credentials({
      name: "Phone & Password",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;

        const phone = credentials.phone as string;
        const password = credentials.password as string;

        try {
          const user = await prisma.user.findUnique({
            where: { phone },
          });

          if (!user) return null;

          // Dynamic import to handle ESM/CJS issues
          const bcrypt = await import("bcryptjs");
          const isValid = await bcrypt.compare(password, user.passwordHash);

          if (!isValid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.phone, // NextAuth requires email field; using phone as email
            image: null,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // Map immediately
        // Fetch fresh user data to get role
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id! },
          select: { role: true, phone: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.phone = dbUser.phone;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).phone = token.phone as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
