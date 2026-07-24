'use client';

export default function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none">×</button>
      {/* eslint-disable-next-line @next/next/no-img-element -- 다양한 비율의 원본 이미지를 뷰포트에 맞춰 그대로 보여주기 위해 plain img 사용 */}
      <img src={src} alt="" className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
