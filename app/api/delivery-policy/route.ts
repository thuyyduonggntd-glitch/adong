import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const policy = await prisma.deliveryPolicy.findFirst();
  return NextResponse.json(policy ?? { fromTime: null, toTime: null, enabled: false });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fromTime, toTime, enabled } = await req.json();

  const existing = await prisma.deliveryPolicy.findFirst();
  if (existing) {
    const policy = await prisma.deliveryPolicy.update({
      where:  { id: existing.id },
      data:   { fromTime: fromTime ?? null, toTime: toTime ?? null, enabled: enabled ?? false },
    });
    return NextResponse.json(policy);
  }

  const policy = await prisma.deliveryPolicy.create({
    data: { fromTime: fromTime ?? null, toTime: toTime ?? null, enabled: enabled ?? false },
  });
  return NextResponse.json(policy);
}
