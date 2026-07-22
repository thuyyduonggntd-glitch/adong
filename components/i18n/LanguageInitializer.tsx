'use client';
import { useEffect } from 'react';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/lib/i18n';

export default function LanguageInitializer() {
  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored !== i18n.language) i18n.changeLanguage(stored);
  }, []);

  return null;
}
