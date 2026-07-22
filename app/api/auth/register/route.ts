import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email, password, name, phone, country, shopName, businessNumber, shopSiteUrl } = await req.json();
  if (!email || !password || !name || !shopName) return NextResponse.json({ error: '필수 정보를 입력해주세요.', code: 'MISSING_FIELDS' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.', code: 'PASSWORD_TOO_SHORT' }, { status: 400 });
  if (!businessNumber && !shopSiteUrl) {
    return NextResponse.json({ error: '사업자번호 또는 샵사이트링크 중 하나는 반드시 입력해주세요.', code: 'BIZ_OR_SITE_REQUIRED' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: '이미 사용 중인 이메일입니다.', code: 'EMAIL_TAKEN' }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email, password: hashed, name, phone: phone || null, country: country || null,
      shopName, businessNumber: businessNumber || null, shopSiteUrl: shopSiteUrl || null,
      isActive: false,
    },
  });
  return NextResponse.json({ ok: true });
}
