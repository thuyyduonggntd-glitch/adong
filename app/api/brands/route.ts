import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 회원 화면에 노출 가능한 필드만 — mallLocation(도매처 위치)은 어드민 전용 메모라 절대 포함하지 않는다.
const MEMBER_SAFE_SELECT = {
  id: true, name: true, image: true, notice: true,
  sizeInfo: true, sizeImages: true, modelInfo: true, modelImages: true,
  createdAt: true, updatedAt: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const brands = isAdmin
    ? await prisma.brand.findMany({ orderBy: { name: 'asc' } })
    : await prisma.brand.findMany({ orderBy: { name: 'asc' }, select: MEMBER_SAFE_SELECT });
  return NextResponse.json(brands);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, image, notice, sizeInfo, sizeImages, modelInfo, modelImages, mallLocation } = await req.json();
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
        mallLocation: mallLocation?.trim() || null,
      },
    });
    return NextResponse.json(brand);
  } catch {
    return NextResponse.json({ error: '이미 존재하는 브랜드명입니다.' }, { status: 409 });
  }
}
