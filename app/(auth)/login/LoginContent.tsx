'use client';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';

export default function LoginContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/home';
  const justRegistered = searchParams.get('registered') === '1';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      if (result.error === 'ACCOUNT_INACTIVE') {
        setError(t('login.errorInactive'));
      } else {
        setError(t('login.errorInvalid'));
      }
      setLoading(false);
      return;
    }

    const meRes = await fetch('/api/users/me');
    const me = await meRes.json();
    if (me.role === 'ADMIN') {
      router.push('/admin/dashboard');
    } else {
      router.push(callbackUrl);
    }
    router.refresh();
  };

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
          <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">{t('login.title')}</h1>

          {justRegistered && !error && (
            <div className="bg-blue-50 text-blue-600 text-sm px-4 py-3 rounded-lg mb-4">
              {t('login.registeredNotice')}
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('login.email')}</label>
              <input
                type="email"
                className="input"
                placeholder={t('login.emailPlaceholder')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('login.password')}</label>
              <input
                type="password"
                className="input"
                placeholder={t('login.passwordPlaceholder')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            {t('login.noAccount')}{' '}
            <Link href="/register" className="text-primary-600 font-medium hover:underline">{t('login.registerLink')}</Link>
          </p>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-400 space-y-1">
            <p>{t('login.testAccountLabel')}</p>
            <p>{t('login.testAdminLabel')}: admin@kkumbb.com / admin1234</p>
            <p>{t('login.testUserLabel')}: kim@test.com / user1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
