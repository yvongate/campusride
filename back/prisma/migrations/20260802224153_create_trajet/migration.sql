-- CreateTable
CREATE TABLE "Trajet" (
    "id" TEXT NOT NULL,
    "conducteurId" TEXT NOT NULL,
    "universiteId" TEXT NOT NULL,
    "pointDeRdvId" TEXT NOT NULL,
    "heure" TIMESTAMP(3) NOT NULL,
    "places" INTEGER NOT NULL,
    "prixTotal" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'B',
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trajet_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_conducteurId_fkey" FOREIGN KEY ("conducteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_universiteId_fkey" FOREIGN KEY ("universiteId") REFERENCES "Universite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_pointDeRdvId_fkey" FOREIGN KEY ("pointDeRdvId") REFERENCES "PointInteret"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
