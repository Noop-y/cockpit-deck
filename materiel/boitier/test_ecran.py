"""Pièce de test « écran » (13/11/2026) : vérifie que l'écran mesuré entre dans le corps avant d'imprimer le corps entier.
Un fond ajouré (bande de 9 mm) avec les 4 godets des entretoises, et une paroi fine tout autour du logement de l'écran,
à la vraie profondeur du corps, avec les fenêtres du côté gauche (prise USB, USB-A, interrupteur) laissées ouvertes.
On pose l'écran vitre vers le haut : les entretoises entrent dans les godets, la vitre doit arriver juste au ras du haut
de la paroi, et les prises doivent tomber au milieu des fenêtres.
Les cotes viennent de model.py (lancé en arrière-plan).
Lancer : python3 test_ecran.py <dossier>
"""
import sys, os, runpy, tempfile, io, contextlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from meshlib import extrude, rrect, rect, circle, box, tube, check_closed, write_stl

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
    old = sys.argv
    sys.argv = ['model.py', tmp]
    M = runpy.run_path(os.path.join(HERE, 'model.py'))
    sys.argv = old

a_, b_, SD, TB = M['a_'], M['b_'], M['SD'], M['TB']
H_ENTR, ENTR, GD, GH = M['H_ENTR'], M['ENTR'], M['GODET_D'], M['GODET_H']
(ub, uw), (bb, bw) = M['USB_CUT'], M['BTN_CUT']
W = 1.2                                        # épaisseur de la paroi de test
FL = 1.6                                       # épaisseur du fond ajouré

parts = []
# fond ajouré : de la paroi jusqu'à 9 mm à l'intérieur de la carte, avec une croix au milieu pour la rigidité
xo, yo = a_ + W, b_ + W
parts.append(extrude(rect(2 * xo, 2 * yo), [rect(146.0, 79.0)], 0.0, FL))
parts.append(box(-73.5, 73.5, -2.0, 2.0, 0.0, FL))
parts.append(box(-2.0, 2.0, -39.5, 39.5, 0.0, FL))
# godets, comme dans le corps
for x, y in ENTR:
    parts.append(extrude(circle(GD / 2 + 1.6, x, y, 48), [], 0.0, SD - H_ENTR))
    parts.append(tube(GD / 2 + 1.6, GD / 2, SD - H_ENTR, SD - H_ENTR + GH, x, y))
# paroi : haut, bas, droite en entier ; gauche coupée aux fenêtres (prise USB + USB-A, interrupteur)
parts.append(box(-xo, xo, b_, yo, 0.0, SD))
parts.append(box(-xo, xo, -yo, -b_, 0.0, SD))
parts.append(box(a_, xo, -b_, b_, 0.0, SD))
cuts = sorted([(ub - uw / 2, ub + uw / 2), (bb - bw / 2, bb + bw / 2)])
y = -b_
for c0, c1 in cuts:
    parts.append(box(-xo, -a_, y, c0, 0.0, SD))
    y = c1
parts.append(box(-xo, -a_, y, b_, 0.0, SD))
v = np.concatenate(parts)
for i, p in enumerate(parts):
    bad, vol = check_closed(p, 'test-ecran')
    assert bad == 0 and vol > 0, f'morceau {i} non fermé'
write_stl(os.path.join(OUT, 'The-Deck-0f-test-ecran.stl'), v)
q = v.reshape(-1, 3)
print('test-ecran : taille', np.round(q.max(0) - q.min(0), 1), '— profondeur', SD, '— logement', round(2 * a_, 2), '×', round(2 * b_, 2))
