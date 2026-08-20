-- Le prix d'un Trajet devient une cotisation FIXE par personne, au lieu d'un
-- prix total redivise a chaque reservation/annulation. Motifs (voir cahier
-- des charges §6) :
--   * le 1er passager a ouvrir un trajet voyait "prixTotal / 1", donc le prix
--     plein -- personne ne reservait jamais en premier ;
--   * en Mode A, une annulation faisait payer aux passagers restants plus que
--     la cotisation qu'ils avaient acceptee.
-- Conversion des lignes existantes : cotisation = prixTotal reparti sur les
-- places annoncees, arrondi a la dizaine superieure (meme regle que l'ancien
-- computePrixParPersonne).
ALTER TABLE "Trajet" ADD COLUMN "cotisation" DOUBLE PRECISION;

UPDATE "Trajet"
SET "cotisation" = CEIL(("prixTotal" / GREATEST("places", 1)) / 10) * 10;

ALTER TABLE "Trajet" ALTER COLUMN "cotisation" SET NOT NULL;
ALTER TABLE "Trajet" DROP COLUMN "prixTotal";
