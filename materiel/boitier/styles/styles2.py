"""Trois nouveaux styles (2e série) : Flottant, Étrier, Galet."""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # meshlib.py
import styles as S
from styles import loft, soft_slab, fillet, screen, cat, RP, RX, EX, TV, NV, A, GW, GH
from meshlib import extrude, rrect, circle, xform, box



def soft_disc(r, h, re, cx=0.0, cy=0.0, n=8):
    """Galet plat : disque aux arêtes arrondies, de z=0 à z=h."""
    rings, zs = [], []
    for k in range(n + 1):
        f = np.pi / 2 * k / n
        rings.append(r - re + re * np.sin(f)); zs.append(re - re * np.cos(f))
    for k in range(n + 1):
        f = np.pi / 2 * k / n
        rings.append(r - re + re * np.cos(f)); zs.append(h - re + re * np.sin(f))
    return loft([circle(rr, cx, cy, 96) for rr in rings], zs)


def bar(p0, p1, w, t, rc):
    """Barre droite de section arrondie (w le long de x, t en travers) entre deux points."""
    d = np.asarray(p1, float) - p0; L = np.linalg.norm(d); d /= L
    e2 = np.cross(d, EX)
    R = np.column_stack([EX, e2, d])
    return xform(extrude(rrect(w, t, rc), [], 0.0, L, maxlen=1e3), R, p0)


# =============== 4. FLOTTANT : écran suspendu sur un bras, socle rond ===============
def flottant():
    T, W, H = 9.0, GW + 2 * 6.0, GH + 2 * 6.0
    O = np.array([0, 0, 34.0])                               # bas de l'écran à 34 mm du bureau
    slab = xform(soft_slab(W, H, 8.0, T, 4.0, 0, H / 2), RP, O)
    hub = xform(extrude(circle(24.0, 0, H * 0.45, 64), [], -T - 5.0, -T + 0.5, maxlen=1e3), RP, O)
    P = O + RP @ np.array([0, H * 0.45, -T - 4.0])          # point d'attache du bras, au dos
    base_c = np.array([0, P[1] + 22.0, 0])
    disc = soft_disc(62.0, 9.0, 3.5, 0, base_c[1])
    arm = bar(base_c + [0, 0, 5.0], P, 30.0, 12.0, 6.0)
    g, z = screen((H - GH) / 2)
    g, z = g + O, z + O
    return {'corps': (slab, 'shell', 0.0), 'pied': (cat(disc, arm, hub), 'stand', -0.6),
            'ecran': (g, 'glass', 0.6), 'zone': (z, 'active', 0.6)}


# =============== 5. ÉTRIER : écran tenu par deux pivots dans un arceau en U ===============
def etrier():
    T, W, H = 11.0, GW + 2 * 9.0, GH + 2 * 9.0
    zp, yp = H / 2 * np.sin(A) + T * np.cos(A) + 20.0, 0.0
    O = np.array([0, yp, zp])                                 # axe des pivots = milieu de l'écran
    slab = xform(soft_slab(W, H, 9.0, T, 3.0, 0, 0), RP, O)
    wc = -T / 2                                               # pivots au milieu de l'épaisseur
    C = O + RP @ np.array([0, 0, wc])
    knobs = []
    for s in (-1, 1):
        x0, x1 = sorted([s * (W / 2 - 1.0), s * (W / 2 + 7.5)])
        knobs.append(xform(extrude(circle(9.0, C[1], C[2], 48), [], x0, x1, maxlen=1e3), RX))
        k0, k1 = sorted([s * (W / 2 + 16.5), s * (W / 2 + 19.0)])
        knobs.append(xform(extrude(circle(6.5, C[1], C[2], 48), [], k0, k1, maxlen=1e3), RX))   # molette extérieure
    up_h = C[2] + 15.0
    ups = []
    for s in (-1, 1):
        x0, x1 = sorted([s * (W / 2 + 7.5), s * (W / 2 + 16.5)])
        ups.append(xform(extrude(rrect(30.0, up_h, 14.9, C[1], up_h / 2), [], x0, x1, maxlen=1e3), RX))
    Wb = W + 2 * 16.5
    plinth = soft_slab(Wb, 76.0, 12.0, 10.0, 3.5, 0, C[1])
    plinth = plinth + [0, 0, 10.0]
    g, z = screen(-GH / 2)
    g, z = g + O, z + O
    return {'corps': (slab, 'shell', 0.0), 'vis': (cat(*knobs), 'metal', 0.0),
            'pied': (cat(*ups, plinth), 'stand', -0.5), 'ecran': (g, 'glass', 0.6), 'zone': (z, 'active', 0.6)}


# =============== 6. GALET : écran fin posé contre un galet arrondi (façon enceinte) ===============
def galet():
    T, W, H = 8.0, GW + 2 * 6.0, GH + 2 * 6.0
    LP = 52.0                                                  # longueur de la pente avant du galet
    F = LP * np.array([np.cos(A), np.sin(A)])
    prof = [(0, 0), tuple(F), (F[0] + 30, F[1] - 6), (F[0] + 48, 0)]
    base = np.array(fillet(prof, [3.0, 16.0, 26.0, 3.0], n=14))
    yc = base[:, 0].mean()
    Lx = W - 10.0
    rings, xs = [], []
    th = np.linspace(0, np.pi / 2, 18)
    for t in th[::-1]:                                         # bout gauche arrondi
        s = 0.55 + 0.45 * np.cos(t)
        rings.append(np.c_[yc + s * (base[:, 0] - yc), s * base[:, 1]]); xs.append(-Lx / 2 + 14 - 14 * np.sin(t))
    for t in th[1:]:                                           # bout droit arrondi
        s = 0.55 + 0.45 * np.cos(t)
        rings.append(np.c_[yc + s * (base[:, 0] - yc), s * base[:, 1]]); xs.append(Lx / 2 - 14 + 14 * np.sin(t))
    peb = xform(loft(rings, xs), RX)
    # écran fin appuyé sur la pente avant, qui dépasse au-dessus du galet
    O = RP @ np.array([0, 6.0, T])                             # le dos de l'écran touche la pente
    slab = xform(soft_slab(W, H, 8.0, T, 3.5, 0, H / 2), RP, O)
    g, z = screen((H - GH) / 2)
    g, z = g + O, z + O
    return {'corps': (slab, 'shell', 0.0), 'pied': (peb, 'stand', -0.5),
            'ecran': (g, 'glass', 0.6), 'zone': (z, 'active', 0.6)}


if __name__ == '__main__':
    S.OUT = sys.argv[1] if len(sys.argv) > 1 else 'styles'
    os.makedirs(S.OUT, exist_ok=True)
    S.export('flottant', flottant())
    S.export('etrier', etrier())
    S.export('galet', galet())
