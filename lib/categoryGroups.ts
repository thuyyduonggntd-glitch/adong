export const CATEGORY_GROUPS = [
  {
    key: 'size', emoji: '📦', labelKey: 'category.group.size',
    slugs: ['newborn', 'baby', 'toddler', 'kids', 'adult', 'couple-family'],
  },
  {
    key: 'clothing', emoji: '👗', labelKey: 'category.group.clothing',
    slugs: ['set', 'suit', 'outer', 'pants', 'tshirts', 'skirt', 'knit', 'one-piece', 'leggings', 'innerwear', 'swimsuit', 'hanbok'],
  },
  {
    key: 'item', emoji: '👟', labelKey: 'category.group.item',
    slugs: ['shoes', 'socks', 'hat', 'accessory', 'bag', 'bib', 'hair-accessory', 'swimwear'],
  },
] as const;

export const SEASONS = [
  { key: 'spring', ko: '봄' },
  { key: 'summer', ko: '여름' },
  { key: 'fall', ko: '가을' },
  { key: 'winter', ko: '겨울' },
] as const;

export const SEASON_GROUP = { key: 'season', emoji: '🌸', labelKey: 'category.group.season' } as const;
