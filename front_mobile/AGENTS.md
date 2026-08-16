# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

# L'app ne se lance pas — diagnostiquer AVANT de toucher au code

Trois symptômes très différents sont souvent confondus. **Toujours demander/observer
le symptôme exact avant de proposer un correctif** — se tromper de catégorie fait
perdre beaucoup de temps (c'est arrivé plusieurs fois).

| Symptôme observé | Ce que c'est | Où chercher |
|---|---|---|
| Timeout, QR scanné mais rien ne charge, « The request timed out » | Le téléphone n'atteint pas **Metro** sur le PC. Le JS n'arrive jamais. | Réseau local (voir §1) |
| L'app se charge, mais reste bloquée sur un écran | Bug applicatif (navigation / état) | Code mobile |
| L'app marche, mais les appels API échouent | Backend / Render | `back/`, logs Render |

Rien de tout ça ne se règle par un `git push` (voir §2).

## §1 — Timeout : connexion téléphone ↔ Metro

`front_mobile/.env` contient `EXPO_PACKAGER_PROXY_URL`, une **IP figée en dur**.
Elle est nécessaire (le PC a plusieurs cartes réseau, sinon Metro annonce
`exp://127.0.0.1:8081`, injoignable depuis le téléphone), mais elle est fragile :

1. **L'IP change avec le réseau.** Vérifier qu'elle correspond à l'IP Wi-Fi
   actuelle : `ipconfig` → « Carte réseau sans fil Wi-Fi » → « Adresse IPv4 ».
   Autre Wi-Fi, hotspot, ou simple renouvellement DHCP = IP différente = timeout.
2. **Toujours inclure le port `:8081`.** Sans lui, le téléphone tente le port 80
   et fait un timeout.
3. **Si le port 8081 est occupé**, Expo bascule automatiquement sur 8082 — l'IP
   figée pointe alors vers un port où rien n'écoute. Souvent un ancien processus
   Expo orphelin : le terminer, puis relancer.
4. **Toujours relancer avec `npx expo start -c`** après une modif du `.env`
   (sans `-c`, l'ancienne valeur reste en cache).

Contrôle à faire au lancement — la ligne doit afficher exactement :

```
› Metro waiting on exp://<IP-Wi-Fi-actuelle>:8081
```

Si on y lit `127.0.0.1`, `:8082`, ou une autre IP (ex. `192.168.20.1`, la carte
Ethernet virtuelle) → c'est la cause, ne pas chercher ailleurs.

## §2 — Ce qu'un `git push` change (et ne change pas)

- **Expo Go lit les fichiers sur le disque**, servis par Metro. Committer ou
  pousser ne change **rien** à ce qui tourne sur le téléphone. Ne jamais demander
  de commit/push pour « appliquer » un correctif mobile — il suffit de relancer.
- **`front_mobile/.env` est gitignoré.** Un push ne le corrigera jamais : c'est de
  la config locale à la machine.
- Seuls les changements dans **`back/`** déclenchent un redéploiement Render.
- Pour vérifier que Render tourne bien le code attendu, sans dashboard : une route
  existante renvoie **401** sans token, une route absente renvoie **404**. Et
  `POST /auth/otp/request` renvoie 200 + un code si la base répond.

# Règle : ne jamais conditionner l'entrée dans l'app à une donnée optionnelle

Au démarrage à froid avec un token valide → aller **toujours** sur `MainTabs`.

`CompleterProfil` (saisie du nom) est un passage **unique**, juste après l'OTP, et
son bouton « Passer pour l'instant » **ne persiste rien**. L'avoir placé sur le
chemin du démarrage (`App.tsx`) rendait l'accueil inatteignable : à chaque
lancement, token valide + `nom` toujours `null` → retour sur cet écran, en boucle.

Généralisation : **tout écran « skippable » placé sur le chemin de démarrage
devient une barrière permanente**, puisque le fait de l'avoir sauté n'est pas
mémorisé. Un tel écran appartient au flux de première connexion, pas au cold start.
