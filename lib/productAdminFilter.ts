import { Prisma } from '@prisma/client';

export type AdminProductFilterParams = {
  q?: string | null;
  brand?: string | null;
  active?: string | null;   // 'active' | 'inactive'
  sale?: string | null;     // 'sale' | 'nosale'
  carryover?: string | null; // 'yes' | 'no'
  season?: string | null;
  gender?: string | null;
  remark?: string | null;   // 'has' | 'none'
};

export function buildAdminProductWhere(p: AdminProductFilterParams): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [];

  if (p.q) {
    conditions.push({
      OR: [
        { name:          { contains: p.q, mode: 'insensitive' } },
        { brand:         { contains: p.q, mode: 'insensitive' } },
        { productNumber: { contains: p.q, mode: 'insensitive' } },
      ],
    });
  }

  if (p.brand)    conditions.push({ brand: { contains: p.brand, mode: 'insensitive' } });
  if (p.active === 'active')   conditions.push({ isActive: true });
  if (p.active === 'inactive') conditions.push({ isActive: false });
  if (p.sale === 'sale')       conditions.push({ isOnSale: true });
  if (p.sale === 'nosale')     conditions.push({ isOnSale: false });
  if (p.carryover === 'yes')   conditions.push({ isCarryOver: true });
  if (p.carryover === 'no')    conditions.push({ isCarryOver: false });
  if (p.season)   conditions.push({ season: { equals: p.season, mode: 'insensitive' } });
  if (p.gender)   conditions.push({ gender: { equals: p.gender, mode: 'insensitive' } });
  if (p.remark === 'has')  conditions.push({ remark: { not: null }, NOT: { remark: '' } });
  if (p.remark === 'none') conditions.push({ OR: [{ remark: null }, { remark: '' }] });

  return conditions.length > 0 ? { AND: conditions } : {};
}
