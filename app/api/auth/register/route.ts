import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, password, name, phone } = await req.json();
  if (!email || !password || !name) return NextResponse.json({ error: '필수 정보를 입력해주세요.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, password: hashed, name, phone: phone || null } });
  return NextResponse.json({ ok: true });
}
