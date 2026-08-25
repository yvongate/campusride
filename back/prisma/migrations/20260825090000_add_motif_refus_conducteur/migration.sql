-- Motif de refus d'un dossier conducteur. Auparavant le refus etait muet :
-- le demandeur recevait "ta demande n'a pas ete acceptee" sans savoir quoi
-- corriger, et resoumettait donc souvent le meme dossier defaillant.
-- Nullable : les dossiers valides ou en attente n'en ont pas, et les refus
-- anterieurs a cette migration non plus.
ALTER TABLE "DocumentsConducteur" ADD COLUMN "motifRefus" TEXT;
