# 0006 — Claude relié au stock par un connecteur local (MCP)

## Contexte
L'utilisateur veut que Claude connaisse son stock d'électronique et le mette à jour à la fin d'un projet, mais jamais sans son accord. Il n'a ni micro ni haut-parleur : il écrit à Claude depuis l'application Claude de son PC.

## Décision
Le logiciel fournit un petit connecteur MCP local (`src/lien-claude.js`) que l'application Claude lance elle-même (bouton « Relier Claude » qui ajoute une entrée à `claude_desktop_config.json`). Le connecteur n'a que trois outils : lire le stock, proposer un changement, demander l'état d'une proposition. Il parle au logiciel par un tuyau Windows local. Une proposition ne s'applique qu'après VALIDER sur l'écran (ou dans le logiciel), avec historique et Annuler.

## Conséquences
- Rien à héberger sur internet, pas de compte ni de clé : tout reste sur le PC.
- Claude ne peut ni modifier le stock seul, ni voir les réglages ou les codes secrets.
- Marche seulement avec l'application Claude installée sur le même PC, et The Deck ouvert ; pas depuis le téléphone ni claude.ai dans un navigateur.
- La version Portable de The Deck ne convient pas (son dossier change à chaque lancement).
