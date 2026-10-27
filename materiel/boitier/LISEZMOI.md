# Boîtier 3D

- `model.py` fabrique les pièces (cadre avant gravé « THE DECK » + logo, coque, pied à lamelles) en STL : `python3 model.py <dossier-de-sortie>`.
- `meshlib.py` : petits outils de maillage (extrusions, triangulation) utilisés par `model.py`.
- Besoins : Python 3, numpy, scipy, matplotlib, et la police Inter Display Bold (chemin dans `model.py`, ligne `FontProperties`).
- Cotes de l'écran : Waveshare ESP32-P4-WIFI6-Touch-LCD-7B. Le boîtier définitif attend les photos et mesures de la carte.

## À acheter

| Pièce | Nombre | Référence retenue |
|---|---|---|
| Patins silicone adhésifs transparents, ronds 8 mm (épaisseur 2 mm conseillée) | 8 | Tenare, lot de 100 — https://www.amazon.fr/Amortisseurs-Adh%C3%A9sifs-Transparents-Amortissement-dArmoires/dp/B093SMVP38 (vérifier l'épaisseur : le logement fait Ø 8,4 × 1 mm) |
| Inserts laiton à chaud M3 (longueur 4 à 6 mm) | 8 | ✅ déjà en stock — 4 pour le cadre, 4 pour le pied |
| Vis M3 cruciformes à tête plate (cylindrique), tête Ø 5,6 mm max × 2,2 mm max | 4 (cadre) + 4 (pied) | ✅ déjà en stock — cadre : M3 × 8 mm (la tête s'encastre à fleur dans un logement Ø 6 × 2,2 mm) ; pied : M3 × 10 mm |
| Écran Waveshare ESP32-P4-WIFI6-Touch-LCD-7B (7 pouces, 1024 × 600) | 1 | retenu |
| Câble USB-C magnétique orange **avec transfert de données** (480 Mbit/s mini), tête qui reste dans la prise | 1 | retenu : AUFU 240 W magnétique 16 broches, 1,8 m, données — https://www.amazon.fr/AUFU-Magn%C3%A9tique-Transfert-Donn%C3%A9es-Samsung/dp/B0D962HKSB (vérifier la couleur à la commande ; mesurer la tête aimantée pour ajuster l'ouverture USB du boîtier) |
| Adaptateur USB-A → USB-C | 0 ou 1 | seulement si le PC n'a pas de prise USB-C libre |
| Filament : gris (coque et cadre), orange (pied) | — | PETG conseillé pour le cadre (clips plus souples) |

## Option de déport USB-C (pas dans le boîtier par défaut)

Le câble se branche au dos, dans une petite capsule arrondie collée entre la 1re et la 2e nervure du pied, au lieu du côté gauche. Une rallonge plate (nappe) relie la prise de la carte à une prise femelle logée dans la capsule.

- Fabriquer les pièces avec l'option : `DECK_USB_ARRIERE=1 python3 model.py <dossier>` → en plus des 3 pièces, `capsule.stl` (imprimée à plat sur sa base, sans support), et une fente dans le fond de la coque pour la nappe.
- Sans la variable, le boîtier reste celui par défaut (prise sur le côté).
- Le creux de la capsule (9,6 mm de large) sera ajusté à la petite carte de la prise femelle une fois la nappe reçue et mesurée.

| Pièce | Nombre | Référence proposée |
|---|---|---|
| Nappe USB-C plate, **mâle coudé à 90° → femelle droite**, 5 cm | 1 | https://www.amazon.fr/Ruban-connecteur-Femelle-synchronisation-Chargement/dp/B07Q432F3H (même modèle aussi ici, sans doute avec le coude dans l'autre sens : https://www.amazon.fr/Ruban-connecteur-Femelle-synchronisation-Chargement/dp/B07QF4KX1R — comparer les photos avec la carte) |
| Variante plus longue : rallonge plate USB-C **mâle coudé 90° → femelle**, 15 cm, lot de 2 | 0 ou 1 | https://www.amazon.fr/Rallonge-Femelle-Donn%C3%A9es-Flexible-Appareils/dp/B0GCZPVYH6 |
| Colle gel pour pièces imprimées (PETG) | 1 | https://www.amazon.fr/instantan%C3%A9e-impression-anti-dess%C3%A8chement-KRAFTPROTZ-%C3%A9tanche/dp/B0CBSKGFLM |
| Câble AUFU magnétique | — | le même que pour le boîtier normal : sa tête aimantée se met dans la prise de la capsule |
