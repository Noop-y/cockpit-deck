"""Trois styles de boîtier (maquettes 3D) pour comparer avec le boîtier actuel.
Sortie : <dossier>/<style>.json (même format que assembly.json : y vers le haut, comme three.js)."""
import sys, os, json, base64
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # meshlib.py
from meshlib import extrude, rrect, rect, circle, poly, box, xform, triangulate, check_closed, _ccw

OUT = 'styles'
GW, GH = 164.28, 99.17          # vitre
AW, AH = 154.58, 86.42          # zone affichée
A = np.radians(55.0)            # inclinaison écran / bureau
EX = np.array([1.0, 0, 0])
TV = np.array([0, np.cos(A), np.sin(A)])        # monte le long de l'écran (vers l'arrière)
NV = np.cross(EX, TV)                           # sort de l'écran (vers l'avant)
RP = np.column_stack([EX, TV, NV])              # repère écran (u, v, w) -> monde (x, y = arrière, z = haut)
RX = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)   # profil (y, z) extrudé le long de x
TO3 = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)


def loft(rings, ws):
    """Surface lisse entre sections de même nombre de points, deux bouchons plats."""
    rings = [_ccw(np.asarray(r, float)) for r in rings]
    tris = []
    for (ra, ca), (rb, cb) in zip(zip(rings, ws), zip(rings[1:], ws[1:])):
        P, Q = np.c_[ra, np.full(len(ra), ca)], np.c_[rb, np.full(len(rb), cb)]
        P2, Q2 = np.roll(P, -1, 0), np.roll(Q, -1, 0)
        tris += [np.stack([P, P2, Q2], 1), np.stack([P, Q2, Q], 1)]
    for ring, c, top in ((rings[0], ws[0], False), (rings[-1], ws[-1], True)):
        pts, simp, _ = triangulate(ring, [], maxlen=1e3)
        assert len(pts) == len(ring)
        Pp = np.c_[pts, np.full(len(pts), c)]
        tris.append(Pp[simp] if top else Pp[simp[:, [0, 2, 1]]])
    return np.concatenate(tris)


def soft_slab(W, H, Rc, T, re, cx=0.0, cy=0.0, n=10):
    """Plaque aux angles arrondis ET aux arêtes arrondies (rayon re), de w=-T à w=0."""
    rings, ws = [], []
    for k in range(n + 1):                                   # arrondi arrière
        f = np.pi / 2 * k / n
        rings.append(re - re * np.sin(f)); ws.append(-T + re - re * np.cos(f))
    for k in range(n + 1):                                   # arrondi avant
        f = np.pi / 2 * k / n
        rings.append(re - re * np.cos(f)); ws.append(-re + re * np.sin(f))
    return loft([rrect(W - 2 * i, H - 2 * i, max(Rc - i, 0.6), cx, cy, seg=14) for i in rings], ws)


def chamf(W, H, c, cx=0.0, cy=0.0):
    """Rectangle aux coins coupés (octogone)."""
    w, h = W / 2, H / 2
    return poly([(cx - w + c, cy - h), (cx + w - c, cy - h), (cx + w, cy - h + c), (cx + w, cy + h - c),
                 (cx + w - c, cy + h), (cx - w + c, cy + h), (cx - w, cy + h - c), (cx - w, cy - h + c)])


def fillet(pts, rads, n=10):
    """Arrondit chaque coin d'un polygone (rayon par coin)."""
    pts = np.asarray(pts, float); out = []
    N = len(pts)
    for i in range(N):
        p, a, b = pts[i], pts[i - 1], pts[(i + 1) % N]
        r = rads[i] if np.ndim(rads) else rads
        if r <= 0:
            out.append(p); continue
        u, v = (a - p) / np.linalg.norm(a - p), (b - p) / np.linalg.norm(b - p)
        ang = np.arccos(np.clip(u @ v, -1, 1))
        d = r / np.tan(ang / 2)
        p1, p2 = p + u * d, p + v * d
        bis = (u + v) / np.linalg.norm(u + v)
        c = p + bis * r / np.sin(ang / 2)
        a1, a2 = np.arctan2(*(p1 - c)[::-1]), np.arctan2(*(p2 - c)[::-1])
        da = (a2 - a1 + np.pi) % (2 * np.pi) - np.pi
        for t in np.linspace(0, 1, n):
            out.append(c + r * np.array([np.cos(a1 + da * t), np.sin(a1 + da * t)]))
    return poly(out)


def screen(v0, w0=0.0):
    """Vitre noire + zone affichée, posée sur un plan w = w0, bas de la vitre à v0."""
    g = box(-GW / 2, GW / 2, v0, v0 + GH, w0 - 0.6, w0 + 0.5)
    z = box(-AW / 2, AW / 2, v0 + (GH - AH) / 2, v0 + (GH + AH) / 2, w0 + 0.5, w0 + 0.55)
    return xform(g, RP), xform(z, RP)


def export(name, parts):
    allv = np.concatenate([p for p, _, _ in parts.values()]).reshape(-1, 3)
    shift = np.array([0, -allv[:, 1].min(), -allv[:, 2].min()])     # posé sur le bureau, avant à y=0
    out = {'explode_dir': (TO3 @ NV).tolist(), 'parts': {}}
    for k, (tr, mat, e) in parts.items():
        bad, vol = check_closed(tr, k)
        assert bad == 0, f'{name}/{k} non fermé ({bad})'
        v = xform(tr + shift, TO3).astype(np.float32).reshape(-1)
        out['parts'][k] = {'mat': mat, 'explode': e, 'pos': base64.b64encode(v.tobytes()).decode()}
    mn, mx = allv.min(0) + shift, allv.max(0) + shift
    out['size'] = np.round(mx - mn, 0).tolist()
    json.dump(out, open(f'{OUT}/{name}.json', 'w'))
    print(name, 'taille (l × p × h) :', out['size'])


def cat(*a):
    return np.concatenate(a)


# =============== 1. MONOLITHE : un seul bloc en biseau, joues orange ===============
def monolithe():
    LF = GH + 2 * 11.0                                   # longueur de la face écran
    F = np.array([LF * np.cos(A), LF * np.sin(A)])
    prof = [(0, 0), tuple(F), (F[0] + 16, F[1]), (F[0] + 34, 0)]
    W = GW + 2 * 11.0
    body = xform(extrude(fillet(prof, [1.5, 7.0, 9.0, 1.5]), [], -W / 2, W / 2, maxlen=1e3), RX)
    # joues orange : même profil, un peu plus grand, de chaque côté
    big = fillet([(-1.2, 0), (F[0] - 0.4, F[1] + 1.6), (F[0] + 17.0, F[1] + 1.6), (F[0] + 36.2, 0)], [1.5, 8.0, 10.0, 1.5])
    cheeks = cat(*[xform(extrude(big, [], x0, x0 + 6.0, maxlen=1e3), RX) for x0 in (-W / 2 - 6.0, W / 2)])
    # gorge orange : fine bande en creux sous l'écran (décor)
    g, z = screen((LF - GH) / 2)
    return {'corps': (body, 'shell', 0.0), 'pied': (cheeks, 'stand', -0.35),
            'ecran': (g, 'glass', 0.6), 'zone': (z, 'active', 0.6)}


# =============== 2. ROULEAU : plaque fine aux bords tout ronds, posée sur un cylindre ===============
def rouleau():
    T, W, H = 12.0, GW + 2 * 7.5, GH + 2 * 7.5
    slab = xform(soft_slab(W, H, 11.0, T, 5.5, 0, H / 2), RP)
    zmin = slab.reshape(-1, 3)[:, 2].min()
    r, L = 19.0, 150.0
    zc = zmin + r
    yc = (T + r + zc * np.cos(A)) / np.sin(A)         # cylindre tangent au dos de la plaque
    # cylindre aux bouts arrondis (congés de 5 mm), axe le long de x
    rings, xs = [], []
    for k in range(13):
        f = np.pi / 2 * k / 12
        rings.append(r - 5 + 5 * np.sin(f)); xs.append(-L / 2 + 5 - 5 * np.cos(f))
    for k in range(13):
        f = np.pi / 2 * k / 12
        rings.append(r - 5 + 5 * np.cos(f)); xs.append(L / 2 - 5 + 5 * np.sin(f))
    cyl = loft([circle(rr, 0, 0, 72) for rr in rings], xs)        # (a, b) section, axe c
    cyl = xform(cyl, RX, [0, yc, zc])
    # méplat discret sous le cylindre : 2 patins orange plus foncés -> on garde le même orange
    g, z = screen((H - GH) / 2)
    return {'corps': (slab, 'shell', 0.0), 'pied': (cyl, 'stand', -0.5),
            'ecran': (g, 'glass', 0.6), 'zone': (z, 'active', 0.6)}


# =============== 3. COCKPIT : cadre à pans coupés façon écran de vaisseau, béquilles en A ===============
def cockpit():
    T, W, H, C = 15.0, GW + 2 * 16.0, GH + 2 * 13.0, 15.0
    rings = [chamf(W, H, C, 0, H / 2), chamf(W, H, C, 0, H / 2), chamf(W - 9, H - 9, C - 2.5, 0, H / 2)]
    frame = xform(loft(rings, [-T, -4.5, 0.0]), RP)
    # oreilles orange sur les côtés (poignées), pans coupés
    ears = []
    for s in (-1, 1):
        cx = s * (W / 2 + 4.0)
        er = [chamf(10.0, H - 34, 4.0, cx, H / 2), chamf(10.0, H - 34, 4.0, cx, H / 2), chamf(6.0, H - 42, 2.0, cx, H / 2)]
        ears.append(loft(er, [-T + 1.5, -5.0, -1.0]))
    ears = xform(cat(*ears), RP)
    # 4 têtes de vis décoratives dans les pans coupés
    sc = []
    for su in (-1, 1):
        for sv in (0, 1):
            u, v = su * (W / 2 - 10.5), (10.5 if sv == 0 else H - 10.5)
            sc.append(extrude(circle(2.8, u, v, 28), [], -0.2, 0.9, maxlen=1e3))
    screws = xform(cat(*sc), RP)
    # béquilles en A (profil dans le plan y, z), reliées par une barre au sol
    P = lambda v, w: RP @ np.array([0, v, w])
    pa, pb = P(14.0, -T), P(H * 0.82, -T)
    foot_y = pb[1] + 26.0
    zmin = min(frame.reshape(-1, 3)[:, 2].min(), 0)
    pts = [(pa[1], pa[2]), (pb[1], pb[2]), (foot_y, zmin), (pa[1] + 6.0, zmin)]
    leg = fillet(pts, [3.0, 5.0, 3.0, 3.0])
    # évidement triangulaire
    cen = np.mean(pts, 0)
    hole = fillet([cen + 0.45 * (np.array(p) - cen) for p in pts[:3]], 2.5)
    legs = []
    for s in (-1, 1):
        x0 = s * (W / 2 - 34.0)
        legs.append(xform(extrude(leg, [hole], x0 - 4.5, x0 + 4.5, maxlen=1e3), RX))
    bar_y = foot_y - 14.0
    bar = box(-(W / 2 - 34.0), W / 2 - 34.0, bar_y - 4.0, bar_y + 4.0, zmin, zmin + 8.0)
    g, z = screen((H - GH) / 2)
    return {'corps': (frame, 'frame', 0.0), 'oreilles': (ears, 'stand', 0.0), 'vis': (screws, 'metal', 0.0),
            'pied': (cat(*legs, bar), 'stand', -0.5), 'ecran': (g, 'glass', 0.6), 'zone': (z, 'active', 0.6)}


if __name__ == '__main__':
    OUT = sys.argv[1] if len(sys.argv) > 1 else 'styles'
    os.makedirs(OUT, exist_ok=True)
    export('monolithe', monolithe())
    export('rouleau', rouleau())
    export('cockpit', cockpit())
