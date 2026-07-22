'use client';
import { useState } from 'react';

export type BrandModalRow = {
  key: string;
  id: string;
  source: 'order' | 'supplier';
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
};

export default function BrandPriceModal({
  brand, rows, onSave, onClose,
}: {
  brand: string;
  rows: BrandModalRow[];
  onSave: (changes: { key: string; id: string; source: 'order' | 'supplier'; price: number }[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, String(r.price)]))
  );
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const applyRate = (key: string, r: string, basePrice: number) => {
    setRates((prev) => ({ ...prev, [key]: r }));
    const n = Number(r);
    if (r !== '' && !isNaN(n)) {
      setValues((prev) => ({ ...prev, [key]: String(Math.round(basePrice * (1 - n / 100))) }));
    }
  };

  const handleSave = async () => {
    const changes = rows
      .filter((r) => {
        const v = Number(values[r.key]);
        return !isNaN(v) && v >= 0 && v !== r.price;
      })
      .map((r) => ({ key: r.key, id: r.id, source: r.source, price: Number(values[r.key]) }));
    if (changes.length === 0) { onClose(); return; }
    setSaving(true);
    await onSave(changes);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{brand} — 입고 상품 금액 수정</h3>
          <p className="text-xs text-slate-400 mt-0.5">금액을 직접 바꾸거나 세일율(%)을 입력하면 자동 계산됩니다. 바뀐 항목만 저장됩니다.</p>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400 uppercase">
              <tr>
                <th className="text-left py-2">구분</th>
                <th className="text-left py-2">상품</th>
                <th className="text-left py-2">사이즈/색상</th>
                <th className="text-center py-2">수량</th>
                <th className="text-left py-2 pl-2">금액</th>
                <th className="text-left py-2 pl-2">세일율(%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-2">
                    {r.source === 'order'
                      ? <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">주문</span>
                      : <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">공급업체</span>}
                  </td>
                  <td className="py-2 pr-2 max-w-[140px] truncate">{r.name}</td>
                  <td className="py-2 text-xs text-slate-500 whitespace-nowrap">{r.size} / {r.color}</td>
                  <td className="py-2 text-center">{r.quantity}</td>
                  <td className="py-2 pl-2">
                    <input type="number" className="input text-sm w-24 py-1"
                      value={values[r.key] ?? ''}
                      onChange={(e) => { setValues((prev) => ({ ...prev, [r.key]: e.target.value })); setRates((prev) => ({ ...prev, [r.key]: '' })); }} />
                  </td>
                  <td className="py-2 pl-2">
                    <input type="number" className="input text-sm w-20 py-1" placeholder="-"
                      value={rates[r.key] ?? ''}
                      onChange={(e) => applyRate(r.key, e.target.value, r.price)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">해당 브랜드의 입고 항목이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-outline text-sm">취소</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-6 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
