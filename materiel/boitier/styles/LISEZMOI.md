# Styles de boîtier (maquettes de forme)

Pistes de style essayées le 28/10/2026, à côté du boîtier actuel (`../model.py`). Ce sont des maquettes de forme : l'écran garde la coque et le cadre actuels, seul le support change. Le boîtier actuel reste le boîtier retenu.

Vue 3D pour comparer : https://claude.ai/artifact/Awy3cfXCZeZ4oRGC6oMajF

| Style | Fichier | Statut |
|---|---|---|
| **Colonne** : colonne droite sur socle rectangulaire, charnière en haut (inclinaison réglable, comme un écran d'ordinateur) | `styles3.py` (`colonne`) | **mis de côté (gardé)** |
| Flottant : écran sur un bras incliné, socle rond | `styles2.py` (`flottant`) | a plu |
| Galet : écran fin contre un galet arrondi | `styles2.py` (`galet`) | a plu |
| Col de cygne, Fourche | `styles3.py` | proposés |
| Étrier | `styles2.py` | écarté |
| Monolithe, Rouleau, Cockpit | `styles.py` | écartés |

Fabriquer les maquettes (fichiers `.json` pour la vue 3D) :

```
python3 styles3.py <dossier>   # col de cygne, colonne, fourche
python3 styles2.py <dossier>   # flottant, étrier, galet
python3 styles.py <dossier>    # monolithe, rouleau, cockpit
```

Pour passer un style en boîtier imprimable, il faudra : dessiner la vraie charnière (Colonne : vis M3 + molette), les points d'attache au dos de la coque (inserts M3), et sortir les STL comme `model.py`.
