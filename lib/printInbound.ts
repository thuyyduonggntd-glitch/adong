export type InboundPrintRow = {
  key: string;
  source: 'order' | 'supplier';
  userName: string;
  brand: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  image?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printInboundRows(rows: InboundPrintRow[], title: string) {
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return;

  const body = rows.map((r) => `
    <tr>
      <td>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" />` : ''}</td>
      <td>${escapeHtml(r.source === 'order' ? '주문' : '공급업체')}</td>
      <td>${escapeHtml(r.userName)}</td>
      <td>${escapeHtml(r.brand)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.size)}</td>
      <td>${escapeHtml(r.color)}</td>
      <td style="text-align:center">${r.quantity}</td>
    </tr>`).join('');
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

  win.document.write(`
    <html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color: #1e293b; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p { margin: 0 0 16px; font-size: 12px; color: #64748b; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
      th { background: #f1f5f9; text-align: left; }
      tfoot td { font-weight: 700; background: #f8fafc; }
      img { width: 44px; height: 44px; object-fit: cover; border-radius: 4px; display: block; }
      @media print { body { padding: 0; } }
    </style></head>
    <body>
      <h2>${escapeHtml(title)}</h2>
      <p>인쇄일시: ${new Date().toLocaleString('ko-KR')} · 총 ${rows.length}건</p>
      <table>
        <thead><tr><th>사진</th><th>구분</th><th>아이디</th><th>브랜드</th><th>상품명</th><th>사이즈</th><th>색상</th><th>수량</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="7">합계</td><td style="text-align:center">${totalQty}</td></tr></tfoot>
      </table>
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
