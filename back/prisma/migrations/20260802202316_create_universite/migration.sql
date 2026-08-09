-- CreateTable
CREATE TABLE "Universite" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Universite_pkey" PRIMARY KEY ("id")
);
