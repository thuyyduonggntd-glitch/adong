-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cancelLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);
