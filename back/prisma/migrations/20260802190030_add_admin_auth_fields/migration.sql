-- AlterTable
ALTER TABLE "Utilisateur" ALTER COLUMN "telephone" DROP NOT NULL;
ALTER TABLE "Utilisateur" ADD COLUMN "email" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");
