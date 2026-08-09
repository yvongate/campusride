-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "passagerId" TEXT NOT NULL,
    "prixParPersonne" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'confirmee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_passagerId_fkey" FOREIGN KEY ("passagerId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
