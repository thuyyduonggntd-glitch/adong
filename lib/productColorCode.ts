/** 색상별 표시코드 조합: "{productNumber}_{순번 3자리}" (예: DIGRN61CVX_001). 순번이나 제품번호가 없으면 null. */
export function formatColorCode(productNumber: string | null | undefined, sequence: number | null | undefined): string | null {
  if (!productNumber || !sequence) return null;
  return `${productNumber}_${String(sequence).padStart(3, '0')}`;
}

/** colorCodes 배열에서 특정 색상의 순번을 찾아 표시코드를 만든다. */
export function colorCodeFor(
  productNumber: string | null | undefined,
  colorCodes: { color: string; sequence: number }[] | undefined,
  color: string | null | undefined
): string | null {
  if (!color || !colorCodes) return null;
  const match = colorCodes.find((c) => c.color === color);
  return match ? formatColorCode(productNumber, match.sequence) : null;
}
