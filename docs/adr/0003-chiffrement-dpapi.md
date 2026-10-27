# 0003 — Codes chiffrés par Windows (DPAPI)

## Contexte
Le mot de passe OBS, le Client Secret Discord et le jeton Discord sont enregistrés sur le PC. Ils ne doivent pas pouvoir être récupérés en copiant un fichier.

## Décision
Chiffrement avec `safeStorage` d'Electron, qui utilise DPAPI sous Windows (préfixe `dpapi:` dans les fichiers). Les codes ne sont jamais mis dans un espace exporté ni envoyés à l'écran. Les anciens fichiers en clair sont rechiffrés au démarrage.

## Conséquences
- Avantages : seule la session Windows de l'utilisateur, sur ce PC, peut relire les codes ; rien à retenir pour lui.
- Inconvénients : une sauvegarde restaurée sur un autre PC ou un autre compte perd ces codes (il faut les retaper).
