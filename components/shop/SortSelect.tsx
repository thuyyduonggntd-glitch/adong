'use client';

export default function SortSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select
      className="input w-auto text-sm"
      defaultValue={defaultValue || 'newest'}
      onChange={(e) => {
        const u = new URL(window.location.href);
        u.searchParams.set('sort', e.target.value);
        window.location.href = u.toString();
      }}
    >
      <option value="newest">최신순</option>
      <option value="price_asc">가격 낮은순</option>
      <option value="price_desc">가격 높은순</option>
    </select>
  );
}
