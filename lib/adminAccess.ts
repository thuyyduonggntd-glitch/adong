// 부어드민(SUB_ADMIN)이 접근 가능한 관리자 영역: 상품/주문/주문취소/공지알림/배송/문의
export const SUB_ADMIN_ALLOWED_PATHS = [
  '/admin/orders',
  '/admin/cancelled',
  '/admin/products',
  '/admin/notices',
  '/admin/shipping',
  '/admin/qna',
];

export function isStaffRole(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}

// 위 6개 영역 API에서 사용: ADMIN과 SUB_ADMIN 모두 허용
export function hasAdminAccess(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}

export function canAccessAdminPath(role: string | undefined | null, pathname: string): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'SUB_ADMIN') return SUB_ADMIN_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
  return false;
}
