import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAccess';
import bcrypt from 'bcryptjs';

function requireAdmin(session: any) {
  if (!session || !isAdmin(session?.user?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = requireAdmin(session);
  if (err) return err;

  const accounts = await prisma.user.findMany({
    where: { role: 'SUB_ADMIN' },
    select: { id: true, name: true, email: true, isActive: true, adminZones: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireAdmin(session);
  if (err) return err;

  const { name, email, password, adminZones } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: '이름, 이메일, 비밀번호를 입력해 주세요.' }, { status: 400 });
  if (!Array.isArray(adminZones) || adminZones.length === 0)
    return NextResponse.json({ error: '담당 구역을 하나 이상 선택해 주세요.' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: 'SUB_ADMIN', isActive: true, adminZones },
    select: { id: true, name: true, email: true, isActive: true, adminZones: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireAdmin(session);
  if (err) return err;

  const { id, adminZones, isActive } = await req.json();
  if (!id) return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (Array.isArray(adminZones)) data.adminZones = adminZones;
  if (typeof isActive === 'boolean') data.isActive = isActive;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, isActive: true, adminZones: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireAdmin(session);
  if (err) return err;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
