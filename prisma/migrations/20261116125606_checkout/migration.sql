/*
  Warnings:

  - Added the required column `lastSeenPrice` to the `CartItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "lastSeenPrice" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sourceCartId" TEXT;

-- Hand-edited: human-readable numbers for orders (RB-10001) and support tickets (T-1001).
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1001;
