-- Tokens de notification push (Expo). Table dediee plutot qu'un champ sur
-- Utilisateur : un compte peut avoir plusieurs appareils, et le token doit
-- pouvoir etre supprime a la deconnexion (sinon l'utilisateur suivant du
-- meme telephone recevrait les notifications du compte precedent).
CREATE TABLE "AppareilPush" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plateforme" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernierUsage" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppareilPush_pkey" PRIMARY KEY ("id")
);

-- Unique : un appareil n'existe qu'une fois. S'il change de compte, la ligne
-- bascule de userId au lieu d'etre dupliquee.
CREATE UNIQUE INDEX "AppareilPush_token_key" ON "AppareilPush"("token");

-- Envoi groupe : on liste les tokens de N destinataires a chaque notification.
CREATE INDEX "AppareilPush_userId_idx" ON "AppareilPush"("userId");

ALTER TABLE "AppareilPush" ADD CONSTRAINT "AppareilPush_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
