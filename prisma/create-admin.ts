import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@kkumbb.com';
  const password = 'admin1234';
  const hashed = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', isActive: true },
    create: {
      email,
      password: hashed,
      name: '관리자',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('관리자 계정 생성 완료:', admin.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
