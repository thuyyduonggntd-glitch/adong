// 영수증 대조 / 일별입고 인쇄용 HTML 생성기

export type PrintableItem = {
  itemId: string;
  productId: string;
  brand: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  images: string[];
  colorImages: { color: string; imageUrl: string }[];
  userName: string;
  orderDate: string;
};

function escHtml(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function thumbUrl(it: PrintableItem): string {
  const ci = it.colorImages.find((c) => c.color === it.color);
  return ci?.imageUrl ?? it.images[0] ?? '';
}

function fmtDate(s: string): string {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function itemRow(it: PrintableItem, showBrand = false): string {
  const img = thumbUrl(it);
  const imgTag = img
    ? `<img src="${escHtml(img)}" width="40" height="40" style="object-fit:cover;border-radius:3px;display:block;margin:auto">`
    : `<span style="color:#bbb;font-size:8pt">—</span>`;
  const brandTag = showBrand ? `<span class="brand-tag">${escHtml(it.brand)}</span> ` : '';
  return `<tr>
    <td class="col-check">☐</td>
    <td class="col-img">${imgTag}</td>
    <td class="col-product">${brandTag}${escHtml(it.productName)} <span class="sub">/ ${escHtml(it.color)} / ${escHtml(it.size)}</span></td>
    <td class="col-qty">${it.quantity}</td>
    <td class="col-member">${escHtml(it.userName)}</td>
    <td class="col-date">${fmtDate(it.orderDate)}</td>
  </tr>`;
}

function groupByProduct(items: PrintableItem[]): Map<string, { label: string; items: PrintableItem[] }> {
  const map = new Map<string, { label: string; items: PrintableItem[] }>();
  for (const it of items) {
    const key = `${it.productId}::${it.color}::${it.size}`;
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, { label: `${it.productName} / ${it.color} / ${it.size}`, items: [it] });
  }
  return map;
}

function renderProductGroups(items: PrintableItem[], showBrand = false): string {
  const groups = groupByProduct(items);
  let html = '';
  Array.from(groups.values()).forEach((g) => {
    const qty = g.items.reduce((s: number, it: PrintableItem) => s + it.quantity, 0);
    html += `<div class="group">
      <table>
        <thead><tr><th class="group-header" colspan="6">${escHtml(g.label)} — ${qty}장</th></tr></thead>
        <tbody>${g.items.map((it: PrintableItem) => itemRow(it, showBrand)).join('')}</tbody>
      </table>
    </div>`;
  });
  return html;
}

function renderMemberGroups(items: PrintableItem[], showBrand = false): string {
  const map = new Map<string, PrintableItem[]>();
  for (const it of items) {
    const list = map.get(it.userName) ?? [];
    list.push(it);
    map.set(it.userName, list);
  }
  const sorted = Array.from(map.keys()).sort();
  let html = '';
  for (const member of sorted) {
    const memberItems = map.get(member)!;
    const qty = memberItems.reduce((s, it) => s + it.quantity, 0);
    html += `<div class="group">
      <table>
        <thead><tr><th class="group-header" colspan="6">${escHtml(member)} — ${qty}장</th></tr></thead>
        <tbody>${memberItems.map((it) => itemRow(it, showBrand)).join('')}</tbody>
      </table>
    </div>`;
  }
  return html;
}

export function buildPrintHtml(config: {
  title: string;
  receiptNumber?: string | null;
  sortBy: 'product' | 'member';
  items: PrintableItem[];
  mallMap?: Record<string, string>; // brand → 건물 (for 일별입고 grouping)
}): string {
  const { title, receiptNumber, sortBy, items, mallMap } = config;
  const now = new Date();
  const printDt = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);

  let bodyHtml = '';

  if (mallMap) {
    // 일별입고: 건물 → 브랜드 그룹
    const byBuilding = new Map<string, Map<string, PrintableItem[]>>();
    for (const it of items) {
      const building = mallMap[it.brand] || '기타';
      if (!byBuilding.has(building)) byBuilding.set(building, new Map());
      const byBrand = byBuilding.get(building)!;
      const list = byBrand.get(it.brand) ?? [];
      list.push(it);
      byBrand.set(it.brand, list);
    }
    const sortedBuildings = Array.from(byBuilding.keys()).sort((a, b) => a === '기타' ? 1 : b === '기타' ? -1 : a.localeCompare(b, 'ko'));
    for (const building of sortedBuildings) {
      const byBrand = byBuilding.get(building)!;
      const buildingQty = Array.from(byBrand.values()).flat().reduce((s, it) => s + it.quantity, 0);
      bodyHtml += `<div class="building-header">${escHtml(building)} — ${buildingQty}장</div>`;
      const sortedBrands = Array.from(byBrand.keys()).sort((a, b) => a.localeCompare(b, 'ko'));
      for (const brand of sortedBrands) {
        const brandItems = byBrand.get(brand)!;
        const brandQty = brandItems.reduce((s, it) => s + it.quantity, 0);
        bodyHtml += `<div class="brand-section">
          <div class="brand-header">${escHtml(brand)} — ${brandQty}장</div>
          ${sortBy === 'product' ? renderProductGroups(brandItems) : renderMemberGroups(brandItems)}
        </div>`;
      }
    }
  } else {
    // 단일 브랜드 (영수증 대조)
    bodyHtml = sortBy === 'product'
      ? renderProductGroups(items)
      : renderMemberGroups(items);
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escHtml(title)}</title>
<style>
@page {
  size: A4 portrait;
  margin: 15mm 15mm 20mm 15mm;
}
@page :right { @bottom-right { content: counter(page) " / " counter(pages); font-size: 8.5pt; color: #888; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Malgun Gothic', '맑은 고딕', AppleGothic, sans-serif; font-size: 10.5pt; color: #222; }
.print-header { border-bottom: 2pt solid #222; padding-bottom: 7pt; margin-bottom: 12pt; }
.print-header h1 { font-size: 15pt; font-weight: 700; }
.print-header .meta { font-size: 9pt; color: #555; margin-top: 5pt; display: flex; gap: 18pt; flex-wrap: wrap; }
.building-header { font-size: 12pt; font-weight: 700; background: #1e293b; color: #fff; padding: 5pt 8pt; margin: 14pt 0 5pt; border-radius: 3pt; page-break-before: auto; }
.brand-section { margin-bottom: 10pt; }
.brand-header { font-size: 11pt; font-weight: 600; border-bottom: 1.5pt solid #555; padding-bottom: 3pt; margin-bottom: 5pt; }
.group { page-break-inside: avoid; break-inside: avoid; margin-bottom: 7pt; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.group-header { text-align: left; font-size: 10.5pt; font-weight: 600; background: #f1f5f9; padding: 4pt 6pt; border: 0.75pt solid #aaa; }
td { padding: 3pt 5pt; border: 0.5pt solid #ddd; vertical-align: middle; }
.col-check { width: 16pt; text-align: center; font-size: 12pt; line-height: 1; }
.col-img { width: 48pt; text-align: center; padding: 2pt; }
.col-qty { width: 26pt; text-align: center; font-weight: 700; }
.col-member { width: 72pt; font-size: 9pt; word-break: break-all; }
.col-date { width: 58pt; font-size: 9pt; color: #666; }
.col-product .sub { color: #666; }
.brand-tag { background: #e2e8f0; border-radius: 3pt; padding: 0 4pt; font-size: 8.5pt; margin-right: 3pt; }
tbody tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
<div class="print-header">
  <h1>${escHtml(title)}</h1>
  <div class="meta">
    <span>인쇄: ${printDt}</span>
    ${receiptNumber ? `<span>영수증 번호: ${escHtml(receiptNumber)}</span>` : ''}
    <span>총 수량: ${totalQty}장</span>
    <span>정렬: ${sortBy === 'product' ? '상품별' : '회원별'}</span>
  </div>
</div>
${bodyHtml}
</body>
</html>`;
}

export function printInvoiceItems(config: Parameters<typeof buildPrintHtml>[0]): void {
  const html = buildPrintHtml(config);
  const win = window.open('', '_blank');
  if (!win) {
    alert('팝업이 차단되어 있습니다. 팝업을 허용한 후 다시 시도해주세요.');
    return;
  }
  win.document.write(html);
  win.document.close();
  // 이미지 로드 후 인쇄 (최대 1.5초 대기)
  setTimeout(() => { win.focus(); win.print(); }, 1200);
}
