# Boîtier 3D

- `model.py` fabrique les pièces (façade gravée « THE DECK » + logo, clipsée sans vis ; coque ; 4 pattes qui tiennent l'écran ; pied à lamelles) en STL : `python3 model.py <dossier-de-sortie>`.
- Façade clipsée (validée le 28/10/2026) : 12 clips intérieurs (4 en haut, 4 en bas, 2 de chaque côté), ouverture par l'encoche du bas. L'écran est tenu par 4 pattes vissées dans les parois des côtés, cachées sous la façade. Ancienne façade vissée : `DECK_FACADE_CLIPS=0`.
- `meshlib.py` : petits outils de maillage (extrusions, triangulation) utilisés par `model.py`.
- Besoins : Python 3, numpy, scipy, matplotlib, et la police Inter Display Bold (chemin dans `model.py`, ligne `FontProperties`).
- Cotes de l'écran : Waveshare ESP32-P4-WIFI6-Touch-LCD-7B. Le boîtier définitif attend les photos et mesures de la carte.

## À acheter

| Pièce | Nombre | Référence retenue |
|---|---|---|
| Patins silicone adhésifs transparents, ronds 8 mm (épaisseur 2 mm conseillée) | 8 | Tenare, lot de 100 — https://www.amazon.fr/Amortisseurs-Adh%C3%A9sifs-Transparents-Amortissement-dArmoires/dp/B093SMVP38 (vérifier l'épaisseur : le logement fait Ø 8,4 × 1 mm) |
| Inserts laiton à chaud M3 (longueur 4 à 6 mm) | 8 | ✅ déjà en stock — 4 pour les pattes de l'écran, 4 pour le pied |
| Vis M3 cruciformes à tête plate (cylindrique), tête Ø 5,6 mm max × 2,2 mm max | 4 (pattes) + 4 (pied) | ✅ déjà en stock — pattes : M3 × 8 mm (la tête se loge dans une poche sous la façade) ; pied : M3 × 10 mm |
| Écran Waveshare ESP32-P4-WIFI6-Touch-LCD-7B (7 pouces, 1024 × 600) | 1 | retenu |
| Câble USB-C magnétique orange **avec transfert de données** (480 Mbit/s mini), tête qui reste dans la prise | 1 | retenu : AUFU 240 W magnétique 16 broches, 1,8 m, données — https://www.amazon.fr/AUFU-Magn%C3%A9tique-Transfert-Donn%C3%A9es-Samsung/dp/B0D962HKSB (vérifier la couleur à la commande ; la tête aimantée reste dans la prise de la capsule, au dos) |
| Adaptateur USB-A → USB-C | 0 ou 1 | seulement si le PC n'a pas de prise USB-C libre |
| Filament : gris (coque, façade, pattes), orange (pied) | — | PETG conseillé pour la façade (clips plus souples) et les pattes |

## Déport USB-C (validé le 28/10/2026)

Le câble se branche au dos, dans une petite capsule arrondie collée entre la 1re et la 2e nervure du pied. Le côté gauche est entièrement fermé : la fenêtre USB et celle du bouton marche/arrêt sont rebouchées (le bouton reste sur marche ; il reste dedans une niche pour la fiche coudée de la nappe). Pour rouvrir la fenêtre du bouton : `DECK_BOUTON_OUVERT=1`. Une nappe USB-C relie la prise de la carte à la prise femelle logée dans la capsule.

- `python3 model.py <dossier>` fabrique aussi `capsule.stl` (imprimée à plat sur sa base, sans support) et la fente pour la nappe dans le fond de la coque. Ancienne prise sur le côté : `DECK_USB_ARRIERE=0`.
- Le creux de la capsule (9,6 mm de large) et la niche du côté seront ajustés une fois la nappe et l'écran reçus et mesurés.

| Pièce | Nombre | Référence |
|---|---|---|
| Nappe USB-C plate (type drone FPV), **mâle coudé à 90° → femelle droite**, 5 cm | 1 | **retenue** : https://www.amazon.fr/Ruban-connecteur-Femelle-synchronisation-Chargement/dp/B07Q432F3H (le sens du coude n'a pas d'importance : la fiche USB-C se retourne ; à la réception, mesurer la petite carte du bout femelle pour ajuster le creux de la capsule) |
| Colle gel pour pièces imprimées (PETG) | 1 | https://www.amazon.fr/instantan%C3%A9e-impression-anti-dess%C3%A8chement-KRAFTPROTZ-%C3%A9tanche/dp/B0CBSKGFLM |
| Câble AUFU magnétique | — | celui de la liste ci-dessus : sa tête aimantée se met dans la prise de la capsule |
