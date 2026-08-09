-- CreateTable
CREATE TABLE "Notation" (
    "id" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "noteurId" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "etoiles" INTEGER NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notation_trajetId_noteurId_destinataireId_key" ON "Notation"("trajetId", "noteurId", "destinataireId");

-- AddForeignKey
ALTER TABLE "Notation" ADD CONSTRAINT "Notation_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notation" ADD CONSTRAINT "Notation_noteurId_fkey" FOREIGN KEY ("noteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notation" ADD CONSTRAINT "Notation_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
