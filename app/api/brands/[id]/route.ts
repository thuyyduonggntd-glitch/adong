import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, image, notice, sizeInfo, sizeImages, modelInfo, modelImages } = await req.json();
  const data: any = {};
  if (name       !== undefined) data.name        = name.trim();
  if (image      !== undefined) data.image       = image || null;
  if (notice     !== undefined) data.notice      = notice?.trim() || null;
  if (sizeInfo   !== undefined) data.sizeInfo    = sizeInfo?.trim() || null;
  if (sizeImages !== undefined) data.sizeImages  = Array.isArray(sizeImages) ? sizeImages : [];
  if (modelInfo  !== undefined) data.modelInfo   = modelInfo?.trim() || null;
  if (modelImages !== undefined) data.modelImages = Array.isArray(modelImages) ? modelImages : [];

  try {
    const brand = await prisma.brand.update({ where: { id: params.id }, data });
    return NextResponse.json(brand);
  } catch {
    return NextResponse.json({ error: '수정 실패' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.brand.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
