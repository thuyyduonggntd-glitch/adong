'use client';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { i18n: instance } = useTranslation();

  const changeLanguage = (code: string) => {
    instance.changeLanguage(code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  };

  return (
    <select
      value={instance.language}
      onChange={(e) => changeLanguage(e.target.value)}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 hover:border-primary-400 focus:outline-none cursor-pointer notranslate"
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
      ))}
    </select>
  );
}
