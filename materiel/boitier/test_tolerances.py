"""Pièce de test des tolérances du boîtier (à imprimer avant le corps et la façade).
Version 3 (30/10/2026) : clips encore plus gros (parois haut/bas de 4 mm), cadre de maintien à la place des pattes.
  A · morceau de corps : paroi du haut (3 mm) avec son clip, paroi des côtés (8 mm) avec son gros clip,
      logement d'une oreille du cadre de maintien + trou d'insert, 2 trous de pions
  B · morceau de façade : les deux rebords avec leurs bourrelets, poche du cadre et de la tête de vis
  C · languette à 2 pions (comme sous la capsule USB-C)
  D · coin du cadre de maintien (oreille + bout du cadre)
Les cotes sont celles de model.py : si on les change là-bas, les reporter ici.
Lancer : python3 test_tolerances.py <dossier>
"""
import sys, os, json, base64
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshlib import extrude, rrect, rect, circle, poly, box, tube, xform, rot_y, check_closed, write_stl

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)

# ---- cotes reprises de model.py ----
TB, SD, FT, FT_LIP = 1.6, 11.6, 3.0, 1.6
LIP_GAP, CL, CLR = 0.2, 0.15, 0.4
LIP_H = 4.0
Z_R, Z_G0, Z_G1 = SD - LIP_H - 0.1, SD - 3.95, SD - 1.6
CLIPS = {   # type : (épaisseur du rebord, saillie du bourrelet, épaisseur de la paroi)
    'haut': (1.3, 0.8, 4.0),
    'cote': (2.0, 1.3, 8.0),
}
INSERT_D, SCREW_D = 4.2, 3.4
PAT_H, RING_T = 1.7, 1.2
PIN_D, PIN_H, PIN_HOLE = 3.0, 1.3, 3.4
# oreille du cadre de maintien : forme du coin haut-droit du vrai boîtier, décalée de (-36, -40)
PB = (47.30, 53.34, 0.80, 8.785)
SCREW = (50.14, 3.99)
STRIP_X = (42.99, 45.84)                    # bout du cadre posé sur la vitre (le long du côté)


def bead_profile(d0, depth, z0, z1):
    lead, keep = min(depth * 1.2, (z1 - z0) * 0.45), min(depth * 0.8, (z1 - z0) * 0.35)
    return poly([(d0, z0), (d0 + depth, z0 + lead), (d0 + depth, z1 - keep), (d0, z1)])


P_X = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)     # (a, b, c) -> (x = c, y = a, z = b)

# repère A/B : x le long de la paroi ; y = 0 au bord du logement de l'écran, y > 0 : paroi
SEG = {'haut': (0.0, 34.0), 'cote': (66.0, 100.0)}           # deux morceaux de paroi
A, B = [], []
A.append(extrude(rect(102.0, 24.0, 50.0, 0.0), [circle(PIN_HOLE / 2, 10.0, -8.0, 32), circle(PIN_HOLE / 2, 22.0, -8.0, 32)], 0.0, TB))
for k, (x0, x1) in SEG.items():
    lip_t, bead, wall = CLIPS[k]
    rec = LIP_GAP + lip_t + CL - CLR
    gd = bead + 0.15
    bx0, bx1 = (x0 + x1) / 2 - 12.0, (x0 + x1) / 2 + 12.0      # bourrelet de 24 mm au milieu
    A.append(box(x0, x1, 0.0, wall, TB - 0.2, Z_R))
    A.append(box(x0, x1, rec, wall, Z_R, Z_G0))
    A.append(extrude(poly([(x0, rec), (bx0 - 0.5, rec), (bx0 - 0.5, rec + gd), (bx1 + 0.5, rec + gd), (bx1 + 0.5, rec), (x1, rec), (x1, wall), (x0, wall)]), [], Z_G0, Z_G1))
    A.append(box(x0, x1, rec, wall, Z_G1, SD))
    # façade au-dessus de ce morceau : plaque + rebord + bourrelet
    B.append(box(x0 - 0.5 if x0 < 1 else 62.8, 37.2 if x1 < 50 else x1 + 0.5, -6.0, wall, SD, SD + FT))   # touche le bloc du milieu : une seule pièce
    B.append(box(x0 + CL, x1 - CL, -LIP_GAP, -LIP_GAP + lip_t, SD - LIP_H, SD))
    B.append(xform(extrude(bead_profile(-LIP_GAP + lip_t - 0.02, bead, Z_G0 + 0.1, Z_G1 - 0.1), [], bx0, bx1, maxlen=1e3), P_X))

# bloc de l'oreille (comme le haut de la paroi des côtés) : logement de 1,7 mm + trou d'insert M3
OUTL = poly([(STRIP_X[0], -4.0), (STRIP_X[1], -4.0), (STRIP_X[1], PB[2]), (PB[1], PB[2]), (PB[1], PB[3]), (STRIP_X[0], PB[3])])


def rr(b, r, g=0.0):
    x0, x1, y0, y1 = b[0] - g, b[1] + g, b[2] - g, b[3] + g
    return rrect(x1 - x0, y1 - y0, r + g, (x0 + x1) / 2, (y0 + y1) / 2)


def grown(g):
    return poly([(STRIP_X[0] - g, -4.0 - g), (STRIP_X[1] + g, -4.0 - g), (STRIP_X[1] + g, PB[2] - g), (PB[1] + g, PB[2] - g), (PB[1] + g, PB[3] + g), (STRIP_X[0] - g, PB[3] + g)])


A.append(extrude(rect(26.0, 18.0, 50.0, 2.0), [circle(INSERT_D / 2, *SCREW, 40)], TB - 0.2, SD - PAT_H))
A.append(extrude(rect(26.0, 18.0, 50.0, 2.0), [rr(PB, 3.0, 0.2)], SD - PAT_H, SD))
# façade au-dessus du bloc : poche du cadre (+0,3 mm) et poche de la tête de vis
heads = [circle(2.95, *SCREW, 40)]
B.append(extrude(rect(26.0, 18.0, 50.0, 2.0), [grown(0.3)], SD, SD + RING_T + 0.1))
B.append(extrude(rect(26.0, 18.0, 50.0, 2.0), heads, SD + RING_T + 0.1, SD + 2.4))
B.append(extrude(rect(26.0, 18.0, 50.0, 2.0), [], SD + 2.4, SD + FT))
B_ASM = list(B)
B = [xform(t, rot_y(180), [0, 0, SD + FT]) for t in B]

# ======== C · languette à 2 pions (debout, pions couchés comme sous la capsule) ========
C = [box(0.0, 32.0, 0.0, 2.4, 0.0, 10.0)]
for x in (10.0, 22.0):
    for r_, z0, z1 in ((PIN_D / 2, -0.3, PIN_H - 0.3), (PIN_D / 2 - 0.3, PIN_H - 0.31, PIN_H)):
        C.append(xform(tube(r_, 0, z0, z1, x, 5.0, 32), np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)))
C_ASM = [xform(t, np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float), [0, -13.0, 0]) for t in C]

# ======== D · coin du cadre de maintien (oreille + bout du cadre) ========
D = [extrude(OUTL, [circle(2.95, *SCREW, 32)], SD - 0.02, SD + RING_T), extrude(rr(PB, 3.0), [circle(SCREW_D / 2, *SCREW, 32)], SD - PAT_H, SD)]
D_ASM = list(D)
D = [xform(t, rot_y(180)) for t in D]                        # le cadre à plat sur le plateau
A_ASM = list(A)


# ---- mise en place sur le plateau ----
def bb(ts):
    v = np.concatenate(ts).reshape(-1, 3); return v.min(0), v.max(0)


def put(ts, x, y):
    mn, _ = bb(ts); return [t + np.array([x - mn[0], y - mn[1], -mn[2]]) for t in ts]


A = put(A, 0.0, 0.0); _, amx = bb(A)
B = put(B, 0.0, amx[1] + 6.0); _, bmx = bb(B)
C = put(C, 0.0, bmx[1] + 6.0); _, cmx = bb(C)
D = put(D, cmx[0] + 8.0, bmx[1] + 6.0)
for i, t in enumerate(A + B + C + D):
    bad, vol = check_closed(t, 'test')
    assert bad == 0 and vol > 0, f'pièce {i} non fermée'
allv = np.concatenate(A + B + C + D)
mn, mx = bb(A + B + C + D)
write_stl(os.path.join(OUT, 'The-Deck-0-test-tolerances.stl'), allv - np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, 0]))
print('test-tolerances : taille', np.round(mx - mn, 1))
# un fichier par pièce, chacune centrée et posée sur le plateau
for nom, ts in (('0a-test-corps', A), ('0b-test-facade', B), ('0c-test-pions', C), ('0d-test-cadre-maintien', D)):
    v = np.concatenate(ts); q = v.reshape(-1, 3); lo, hi = q.min(0), q.max(0)
    write_stl(os.path.join(OUT, f'The-Deck-{nom}.stl'), v - np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]]))
    print(nom, 'taille', np.round(hi - lo, 1))

# ---- vue 3D : pièces montées (même format que assembly.json de model.py) ----
TO3 = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)
scene = {'corps': (A_ASM, 'shell', 0.0), 'facade': (B_ASM, 'frame', 1.0), 'maintien': (D_ASM, 'patte', 0.5), 'pions': (C_ASM, 'capsule', -0.6)}
out = {'explode_dir': [0, 1, 0], 'parts': {}}
for k, (ts, mat, e) in scene.items():
    v = xform(np.concatenate(ts) - np.array([50.0, 0, 0]), TO3).astype(np.float32).reshape(-1)
    out['parts'][k] = {'mat': mat, 'explode': e, 'pos': base64.b64encode(v.tobytes()).decode()}
json.dump(out, open(os.path.join(OUT, 'test-assembly.json'), 'w'))
