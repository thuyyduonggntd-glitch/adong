'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, COUNTRY_DIAL_CODES } from '@/lib/countries';
import { splitPhone, joinPhone } from '@/lib/phone';
import PhoneInput from '@/components/PhoneInput';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';

const ERROR_CODE_KEY: Record<string, string> = {
  MISSING_FIELDS: 'register.err.missingFields',
  PASSWORD_TOO_SHORT: 'register.err.passwordTooShort',
  BIZ_OR_SITE_REQUIRED: 'register.err.bizOrSiteRequired',
  EMAIL_TAKEN: 'register.err.emailTaken',
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '', country: '',
    shopName: '', businessNumber: '', shopSiteUrl: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessNumber && !form.shopSiteUrl) {
      setError(t('register.errorMissingBizOrSite'));
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      const key = data.code && ERROR_CODE_KEY[data.code];
      setError(key ? t(key) : data.error || t('register.errorGeneric'));
      setLoading(false);
      return;
    }
    router.push('/login?registered=1');
  };

  const fields = [
    { key: 'name',     label: t('register.name'),     type: 'text',     placeholder: t('register.namePlaceholder') },
    { key: 'email',    label: t('register.email'),    type: 'email',    placeholder: t('register.emailPlaceholder') },
    { key: 'password', label: t('register.password'), type: 'password', placeholder: t('register.passwordPlaceholder') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <Link href="/home" className="text-3xl font-bold text-primary-700 notranslate">{t('brand.name')}</Link>
          <p className="text-slate-500 text-sm mt-1">{t('brand.tagline')}</p>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">{t('register.title')}</h1>
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type={type}
                  className="input"
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required
                  minLength={key === 'password' ? 8 : undefined}
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.country')}</label>
              <select
                className="input"
                value={form.country}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  const dialCode = COUNTRY_DIAL_CODES[nextCountry] || '';
                  const { number } = splitPhone(form.phone);
                  setForm({ ...form, country: nextCountry, phone: dialCode ? joinPhone(dialCode, number) : form.phone });
                }}
              >
                <option value="">{t('register.countryNone')}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.phone')}</label>
              <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} placeholder={t('register.phonePlaceholder')} />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.shopName')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('register.shopNamePlaceholder')}
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.businessNumber')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('register.businessNumberPlaceholder')}
                value={form.businessNumber}
                onChange={(e) => setForm({ ...form, businessNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.shopSiteUrl')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('register.shopSiteUrlPlaceholder')}
                value={form.shopSiteUrl}
                onChange={(e) => setForm({ ...form, shopSiteUrl: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">{t('register.bizOrSiteHint')}</p>
            </div>

            <p className="text-xs text-slate-400">{t('register.approvalNotice')}</p>

            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
              {loading ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            {t('register.haveAccount')}{' '}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">{t('register.loginLink')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
