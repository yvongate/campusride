-- "note" reste la colonne publique (inchangee), mais elle est desormais
-- toujours derivee de noteBrute - penaliteCumulee (voir
-- back/src/common/utils/note.ts) au lieu d'etre ecrite directement par deux
-- mecanismes concurrents (recalcul de moyenne des avis, et penalites
-- absence/annulation tardive) qui s'ecrasaient l'un l'autre.
ALTER TABLE "Utilisateur" ADD COLUMN "noteBrute" DOUBLE PRECISION;
ALTER TABLE "Utilisateur" ADD COLUMN "nombreNotations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Utilisateur" ADD COLUMN "penaliteCumulee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Retro-remplissage : les comptes ayant deja une "note" (ecrite par
-- l'ancien mecanisme, avis ou penalite confondus) recuperent cette valeur
-- comme noteBrute de depart, penaliteCumulee restant a 0 -- pas d'historique
-- pour distinguer retroactivement ce qui relevait de l'un ou l'autre.
UPDATE "Utilisateur" SET "noteBrute" = "note" WHERE "note" IS NOT NULL;

-- Retro-remplissage du compte d'avis a partir des Notation existantes.
UPDATE "Utilisateur" u
SET "nombreNotations" = sub.cnt
FROM (
  SELECT "destinataireId", COUNT(*) AS cnt
  FROM "Notation"
  GROUP BY "destinataireId"
) sub
WHERE u.id = sub."destinataireId";
