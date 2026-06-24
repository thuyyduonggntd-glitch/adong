import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const shipping = await prisma.shipping.update({
    where: { id: params.id },
    data: {
      trackingNumber: data.trackingNumber ?? undefined,
      carrier: data.carrier ?? undefined,
      note: data.note ?? undefined,
      shippedAt: data.shippedAt ? new Date(data.shippedAt) : undefined,
    },
  });
  return NextResponse.json(shipping);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.shipping.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
