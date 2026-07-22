/** 저장된 phone 문자열("+82 10-1234-5678")을 국가코드와 번호로 분리 */
export function splitPhone(value: string): { code: string; number: string } {
  if (!value || !value.startsWith('+')) return { code: '', number: value || '' };
  const idx = value.indexOf(' ');
  if (idx === -1) return { code: value, number: '' };
  return { code: value.slice(0, idx), number: value.slice(idx + 1) };
}

/** 국가코드+번호를 저장용 phone 문자열로 합침 */
export function joinPhone(code: string, number: string): string {
  if (!code) return number;
  return number ? `${code} ${number}` : code;
}
