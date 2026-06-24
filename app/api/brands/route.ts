import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(brands);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, image, notice, sizeInfo, sizeImages, modelInfo, modelImages } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: '브랜드명 필요' }, { status: 400 });

  try {
    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        image: image || null,
        notice: notice?.trim() || null,
        sizeInfo: sizeInfo?.trim() || null,
        sizeImages: Array.isArray(sizeImages) ? sizeImages : [],
        modelInfo: modelInfo?.trim() || null,
        modelImages: Array.isArray(modelImages) ? modelImages : [],
      },
    });
    return NextResponse.json(brand);
  } catch {
    return NextResponse.json({ error: '이미 존재하는 브랜드명입니다.' }, { status: 409 });
  }
}
