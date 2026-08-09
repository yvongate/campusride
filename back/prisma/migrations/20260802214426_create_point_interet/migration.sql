-- CreateTable
CREATE TABLE "PointInteret" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quartierId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointInteret_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PointInteret" ADD CONSTRAINT "PointInteret_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
