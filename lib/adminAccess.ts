export type AdminZone = 'goods' | 'orders' | 'notice-faq';

export const ZONE_PATHS: Record<AdminZone, string[]> = {
  goods:       ['/admin/products', '/admin/brands'],
  orders:      ['/admin/orders', '/admin/cancelled', '/admin/shipping', '/admin/qna'],
  'notice-faq': ['/admin/notices', '/admin/faqs'],
};

// Pages only ADMIN can access (no zone grants access)
export const ADMIN_ONLY_PATHS = [
  '/admin/dashboard',
  '/admin/transactions',
  '/admin/users',
  '/admin/accounts',
];

export function isAdmin(role?: string | null): boolean {
  return role === 'ADMIN';
}

export function isStaffRole(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}

// Any staff member (used for generic guards)
export function hasAdminAccess(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}

export function hasZoneAccess(
  role: string | undefined | null,
  zone: AdminZone,
  adminZones?: string[] | null
): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'SUB_ADMIN') return (adminZones ?? []).includes(zone);
  return false;
}

export function hasGoodsAccess(role?: string | null, adminZones?: string[] | null): boolean {
  return hasZoneAccess(role, 'goods', adminZones);
}

export function hasOrdersAccess(role?: string | null, adminZones?: string[] | null): boolean {
  return hasZoneAccess(role, 'orders', adminZones);
}

export function hasNoticeFaqAccess(role?: string | null, adminZones?: string[] | null): boolean {
  return hasZoneAccess(role, 'notice-faq', adminZones);
}

export function canAccessAdminPath(
  role: string | undefined | null,
  pathname: string,
  adminZones?: string[] | null
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'SUB_ADMIN') return false;

  for (const [zone, paths] of Object.entries(ZONE_PATHS) as [AdminZone, string[]][]) {
    if (paths.some((p) => pathname.startsWith(p))) {
      return (adminZones ?? []).includes(zone);
    }
  }

  // Admin-only or unknown path: deny
  return false;
}

// First page a SUB_ADMIN should land on given their zones
export function defaultAdminPath(adminZones?: string[] | null): string {
  const zones = adminZones ?? [];
  if (zones.includes('orders'))      return '/admin/orders';
  if (zones.includes('goods'))       return '/admin/products';
  if (zones.includes('notice-faq'))  return '/admin/notices';
  return '/admin/orders'; // fallback
}
