'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-primary-900 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold text-primary-200 mb-3 notranslate">{t('brand.name')}</h3>
            <p className="text-primary-300 text-sm leading-relaxed">{t('footer.tagline')}</p>
          </div>
          <div>
            <h4 className="font-semibold text-primary-200 mb-3">{t('footer.shortcuts')}</h4>
            <div className="space-y-1 text-primary-300 text-sm">
              <Link href="/home/products" className="block hover:text-white">{t('footer.allProducts')}</Link>
              <Link href="/home/qna"      className="block hover:text-white">{t('footer.qna')}</Link>
              <Link href="/home/mypage"   className="block hover:text-white">{t('footer.mypage')}</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-primary-200 mb-3">{t('footer.customerCenter')}</h4>
            <p className="text-primary-300 text-sm">{t('footer.kakao')}</p>
            <p className="text-primary-300 text-sm">{t('footer.hours')}</p>
            <p className="text-primary-400 text-xs mt-2">{t('footer.weekendClosed')}</p>
          </div>
        </div>
        <div className="border-t border-primary-700 mt-8 pt-6 text-center text-primary-500 text-xs">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
