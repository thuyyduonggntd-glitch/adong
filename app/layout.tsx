import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '꿈비샵 - 아동복 전문 쇼핑몰',
  description: '아이들을 위한 귀엽고 안전한 아동복 전문 쇼핑몰',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
