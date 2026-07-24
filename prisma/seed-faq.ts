import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRANSLATE_TARGET_LANGS = ['en', 'vi', 'th', 'ru', 'mn', 'es'] as const;
type TranslateTargetLang = typeof TRANSLATE_TARGET_LANGS[number];

async function translateBatch(texts: string[], target: TranslateTargetLang): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: 'ko', target, format: 'text' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Translate API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const translations = data?.data?.translations as { translatedText: string }[] | undefined;
  if (!translations) throw new Error('Unexpected Google Translate API response shape');
  return translations.map((t) => t.translatedText);
}

// lib/translate.ts의 translateAndSaveFaq와 동일한 로직 — ts-node에서 '@/' 경로 별칭을 못 읽어 자체 포함시킴
async function translateAndSaveFaq(faqId: string, question: string, answer: string): Promise<void> {
  const source = [question, answer];
  const result: Partial<Record<`question_${TranslateTargetLang}` | `answer_${TranslateTargetLang}`, string>> = {};

  await Promise.all(
    TRANSLATE_TARGET_LANGS.map(async (lang) => {
      try {
        const translated = await translateBatch(source, lang);
        result[`question_${lang}`] = translated[0] || question;
        result[`answer_${lang}`]   = translated[1] || answer;
      } catch (err) {
        console.error(`[translate] faq failed for lang=${lang}:`, err);
      }
    })
  );

  await prisma.faq.update({ where: { id: faqId }, data: { ...result, translatedAt: new Date() } });
}

const DATA: { category: string; items: { question: string; answer: string }[] }[] = [
  {
    category: '주문방법',
    items: [
      {
        question: '회원가입은 어떻게 하나요?',
        answer: '샵 정보(샵 이름, 국가, 연락처)를 입력해서 회원가입을 진행해주세요. 승인이 완료되면 로그인 후 바로 주문하실 수 있습니다.',
      },
      {
        question: '최소 주문 금액이 있나요?',
        answer: '네, 주문 1건당 최소 500,000원 이상부터 주문이 가능합니다.',
      },
      {
        question: '주문 전에 색상과 사이즈를 선택할 수 있나요?',
        answer: '네, 각 상품마다 선택 가능한 색상과 사이즈가 표시됩니다. 장바구니에 담기 전에 정확히 선택해주세요.',
      },
      {
        question: '상품이 품절되면 어떻게 되나요?',
        answer: '일시 품절된 상품은 표시되며, 관심상품(♡)으로 등록하시면 재입고 시 확인하실 수 있습니다.',
      },
      {
        question: '주문 후 취소가 가능한가요?',
        answer: '정해진 시간 내에서는 주문 취소가 가능합니다. 이후에는 주문이 확정 처리되어 취소가 불가능합니다.',
      },
    ],
  },
  {
    category: '배송방법',
    items: [
      {
        question: '주문 내역은 어디서 확인하나요?',
        answer: '마이페이지의 "배송내역" 메뉴에서 배송 상태를 확인하실 수 있습니다.',
      },
    ],
  },
  {
    category: '결제',
    items: [
      {
        question: '어떤 결제 방법을 지원하나요?',
        answer: '현재 계좌이체만 지원하고 있습니다. 주문 후 안내된 계좌로 입금해주시면, 입금 확인 후 주문이 처리됩니다.',
      },
      {
        question: '거래 및 입금 내역을 볼 수 있나요?',
        answer: '네, "나의계좌" 메뉴에서 거래 내역을 확인하실 수 있습니다.',
      },
    ],
  },
  {
    category: '교환반품',
    items: [
      {
        question: '교환/반품 정책이 어떻게 되나요?',
        answer: '상품 하자(불량)의 경우, 수령일로부터 7일 이내에 교환이 가능합니다. 단, 해외 거주 고객님의 경우 해당 불량 상품은 취소 및 환불 처리해드리며, 상품을 반송하실 필요는 없습니다.',
      },
      {
        question: '다른 사유(사이즈 착오, 색상 마음에 안 듦 등)로도 교환 가능한가요?',
        answer: '죄송합니다. 현재는 상품 하자에 한해서만 교환이 가능합니다. 주문 전 상품 정보를 꼼꼼히 확인해주세요.',
      },
      {
        question: '불량/누락 상품은 어떻게 신고하나요?',
        answer: '수령일로부터 7일 이내에 "문의" 메뉴 또는 고객센터를 통해 상품 사진과 함께 연락해주시면 신속히 도와드리겠습니다.',
      },
    ],
  },
];

async function main() {
  for (const { category, items } of DATA) {
    let order = 0;
    for (const { question, answer } of items) {
      const faq = await prisma.faq.create({
        data: { category, question, answer, order: order++ },
      });
      console.log(`[created] ${category} - ${question}`);
      await translateAndSaveFaq(faq.id, question, answer);
      console.log(`[translated] ${category} - ${question}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
