import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function GET() {
  const policy = await prisma.cancelPolicy.findFirst();
  return NextResponse.json(policy ?? { globalEnabled: false, timeLimit: null, cancelFrom: null, cancelTo: null });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { globalEnabled, timeLimit, cancelFrom, cancelTo } = await req.json();
  const existing = await prisma.cancelPolicy.findFirst();

  const data = {
    globalEnabled,
    timeLimit: timeLimit ?? null,
    cancelFrom: cancelFrom || null,
    cancelTo: cancelTo || null,
  };

  const policy = existing
    ? await prisma.cancelPolicy.update({ where: { id: existing.id }, data })
    : await prisma.cancelPolicy.create({ data });

  return NextResponse.json(policy);
}
