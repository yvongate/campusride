-- Canal de contact utilisateur -> administration. Necessaire car la
-- suspension automatique (§8.2) n'avait jusqu'ici aucun recours : un compte
-- suspendu a tort restait bloque trois semaines sans pouvoir joindre personne.
CREATE TABLE "MessageSupport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "reponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repondueLe" TIMESTAMP(3),
    CONSTRAINT "MessageSupport_pkey" PRIMARY KEY ("id")
);

-- Le back-office liste d'abord les messages ouverts, les plus recents en tete.
CREATE INDEX "MessageSupport_statut_createdAt_idx" ON "MessageSupport"("statut", "createdAt");

ALTER TABLE "MessageSupport" ADD CONSTRAINT "MessageSupport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
