"""3e série, famille « Flottant » : Col de cygne, Colonne, Fourche."""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # meshlib.py
import styles as S
from styles import loft, soft_slab, screen, cat, RP, RX, EX, TV, NV, A, GW, GH
from styles2 import bar
from meshlib import extrude, rrect, circle, xform

T, W, H = 9.0, GW + 2 * 6.0, GH + 2 * 6.0


def sweep(path, sec):
    """Tube de section `sec` (2D, x = largeur le long de EX) qui suit une courbe dans le plan (y, z)."""
    sec = np.asarray(sec, float)
    d = np.gradient(path, axis=0); d /= np.linalg.norm(d, axis=1, keepdims=True)
    rings = []
    for p, t in zip(path, d):
        e2 = np.cross(t, EX); e2 /= np.linalg.norm(e2)
        rings.append(p + np.outer(sec[:, 0], EX) + np.outer(sec[:, 1], e2))
    tris = []
    for a, b in zip(rings, rings[1:]):
        a2, b2 = np.roll(a, -1, 0), np.roll(b, -1, 0)
        tris += [np.stack([a, a2, b2], 1), np.stack([a, b2, b], 1)]
    for ring, end in ((rings[0], False), (rings[-1], True)):
        c = np.repeat(ring.mean(0)[None], len(ring), 0)
        r2 = np.roll(ring, -1, 0)
        tris.append(np.stack([c, ring, r2], 1) if end else np.stack([c, r2, ring], 1))
    tr = np.concatenate(tris)
    vol = np.sum(np.einsum('ij,ij->i', tr[:, 0], np.cross(tr[:, 1], tr[:, 2])))
    return tr if vol > 0 else tr[:, [0, 2, 1]]


def bezier(p0, p1, p2, p3, n=60):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def flat_base(Wb, Db, h, rc, re, cy):
    return soft_slab(Wb, Db, rc, h, re, 0, cy) + [0, 0, h]


def panel(O, hub_r=None, hub_v=0.5):
    slab = xform(soft_slab(W, H, 8.0, T, 4.0, 0, H / 2), RP, O)
    g, z = screen((H - GH) / 2)
    out = {'corps': (slab, 'shell', 0.0), 'ecran': (g + O, 'glass', 0.6), 'zone': (z + O, 'active', 0.6)}
    hub = None
    if hub_r:
        hub = xform(extrude(circle(hub_r, 0, H * hub_v, 64), [], -T - 5.0, -T + 0.5, maxlen=1e3), RP, O)
    return out, hub


# =============== 7. COL DE CYGNE : bras courbe qui sort d'un socle carré arrondi ===============
def cygne():
    O = np.array([0, 0, 40.0])
    out, hub = panel(O, 20.0, 0.5)
    P = O + RP @ np.array([0, H * 0.5, -T - 4.5])
    yb = P[1] + 40.0
    base = flat_base(110.0, 96.0, 8.0, 26.0, 3.0, yb - 8.0)
    B0 = np.array([0, yb, 4.0])
    path = bezier(B0, B0 + [0, 0, 45.0], P - NV * 40.0, P)
    arm = sweep(path, rrect(24.0, 11.0, 5.4, seg=8))
    out['pied'] = (cat(base, arm, hub), 'stand', -0.6)
    return out


# =============== 8. COLONNE : colonne droite et charnière, comme un écran d'ordinateur ===============
def colonne():
    O = np.array([0, 0, 46.0])
    out, _ = panel(O)
    Hc = O + RP @ np.array([0, H * 0.48, -T - 9.0])          # axe de la charnière
    post = extrude(rrect(34.0, 14.0, 6.9, 0, Hc[1] + 3.0), [], 5.0, Hc[2], maxlen=1e3)
    cap = xform(extrude(circle(9.0, Hc[1], Hc[2], 48), [], -26.0, 26.0, maxlen=1e3), RX)          # charnière
    plate = xform(extrude(rrect(60.0, 34.0, 8.0, 0, H * 0.48), [], -T - 3.0, -T + 0.5, maxlen=1e3), RP, O)
    arm = bar(Hc, O + RP @ np.array([0, H * 0.48, -T - 2.0]), 40.0, 8.0, 3.9)
    base = flat_base(150.0, 90.0, 7.0, 14.0, 2.5, Hc[1] - 18.0)
    out['pied'] = (cat(post, base, plate, arm), 'stand', -0.6)
    out['vis'] = (cap, 'metal', -0.6)
    return out


# =============== 9. FOURCHE : deux bras fins depuis une barre posée derrière ===============
def fourche():
    O = np.array([0, 0, 32.0])
    out, _ = panel(O)
    xs = (-52.0, 52.0)
    arms, hubs = [], []
    P = O + RP @ np.array([0, H * 0.55, -T - 3.5])
    yb = P[1] + 12.0
    base = flat_base(150.0, 40.0, 9.0, 19.9, 3.5, yb)
    for x in xs:
        arms.append(bar(np.array([x, yb, 6.0]), P + [x, 0, 0], 14.0, 10.0, 4.9))
        hubs.append(xform(extrude(circle(11.0, x, H * 0.55, 48), [], -T - 4.0, -T + 0.5, maxlen=1e3), RP, O))
    out['pied'] = (cat(base, *arms, *hubs), 'stand', -0.6)
    return out


if __name__ == '__main__':
    S.OUT = sys.argv[1] if len(sys.argv) > 1 else 'styles'
    os.makedirs(S.OUT, exist_ok=True)
    S.export('cygne', cygne())
    S.export('colonne', colonne())
    S.export('fourche', fourche())
