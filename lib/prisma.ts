import { PrismaClient } from '@prisma/client';

// 서버리스 환경(Netlify Functions 등)에서도 warm 컨테이너 간 커넥션을 재사용하도록
// 프로덕션 여부와 무관하게 항상 전역에 캐싱한다.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] });

globalForPrisma.prisma = prisma;
