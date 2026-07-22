import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;
        if (!user.isActive) throw new Error('ACCOUNT_INACTIVE');

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          dealerGrade: user.dealerGrade,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.dealerGrade = (user as any).dealerGrade;
        token.lastChecked = Date.now();
      } else if (token.id) {
        // 어드민이 등급/활성상태 변경 시 반영되도록 DB를 재조회하되, 페이지 하나에서 세션 체크가
        // 여러 번(레이아웃 + 여러 API 병렬 호출) 일어나므로 짧은 시간 내 재조회는 건너뛴다.
        const lastChecked = (token.lastChecked as number | undefined) ?? 0;
        if (Date.now() - lastChecked < 30_000) {
          return token;
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, dealerGrade: true, isActive: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.dealerGrade = dbUser.dealerGrade;
          if (!dbUser.isActive) token.isInactive = true;
          token.lastChecked = Date.now();
        } else {
          // 유저가 DB에서 삭제됐거나 DB가 초기화된 경우 — 토큰 무효화
          token.id = undefined;
          token.role = undefined;
          token.dealerGrade = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).dealerGrade = token.dealerGrade;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
