'use client';
import { useState } from 'react';

export default function EditPriceModal({
  title, initialPrice, onSave, onClose,
}: {
  title: string;
  initialPrice: number;
  onSave: (price: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(String(initialPrice));
  const [rate, setRate]   = useState('');
  const [saving, setSaving] = useState(false);

  const applyRate = (r: string) => {
    setRate(r);
    const n = Number(r);
    if (r !== '' && !isNaN(n)) setPrice(String(Math.round(initialPrice * (1 - n / 100))));
  };

  const handleSave = async () => {
    const p = Number(price);
    if (isNaN(p) || p < 0) { alert('올바른 금액을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(p);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800">{title}</h3>
        <div>
          <label className="block text-xs text-slate-500 mb-1">금액 (원)</label>
          <input autoFocus type="number" className="input text-sm w-full"
            value={price} onChange={(e) => { setPrice(e.target.value); setRate(''); }} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            세일율 (%) — 입력 시 원래 금액({initialPrice.toLocaleString()}원) 기준 자동 계산
          </label>
          <input type="number" className="input text-sm w-full" placeholder="예: 20"
            value={rate} onChange={(e) => applyRate(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="btn-outline text-sm">취소</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-6 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
