# Boîtier 3D

- `model.py` fabrique les pièces (cadre avant gravé « THE DECK » + logo, coque, pied à lamelles) en STL : `python3 model.py <dossier-de-sortie>`.
- `meshlib.py` : petits outils de maillage (extrusions, triangulation) utilisés par `model.py`.
- Besoins : Python 3, numpy, scipy, matplotlib, et la police Inter Display Bold (chemin dans `model.py`, ligne `FontProperties`).
- Cotes de l'écran : Waveshare ESP32-P4-WIFI6-Touch-LCD-7B. Le boîtier définitif attend les photos et mesures de la carte.
