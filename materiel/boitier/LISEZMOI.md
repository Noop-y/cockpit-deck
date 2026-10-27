# Boîtier 3D

- `model.py` fabrique les pièces (cadre avant gravé « THE DECK » + logo, coque, pied à lamelles) en STL : `python3 model.py <dossier-de-sortie>`.
- `meshlib.py` : petits outils de maillage (extrusions, triangulation) utilisés par `model.py`.
- Besoins : Python 3, numpy, scipy, matplotlib, et la police Inter Display Bold (chemin dans `model.py`, ligne `FontProperties`).
- Cotes de l'écran : Waveshare ESP32-P4-WIFI6-Touch-LCD-7B. Le boîtier définitif attend les photos et mesures de la carte.

## À acheter

| Pièce | Nombre | Référence retenue |
|---|---|---|
| Patins silicone adhésifs transparents, ronds 8 mm (épaisseur 2 mm conseillée) | 8 | Tenare, lot de 100 — https://www.amazon.fr/Amortisseurs-Adh%C3%A9sifs-Transparents-Amortissement-dArmoires/dp/B093SMVP38 (vérifier l'épaisseur : le logement fait Ø 8,4 × 1 mm) |
| Inserts laiton à chaud M3 (longueur 4 à 6 mm) | 8 | — |
| Vis M3 | 8 | longueur selon la version du cadre |
