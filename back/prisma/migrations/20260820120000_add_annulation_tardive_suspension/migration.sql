-- Bannissement temporaire reel pour les passagers qui annulent une
-- reservation a moins de 1h15 du depart, au lieu de la simple baisse de note
-- deja utilisee pour un conducteur en retard (voir TrajetsService).
-- annulationsTardives compte les annulations tardives du CYCLE en cours : il
-- est remis a zero au moment ou la suspension tombe (2e occurrence), un
-- nouveau cycle de deux essais recommence ensuite -- ce n'est pas un compteur
-- cumulatif a vie. suspenduJusqua bride l'acces tant qu'elle est dans le
-- futur : le compte peut toujours se connecter et ecrire au support, mais
-- toutes les autres routes lui repondent 403 (voir JwtAuthGuard).
ALTER TABLE "Utilisateur" ADD COLUMN "annulationsTardives" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Utilisateur" ADD COLUMN "suspenduJusqua" TIMESTAMP(3);
