-- CreateTable
CREATE TABLE "VerificationIdentite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cni" TEXT NOT NULL,
    "selfie" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationIdentite_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VerificationIdentite" ADD CONSTRAINT "VerificationIdentite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
