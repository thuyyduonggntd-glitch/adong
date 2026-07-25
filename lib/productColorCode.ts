/** 색상별 표시코드 조합: "{productNumber}_{색상코드}" (예: DIGRN61CVX_001). 색상코드나 제품번호가 없으면 null. */
export function formatColorCode(productNumber: string | null | undefined, code: string | null | undefined): string | null {
  if (!productNumber || !code) return null;
  return `${productNumber}_${code}`;
}

/** colorCodes 배열에서 특정 색상의 코드를 찾아 표시코드를 만든다. */
export function colorCodeFor(
  productNumber: string | null | undefined,
  colorCodes: { color: string; code: string }[] | undefined,
  color: string | null | undefined
): string | null {
  if (!color || !colorCodes) return null;
  const match = colorCodes.find((c) => c.color === color);
  return match ? formatColorCode(productNumber, match.code) : null;
}
