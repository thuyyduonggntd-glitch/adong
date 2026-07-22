'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from '@/components/PhoneInput';

type Section = 'login' | 'shop' | 'shipping';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [activeSection, setActiveSection] = useState<Section>('login');
  const [form, setForm] = useState({ name: '', phone: '', address: '', shopName: '', businessNumber: '', shopSiteUrl: '' });
  const [country, setCountry] = useState('');
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
          shopSiteUrl: data.shopSiteUrl || '',
        });
        setCountry(data.country || '');
      });
    }
  }, [session]);

  const handleSave = async () => {
    if (!form.businessNumber && !form.shopSiteUrl) {
      alert(t('profile.bizOrSiteAlert'));
      return;
    }
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: 'login',    label: t('profile.section.login'),    icon: '🔐' },
    { key: 'shop',     label: t('profile.section.shop'),     icon: '🏪' },
    { key: 'shipping', label: t('profile.section.shipping'), icon: '📦' },
  ];

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold text-slate-800 mb-4">{t('profile.title')}</h2>

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
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('profile.emailId')}</label>
              <input className="input bg-slate-50 text-slate-400 cursor-not-allowed" value={session?.user?.email || ''} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.name')}</label>
              <input className="input" placeholder={t('register.namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.phone')}</label>
              <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} placeholder={t('register.phonePlaceholder')} />
            </div>
          </>
        )}

        {activeSection === 'shop' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.shopName')}</label>
              <input className="input" placeholder={t('register.shopNamePlaceholder')} value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.businessNumber')}</label>
              <input className="input" placeholder={t('register.businessNumberPlaceholder')} value={form.businessNumber} onChange={(e) => setForm({ ...form, businessNumber: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.shopSiteUrl')}</label>
              <input className="input" placeholder={t('register.shopSiteUrlPlaceholder')} value={form.shopSiteUrl} onChange={(e) => setForm({ ...form, shopSiteUrl: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">{t('profile.bizOrSiteAlert')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('profile.representativePhone')}</label>
              <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} placeholder={t('register.phonePlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.country')}</label>
              <input className="input bg-slate-50 text-slate-400 cursor-not-allowed" value={country || t('profile.countryNotSet')} disabled />
              <p className="text-xs text-slate-400 mt-1">{t('profile.countryHint')}</p>
            </div>
          </>
        )}

        {activeSection === 'shipping' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('profile.defaultAddress')}</label>
              <input className="input" placeholder={t('profile.defaultAddressPlaceholder')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('profile.recipientName')}</label>
              <input className="input" placeholder={t('profile.recipientName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('profile.recipientPhone')}</label>
              <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} placeholder={t('register.phonePlaceholder')} />
            </div>
          </>
        )}

        <button onClick={handleSave} className="w-full btn-primary">
          {saved ? t('profile.saved') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
