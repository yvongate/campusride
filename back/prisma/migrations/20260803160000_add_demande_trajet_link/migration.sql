-- AlterTable
ALTER TABLE "Demande" ADD COLUMN "trajetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Demande_trajetId_key" ON "Demande"("trajetId");

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
