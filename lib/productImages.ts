export type ColorImage = { color: string; imageUrl: string };

/** 색상 대표이미지가 있으면 그것을, 없으면 상품이미지 1번, 그마저 없으면 fallback을 반환한다. */
export function resolveColorImage(
  color: string | null | undefined,
  colorImages: ColorImage[] | null | undefined,
  images: string[] | null | undefined,
  fallback: string
): string {
  const hit = color ? colorImages?.find((ci) => ci.color === color)?.imageUrl : undefined;
  return hit || images?.[0] || fallback;
}
