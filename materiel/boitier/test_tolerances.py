"""Pièce de test des tolérances du boîtier (à imprimer avant le corps et la façade).
Fabrique test-tolerances.stl : 3 petites pièces posées sur le même plateau, chacune dans le sens du vrai boîtier.
  A · morceau de corps : paroi avec le creux et la rainure des clips, logement de patte + trou d'insert, 2 trous de pions
  B · morceau de façade : rebord intérieur + 1 bourrelet (clip), poches de la languette et de la tête de vis
  C · languette à 2 pions (comme sous la capsule USB-C)
+ 1 vraie patte (même forme que The-Deck-4-pattes.stl).
Les cotes sont celles de model.py : si on les change là-bas, les reporter ici.
Lancer : python3 test_tolerances.py <dossier>
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshlib import extrude, rrect, rect, circle, poly, box, tube, xform, rot_y, check_closed, write_stl

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)

# ---- cotes reprises de model.py ----
TB, SD, FT = 1.6, 11.6, 3.0                 # fond, profondeur du corps, épaisseur de la façade
LIP_T, LIP_H, LIP_GAP, CL = 0.85, 2.9, 0.2, 0.15
CLR = 0.4                                   # jeu de l'écran dans son logement
REC = LIP_GAP + LIP_T + CL - CLR            # creux de la paroi pour le rebord (0,8 mm)
BEAD, BEAD_L = 0.45, 16.0
G_D = BEAD + 0.15
Z_R = SD - LIP_H - 0.1
Z_G0, Z_G1 = SD - 2.6, SD - 2.0
WALL = 3.0                                  # paroi du haut et du bas (la plus fine)
INSERT_D, SCREW_D = 4.2, 3.4
PAT_H, PAT_T = 1.7, 1.0                     # bloc de la patte, languette
PIN_D, PIN_H, PIN_HOLE = 3.0, 1.3, 3.4

# repère A/B : x le long de la paroi, y = 0 au bord du logement de l'écran (y > 0 : paroi, y < 0 : côté vitre)
L = 40.0                                    # longueur du morceau de paroi
XB0, XB1 = 12.0, 12.0 + BEAD_L               # bourrelet
# patte : formes du coin haut-droit du vrai boîtier, décalées de (-36, -40)
PB = (47.3, 53.4, 0.5, 8.8)                  # bloc (x0, x1, y0, y1), rayon 3,0
PL = (43.29, 53.0, 7.09, 8.79)               # languette, rayon 0,8
SCREW = (50.54, 3.49)


def rr(b, r, g=0.0):
    x0, x1, y0, y1 = b[0] - g, b[1] + g, b[2] - g, b[3] + g
    return rrect(x1 - x0, y1 - y0, r + g, (x0 + x1) / 2, (y0 + y1) / 2)


# ======== A · morceau de corps (imprimé fond sur le plateau) ========
A = []
A.append(extrude(rect(L + 22.0, 16.0, (L + 22.0) / 2 - 1.0, -4.0), [circle(PIN_HOLE / 2, 10.0, -7.5, 32), circle(PIN_HOLE / 2, 22.0, -7.5, 32)], 0.0, TB))
# paroi de 3 mm : pleine en bas, creusée de REC au-dessus de Z_R, rainure des clips entre Z_G0 et Z_G1
A.append(box(-1.0, L, 0.0, WALL, TB - 0.2, Z_R))
A.append(box(-1.0, L, REC, WALL, Z_R, Z_G0))
groove = poly([(-1.0, REC), (XB0 - 0.5, REC), (XB0 - 0.5, REC + G_D), (XB1 + 0.5, REC + G_D), (XB1 + 0.5, REC), (L, REC), (L, WALL), (-1.0, WALL)])
A.append(extrude(groove, [], Z_G0, Z_G1))
A.append(box(-1.0, L, REC, WALL, Z_G1, SD))
# bloc de patte (comme la paroi des côtés) : logement de 1,7 mm + trou d'insert M3
A.append(extrude(rect(20.0, 12.0, 50.0, 4.5), [circle(INSERT_D / 2, *SCREW, 40)], TB - 0.2, SD - PAT_H))
A.append(extrude(rect(20.0, 12.0, 50.0, 4.5), [rr(PB, 3.0, 0.2)], SD - PAT_H, SD))

# ======== B · morceau de façade (repère du corps, z de SD à SD + FT ; imprimé face avant sur le plateau) ========
B = []
heads = [circle(2.95, *SCREW, 40)]
B.append(extrude(rect(L + 1.0, 9.0, (L - 1.0) / 2, -1.5), [], SD, SD + FT))
B.append(extrude(rect(20.0, 12.0, 50.0, 4.5), [rr(PL, 0.8, 0.3)] + heads, SD, SD + PAT_T + 0.1))
B.append(extrude(rect(20.0, 12.0, 50.0, 4.5), heads, SD + PAT_T + 0.1, SD + 2.4))
B.append(extrude(rect(20.0, 12.0, 50.0, 4.5), [], SD + 2.4, SD + FT))
y_in, y_out = -LIP_GAP, -LIP_GAP + LIP_T     # rebord intérieur (0,2 mm de la vitre, 0,15 mm de la paroi creusée)
B.append(box(CL, L - CL, y_in, y_out, SD - LIP_H, SD))
B.append(box(XB0, XB1, y_out, y_out + BEAD, Z_G0 + 0.15, Z_G1 - 0.15))
B.append(box(XB0, XB1, y_out, y_out + BEAD / 2, Z_G0 + 0.05, Z_G0 + 0.15))
B.append(box(XB0, XB1, y_out, y_out + BEAD / 2, Z_G1 - 0.15, Z_G1 - 0.05))
B = [xform(t, rot_y(180), [0, 0, SD + FT]) for t in B]

# ======== C · languette à 2 pions (debout, pions couchés comme sous la capsule) ========
C = [box(0.0, 32.0, 0.0, 2.4, 0.0, 10.0)]
for x in (10.0, 22.0):                       # même écart que les 2 trous de A
    C.append(xform(tube(PIN_D / 2, 0, -0.3, PIN_H - 0.3, x, 5.0, 32), np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)))
    C.append(xform(tube(PIN_D / 2 - 0.3, 0, PIN_H - 0.31, PIN_H, x, 5.0, 32), np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)))

# ======== une vraie patte (debout sur son bout extérieur) ========
P = [extrude(rr(PB, 3.0), [circle(SCREW_D / 2, *SCREW, 32)], SD - PAT_H, SD), extrude(rr(PL, 0.8), [], SD - 0.02, SD + PAT_T)]
P = [xform(t, rot_y(90)) for t in P]

# ---- mise en place sur le plateau ----
def bb(ts):
    v = np.concatenate(ts).reshape(-1, 3); return v.min(0), v.max(0)


def put(ts, x, y):
    mn, _ = bb(ts); return [t + np.array([x - mn[0], y - mn[1], -mn[2]]) for t in ts]


A = put(A, 0.0, 0.0)
_, amx = bb(A)
B = put(B, 0.0, amx[1] + 6.0)
_, bmx = bb(B)
C = put(C, 0.0, bmx[1] + 6.0)
_, cmx = bb(C)
P = put(P, cmx[0] + 8.0, bmx[1] + 6.0)
solids = A + B + C + P
for i, t in enumerate(solids):
    bad, vol = check_closed(t, 'test')
    assert bad == 0 and vol > 0, f'pièce {i} non fermée'
allv = np.concatenate(solids)
mn, mx = bb(solids)
allv = allv - np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, 0])      # centré sur le plateau
write_stl(os.path.join(OUT, 'The-Deck-0-test-tolerances.stl'), allv)
print('test-tolerances : taille', np.round(mx - mn, 1))
