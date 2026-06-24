import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-primary-900 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold text-primary-200 mb-3">꿈비샵</h3>
            <p className="text-primary-300 text-sm leading-relaxed">
              아이들의 꿈과 함께하는<br />프리미엄 아동복 전문 쇼핑몰
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-primary-200 mb-3">바로가기</h4>
            <div className="space-y-1 text-primary-300 text-sm">
              <Link href="/home/products" className="block hover:text-white">전체 상품</Link>
              <Link href="/home/qna"      className="block hover:text-white">질의응답</Link>
              <Link href="/home/mypage"   className="block hover:text-white">마이페이지</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-primary-200 mb-3">고객센터</h4>
            <p className="text-primary-300 text-sm">카카오톡: @꿈비샵</p>
            <p className="text-primary-300 text-sm">운영시간: 평일 10:00 – 18:00</p>
            <p className="text-primary-400 text-xs mt-2">주말 및 공휴일 휴무</p>
          </div>
        </div>
        <div className="border-t border-primary-700 mt-8 pt-6 text-center text-primary-500 text-xs">
          © 2024 꿈비샵. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
