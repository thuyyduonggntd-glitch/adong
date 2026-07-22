import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TARGET_LANGS = ['en', 'vi', 'th', 'ru', 'mn', 'es'] as const;

/** lib/translate.ts의 translateBatch/translateAndSaveCategory와 동일한 방식 (경로 alias 없이 단독 실행하기 위해 인라인 구현) */
async function translateOne(text: string, target: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: [text], source: 'ko', target, format: 'text' }),
  });
  if (!res.ok) throw new Error(`Google Translate API error (${res.status}): ${await res.text().catch(() => '')}`);

  const data = await res.json();
  return data?.data?.translations?.[0]?.translatedText || text;
}

async function translateCategory(categoryId: string, name: string) {
  const result: Record<string, string> = {};
  await Promise.all(
    TARGET_LANGS.map(async (lang) => {
      try {
        result[`name_${lang}`] = await translateOne(name, lang);
      } catch (err) {
        console.error(`[translate] category(${categoryId}) failed for lang=${lang}:`, err);
      }
    })
  );
  await prisma.category.update({ where: { id: categoryId }, data: { ...result, translatedAt: new Date() } });
}

async function main() {
  await Promise.all([
    prisma.category.upsert({ where: { slug: 'newborn' },       update: { name: '신생아' },         create: { name: '신생아',         slug: 'newborn' } }),
    prisma.category.upsert({ where: { slug: 'baby' },          update: { name: '베베' },            create: { name: '베베',            slug: 'baby' } }),
    prisma.category.upsert({ where: { slug: 'toddler' },       update: { name: '키즈' },            create: { name: '키즈',            slug: 'toddler' } }),
    prisma.category.upsert({ where: { slug: 'kids' },          update: { name: '주니어' },          create: { name: '주니어',          slug: 'kids' } }),
    prisma.category.upsert({ where: { slug: 'accessory' },     update: {},                          create: { name: '액세서리',        slug: 'accessory' } }),
    prisma.category.upsert({ where: { slug: 'adult' },         update: { name: 'Adult' },           create: { name: 'Adult',           slug: 'adult' } }),
    prisma.category.upsert({ where: { slug: 'couple-family' }, update: { name: '커플&패밀리룩' },   create: { name: '커플&패밀리룩',   slug: 'couple-family' } }),
  ]);
  console.log('카테고리 업데이트 완료');

  const newCategories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'shoes' },    update: { name: '신발' },     create: { name: '신발',     slug: 'shoes' } }),
    prisma.category.upsert({ where: { slug: 'socks' },    update: { name: '양말' },     create: { name: '양말',     slug: 'socks' } }),
    prisma.category.upsert({ where: { slug: 'hat' },      update: { name: '모자' },     create: { name: '모자',     slug: 'hat' } }),
    prisma.category.upsert({ where: { slug: 'bag' },      update: { name: '가방' },     create: { name: '가방',     slug: 'bag' } }),
    prisma.category.upsert({ where: { slug: 'swimwear' }, update: { name: '수영용품' }, create: { name: '수영용품', slug: 'swimwear' } }),
    prisma.category.upsert({ where: { slug: 'hanbok' },   update: { name: '한복' },     create: { name: '한복',     slug: 'hanbok' } }),
  ]);
  console.log('신규 카테고리 6개 추가 완료 — 번역 시작');

  for (const cat of newCategories) {
    await translateCategory(cat.id, cat.name);
    console.log(`  - ${cat.name} (${cat.slug}) 번역 완료`);
  }
  console.log('신규 카테고리 번역 완료');
}
main().catch(console.error).finally(() => prisma.$disconnect());
