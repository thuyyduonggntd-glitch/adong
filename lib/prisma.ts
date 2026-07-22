import { PrismaClient } from '@prisma/client';

// 서버리스 환경(Netlify Functions/Vercel 등)에서도 warm 컨테이너 간 커넥션을 재사용하도록
// 프로덕션 여부와 무관하게 항상 전역에 캐싱한다.
// 커넥션 풀 크기는 코드가 아니라 DATABASE_URL의 ?connection_limit=1 쿼리 파라미터로 제어—
// 서버리스 인스턴스마다 커넥션 1개만 열어 DB 커넥션 고갈을 막는다.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// DEBUG_PRISMA_QUERIES=true로 설정하면 쿼리별 실제 소요시간(ms)을 로그로 남긴다.
// 실서비스에서 항상 켜두면 로그가 시끄러워지므로 응답속도 진단할 때만 켜서 쓴다.
const logQueries = process.env.DEBUG_PRISMA_QUERIES === 'true';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logQueries
      ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }]
      : process.env.NODE_ENV === 'development' ? ['error'] : [],
  });

if (logQueries) {
  (prisma as any).$on('query', (e: { query: string; duration: number }) => {
    console.log(`[prisma] ${e.duration}ms  ${e.query}`);
  });
}

globalForPrisma.prisma = prisma;
