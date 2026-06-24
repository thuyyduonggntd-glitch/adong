'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type Section = 'login' | 'shop' | 'shipping';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [activeSection, setActiveSection] = useState<Section>('login');
  const [form, setForm] = useState({ name: '', phone: '', address: '', shopName: '', businessNumber: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/users/me').then((r) => r.json()).then((data) => {
        setForm({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          shopName: data.shopName || '',
          businessNumber: data.businessNumber || '',
        });
      });
    }
  }, [session]);

  const handleSave = async () => {
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: 'login',    label: '로그인 정보', icon: '🔐' },
    { key: 'shop',     label: '샵 정보',     icon: '🏪' },
    { key: 'shipping', label: '배송 정보',   icon: '📦' },
  ];

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold text-slate-800 mb-4">회원 정보</h2>

      {/* 섹션 탭 */}
      <div className="flex gap-2 mb-6">
        {sections.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === s.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      <div className="card p-6 space-y-4">
        {activeSection === 'login' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이메일 (아이디)</label>
              <input className="input bg-slate-50 text-slate-400 cursor-not-allowed" value={session?.user?.email || ''} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
              <input className="input" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">연락처</label>
              <input className="input" placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </>
        )}

        {activeSection === 'shop' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">샵(업체) 이름</label>
              <input className="input" placeholder="샵 이름 또는 업체명" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">사업자번호</label>
              <input className="input" placeholder="000-00-00000" value={form.businessNumber} onChange={(e) => setForm({ ...form, businessNumber: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">대표 연락처</label>
              <input className="input" placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </>
        )}

        {activeSection === 'shipping' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">기본 배송 주소</label>
              <input className="input" placeholder="배송 받을 기본 주소" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">수령인 이름</label>
              <input className="input" placeholder="수령인 이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">수령인 연락처</label>
              <input className="input" placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </>
        )}

        <button onClick={handleSave} className="w-full btn-primary">
          {saved ? '✓ 저장되었습니다!' : '저장하기'}
        </button>
      </div>
    </div>
  );
}
