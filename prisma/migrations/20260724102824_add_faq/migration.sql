-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "question_en" TEXT,
    "question_vi" TEXT,
    "question_th" TEXT,
    "question_ru" TEXT,
    "question_mn" TEXT,
    "question_es" TEXT,
    "answer_en" TEXT,
    "answer_vi" TEXT,
    "answer_th" TEXT,
    "answer_ru" TEXT,
    "answer_mn" TEXT,
    "answer_es" TEXT,
    "translatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faq_category_idx" ON "Faq"("category");
