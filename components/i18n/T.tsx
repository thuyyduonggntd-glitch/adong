'use client';
import { useTranslation } from 'react-i18next';

export default function T({ k, values }: { k: string; values?: Record<string, string | number> }) {
  const { t } = useTranslation();
  return <>{t(k, values)}</>;
}
