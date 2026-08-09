-- CreateTable
CREATE TABLE "Demande" (
    "id" TEXT NOT NULL,
    "createurId" TEXT NOT NULL,
    "universiteId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "quartierId" TEXT,
    "poiId" TEXT,
    "heure" TIMESTAMP(3) NOT NULL,
    "placesRecherchees" INTEGER NOT NULL,
    "cotisation" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Demande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionLat" DOUBLE PRECISION NOT NULL,
    "positionLng" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'confirmee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_universiteId_fkey" FOREIGN KEY ("universiteId") REFERENCES "Universite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "PointInteret"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
