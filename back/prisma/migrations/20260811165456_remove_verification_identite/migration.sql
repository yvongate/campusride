/*
  Warnings:

  - You are about to drop the `VerificationIdentite` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "VerificationIdentite" DROP CONSTRAINT "VerificationIdentite_userId_fkey";

-- DropTable
DROP TABLE "VerificationIdentite";
