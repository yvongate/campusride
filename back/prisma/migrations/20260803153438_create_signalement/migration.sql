-- CreateTable
CREATE TABLE "Signalement" (
    "id" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "signaleParId" TEXT NOT NULL,
    "concerneId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_signaleParId_fkey" FOREIGN KEY ("signaleParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_concerneId_fkey" FOREIGN KEY ("concerneId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
