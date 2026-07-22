import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/adminAccess';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !hasAdminAccess((session.user as any)?.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { codes } = await req.json();
  if (!Array.isArray(codes) || codes.length === 0)
    return NextResponse.json({ existing: [] });

  const existing = await prisma.product.findMany({
    where: { productNumber: { in: codes.filter(Boolean) } },
    select: { id: true, productNumber: true, name: true },
  });

  return NextResponse.json({ existing });
}
