/**
 * 브랜드별 샘플 상품 시드 스크립트
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-products.ts
 * 또는: npx tsx prisma/seed-products.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PH = (w: number, h: number, bg: string, text: string) =>
  `https://placehold.co/${w}x${h}/${bg}?text=${encodeURIComponent(text)}`;

async function main() {
  const cats = await prisma.category.findMany();
  const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  const baby    = catMap['baby']     || cats[0]?.id;
  const toddler = catMap['toddler']  || cats[0]?.id;
  const kids    = catMap['kids']     || cats[0]?.id;
  const newborn = catMap['newborn']  || cats[0]?.id;
  const acc     = catMap['accessory']|| cats[0]?.id;

  const products = [
    // ── Aimée ──
    { name: 'Aimée 클래식 블라우스', brand: 'Aimée', productNumber: 'AIME-BLU-001', season: '여름1차', material: '면100%', gender: '여아', productType: '블라우스', wholesalePrice: 18000, price: 28000, stock: 40, categoryId: toddler, sizes: ['90','100','110'], colors: ['화이트','연핑크'], images: [PH(400,400,'EFF6FF','Aimée%20블라우스')] },
    { name: 'Aimée 리본 원피스', brand: 'Aimée', productNumber: 'AIME-DRS-002', season: '여름2차', material: '시폰+면', gender: '여아', productType: '원피스', wholesalePrice: 22000, price: 35000, stock: 30, categoryId: toddler, sizes: ['90','100','110','120'], colors: ['연보라','민트'], images: [PH(400,400,'EFF6FF','Aimée%20원피스')] },
    // ── Bambi ──
    { name: 'Bambi 스트라이프 티셔츠', brand: 'Bambi', productNumber: 'BAMB-TSH-001', season: '여름1차', material: '면100%', gender: '공용', productType: '티셔츠', wholesalePrice: 9000, price: 14000, stock: 60, categoryId: baby, sizes: ['70','80','90'], colors: ['스카이블루','화이트'], images: [PH(400,400,'FFF7ED','Bambi%20티셔츠')] },
    { name: 'Bambi 데님 쇼츠', brand: 'Bambi', productNumber: 'BAMB-SHT-002', season: '여름1차', material: '데님', gender: '공용', productType: '반바지', wholesalePrice: 11000, price: 18000, stock: 45, categoryId: baby, sizes: ['70','80','90'], colors: ['연청','진청'], images: [PH(400,400,'FFF7ED','Bambi%20반바지')] },
    // ── Cloud Baby ──
    { name: 'Cloud Baby 구름 바디수트', brand: 'Cloud Baby', productNumber: 'CLDB-BDS-001', season: '사계절', material: '순면100%', gender: '공용', productType: '바디수트', wholesalePrice: 12000, price: 19000, stock: 80, categoryId: newborn, sizes: ['50','60','70'], colors: ['화이트','하늘','연두'], images: [PH(400,400,'F0FDF4','Cloud%20Baby%20바디수트')] },
    { name: 'Cloud Baby 솜사탕 점프수트', brand: 'Cloud Baby', productNumber: 'CLDB-JMP-002', season: '봄여름', material: '면혼방', gender: '공용', productType: '점프수트', wholesalePrice: 15000, price: 24000, stock: 50, categoryId: newborn, sizes: ['60','70','80'], colors: ['아이보리','핑크'], images: [PH(400,400,'F0FDF4','Cloud%20Baby%20점프수트')] },
    // ── Dreamy ──
    { name: 'Dreamy 꿈의 드레스', brand: 'Dreamy', productNumber: 'DRMY-DRS-001', season: '여름2차', material: '레이스+면', gender: '여아', productType: '드레스', wholesalePrice: 25000, price: 42000, isOnSale: true, discountRate: 10, salePrice: 38000, stock: 25, categoryId: kids, sizes: ['110','120','130'], colors: ['화이트','연베이지'], images: [PH(400,400,'FDF4FF','Dreamy%20드레스')] },
    { name: 'Dreamy 퍼플 가디건', brand: 'Dreamy', productNumber: 'DRMY-CDG-002', season: '봄', material: '니트', gender: '여아', productType: '가디건', wholesalePrice: 16000, price: 26000, stock: 35, categoryId: kids, sizes: ['100','110','120','130'], colors: ['보라','라벤더'], images: [PH(400,400,'FDF4FF','Dreamy%20가디건')] },
    // ── Elfin ──
    { name: 'Elfin 엘프 파자마 세트', brand: 'Elfin', productNumber: 'ELFN-PJM-001', season: '사계절', material: '순면100%', gender: '공용', productType: '파자마세트', wholesalePrice: 20000, price: 32000, stock: 40, categoryId: toddler, sizes: ['90','100','110'], colors: ['그린','네이비'], images: [PH(400,400,'FFF1F2','Elfin%20파자마')] },
    { name: 'Elfin 스타 반소매 티', brand: 'Elfin', productNumber: 'ELFN-TSH-002', season: '여름1차', material: '면100%', gender: '남아', productType: '티셔츠', wholesalePrice: 8000, price: 13000, stock: 70, categoryId: baby, sizes: ['70','80','90'], colors: ['스카이블루','오렌지'], images: [PH(400,400,'FFF1F2','Elfin%20반소매')] },
    // ── Fluffie ──
    { name: 'Fluffie 구름 후드집업', brand: 'Fluffie', productNumber: 'FLFF-HZP-001', season: '가을', material: '기모면', gender: '공용', productType: '후드집업', wholesalePrice: 22000, price: 36000, stock: 30, categoryId: kids, sizes: ['110','120','130','140'], colors: ['화이트','그레이'], images: [PH(400,400,'ECFEFF','Fluffie%20후드집업')] },
    { name: 'Fluffie 보들보들 조끼', brand: 'Fluffie', productNumber: 'FLFF-VST-002', season: '가을겨울', material: '양털기모', gender: '공용', productType: '조끼', wholesalePrice: 18000, price: 29000, stock: 45, categoryId: toddler, sizes: ['90','100','110'], colors: ['베이지','핑크'], images: [PH(400,400,'ECFEFF','Fluffie%20조끼')] },
    // ── Gentle ──
    { name: 'Gentle 신사 체크 셔츠', brand: 'Gentle', productNumber: 'GNTL-SHT-001', season: '봄가을', material: '면혼방', gender: '남아', productType: '셔츠', wholesalePrice: 14000, price: 22000, stock: 50, categoryId: kids, sizes: ['110','120','130','140'], colors: ['블루체크','그린체크'], images: [PH(400,400,'FEFCE8','Gentle%20셔츠')] },
    { name: 'Gentle 치노 팬츠', brand: 'Gentle', productNumber: 'GNTL-PNT-002', season: '사계절', material: '면혼방', gender: '남아', productType: '팬츠', wholesalePrice: 13000, price: 21000, stock: 55, categoryId: kids, sizes: ['110','120','130'], colors: ['베이지','카키'], images: [PH(400,400,'FEFCE8','Gentle%20팬츠')] },
    // ── Happy Bear ──
    { name: 'Happy Bear 곰돌이 맨투맨', brand: 'Happy Bear', productNumber: 'HPBR-SWT-001', season: '가을겨울', material: '기모면100%', gender: '공용', productType: '맨투맨', wholesalePrice: 16000, price: 25000, stock: 60, categoryId: toddler, sizes: ['90','100','110'], colors: ['브라운','크림'], images: [PH(400,400,'FFF7ED','Happy%20Bear%20맨투맨')] },
    { name: 'Happy Bear 후리스 점퍼', brand: 'Happy Bear', productNumber: 'HPBR-JKT-002', season: '겨울', material: '후리스', gender: '공용', productType: '점퍼', wholesalePrice: 24000, price: 38000, isOnSale: true, discountRate: 15, salePrice: 32000, stock: 20, categoryId: kids, sizes: ['110','120','130','140'], colors: ['베이지','카키'], images: [PH(400,400,'FFF7ED','Happy%20Bear%20점퍼')] },
    // ── Ivory ──
    { name: 'Ivory 클린 린넨 팬츠', brand: 'Ivory', productNumber: 'IVRY-PNT-001', season: '여름1차', material: '린넨혼방', gender: '공용', productType: '팬츠', wholesalePrice: 12000, price: 19000, stock: 50, categoryId: toddler, sizes: ['90','100','110'], colors: ['아이보리','라이트그레이'], images: [PH(400,400,'F8FAFC','Ivory%20린넨팬츠')] },
    { name: 'Ivory 베이직 가디건', brand: 'Ivory', productNumber: 'IVRY-CDG-002', season: '봄가을', material: '코튼니트', gender: '공용', productType: '가디건', wholesalePrice: 17000, price: 27000, stock: 40, categoryId: kids, sizes: ['100','110','120','130'], colors: ['화이트','오트밀'], images: [PH(400,400,'F8FAFC','Ivory%20가디건')] },
    // ── Jelly Pop ──
    { name: 'Jelly Pop 젤리 레깅스', brand: 'Jelly Pop', productNumber: 'JLPP-LGS-001', season: '사계절', material: '스판덱스혼방', gender: '여아', productType: '레깅스', wholesalePrice: 8000, price: 13000, stock: 80, categoryId: baby, sizes: ['70','80','90'], colors: ['핑크','퍼플','민트'], images: [PH(400,400,'FDF2F8','Jelly%20Pop%20레깅스')] },
    { name: 'Jelly Pop 캔디 스커트', brand: 'Jelly Pop', productNumber: 'JLPP-SKT-002', season: '여름2차', material: '폴리혼방', gender: '여아', productType: '스커트', wholesalePrice: 10000, price: 16000, stock: 60, categoryId: toddler, sizes: ['90','100','110'], colors: ['딸기레드','레몬옐로우'], images: [PH(400,400,'FDF2F8','Jelly%20Pop%20스커트')] },
    // ── Kinder ──
    { name: 'Kinder 원목 버튼 셋업', brand: 'Kinder', productNumber: 'KNDR-SET-001', season: '봄', material: '면100%', gender: '공용', productType: '상하세트', wholesalePrice: 21000, price: 34000, stock: 35, categoryId: toddler, sizes: ['90','100','110'], colors: ['머스타드','테라코타'], images: [PH(400,400,'FFFBEB','Kinder%20셋업')] },
    { name: 'Kinder 자연 니트 베스트', brand: 'Kinder', productNumber: 'KNDR-VST-002', season: '가을', material: '울혼방니트', gender: '공용', productType: '조끼/베스트', wholesalePrice: 15000, price: 24000, stock: 45, categoryId: kids, sizes: ['100','110','120'], colors: ['베이지','그린'], images: [PH(400,400,'FFFBEB','Kinder%20니트베스트')] },
    // ── Little Star ──
    { name: 'Little Star 별빛 원피스', brand: 'Little Star', productNumber: 'LTST-DRS-001', season: '여름2차', material: '면+폴리', gender: '여아', productType: '원피스', wholesalePrice: 19000, price: 30000, stock: 35, categoryId: kids, sizes: ['110','120','130'], colors: ['네이비별','화이트별'], images: [PH(400,400,'EFF6FF','Little%20Star%20원피스')] },
    { name: 'Little Star 플리츠 스커트', brand: 'Little Star', productNumber: 'LTST-SKT-002', season: '봄여름', material: '폴리혼방', gender: '여아', productType: '스커트', wholesalePrice: 11000, price: 18000, stock: 55, categoryId: toddler, sizes: ['90','100','110','120'], colors: ['네이비','핑크'], images: [PH(400,400,'EFF6FF','Little%20Star%20스커트')] },
    // ── Mellow ──
    { name: 'Mellow 내추럴 후드티', brand: 'Mellow', productNumber: 'MELW-HDT-001', season: '가을겨울', material: '기모면', gender: '공용', productType: '후드티', wholesalePrice: 17000, price: 27000, stock: 50, categoryId: kids, sizes: ['110','120','130','140'], colors: ['올리브','세이지그린'], images: [PH(400,400,'F0FDF4','Mellow%20후드티')] },
    { name: 'Mellow 오가닉 바디수트', brand: 'Mellow', productNumber: 'MELW-BDS-002', season: '사계절', material: '오가닉코튼100%', gender: '공용', productType: '바디수트', wholesalePrice: 13000, price: 21000, stock: 65, categoryId: newborn, sizes: ['50','60','70'], colors: ['내추럴','세이지'], images: [PH(400,400,'F0FDF4','Mellow%20바디수트')] },
  ];

  let created = 0;
  for (const p of products) {
    const exists = await prisma.product.findFirst({ where: { productNumber: p.productNumber } });
    if (exists) { console.log(`스킵 (이미 존재): ${p.name}`); continue; }
    await prisma.product.create({ data: { ...p, description: `${p.brand} ${p.productType} / ${p.material} / ${p.gender}`, sizeImages: [] } });
    console.log(`생성: ${p.name}`);
    created++;
  }

  console.log(`\n완료: ${created}개 상품 추가됨 (총 ${products.length}개 처리)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
