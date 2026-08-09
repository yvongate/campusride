-- CreateTable
CREATE TABLE "DocumentsConducteur" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selfie" TEXT NOT NULL,
    "photoPermis" TEXT NOT NULL,
    "matriculeVehicule" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentsConducteur_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentsConducteur" ADD CONSTRAINT "DocumentsConducteur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
