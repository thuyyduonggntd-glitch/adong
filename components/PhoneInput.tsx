'use client';
import { COUNTRIES, COUNTRY_DIAL_CODES } from '@/lib/countries';
import { splitPhone, joinPhone } from '@/lib/phone';

export default function PhoneInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { code, number } = splitPhone(value);

  return (
    <div className="flex gap-2">
      <select
        className="input w-32 flex-shrink-0"
        value={code}
        onChange={(e) => onChange(joinPhone(e.target.value, number))}
      >
        <option value="">-</option>
        {COUNTRIES.map((c) => (
          <option key={c} value={COUNTRY_DIAL_CODES[c]}>{c} {COUNTRY_DIAL_CODES[c]}</option>
        ))}
      </select>
      <input
        type="tel"
        className="input flex-1"
        placeholder={placeholder}
        value={number}
        onChange={(e) => onChange(joinPhone(code, e.target.value))}
      />
    </div>
  );
}
