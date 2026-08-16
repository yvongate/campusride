-- L'universite est desormais rattachee au profil (renseignee une fois,
-- reutilisee comme destination par defaut sur Accueil/CreerDemande) plutot
-- que choisie a chaque ecran -- voir back/src/users/users.service.ts.
ALTER TABLE "Utilisateur" ADD COLUMN "universiteId" TEXT;

ALTER TABLE "Utilisateur"
  ADD CONSTRAINT "Utilisateur_universiteId_fkey"
  FOREIGN KEY ("universiteId") REFERENCES "Universite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Utilisateur_universiteId_idx" ON "Utilisateur"("universiteId");
