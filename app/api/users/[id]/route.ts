import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = (session.user as any)?.role === 'ADMIN';
  const isSelf  = (session.user as any)?.id === params.id;
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const data = await req.json();

  const allowedScalarFields = isAdmin
    ? ['name', 'phone', 'address', 'shippingName', 'shippingPhone', 'depositAmount', 'email', 'shopName', 'businessNumber', 'shopSiteUrl', 'country', 'isActive', 'dealerGrade', 'role']
    : ['name', 'phone', 'address', 'shippingName', 'shippingPhone'];

  const updateData: Record<string, any> = Object.fromEntries(
    Object.entries(data).filter(([k]) => allowedScalarFields.includes(k))
  );

  if (updateData.role && !['USER', 'ADMIN', 'SUB_ADMIN'].includes(updateData.role)) {
    delete updateData.role;
  }

  /* 비밀번호 변경 — 어드민 또는 본인만 */
  if (data.password && typeof data.password === 'string' && data.password.length >= 4) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  const user = await prisma.user.update({ where: { id: params.id }, data: updateData });
  return NextResponse.json(user);
}
