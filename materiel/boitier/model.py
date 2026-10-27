"""The Deck - boîtier pour Waveshare ESP32-P4-WIFI6-Touch-LCD-7B.
Génère 3 STL (cadre, coque, pied) + assembly.json pour la vue 3D.
Toutes les cotes en mm. Les valeurs marquées SUPPOSE sont à mesurer sur la carte reçue.
"""
import json, base64, sys
import numpy as np
from meshlib import *

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

# ---- carte (Waveshare, doc officielle) ----
GW, GH = 164.28, 99.17          # vitre / contour module
AW, AH = 154.58, 86.42          # zone affichée
GT = 5.0                        # SUPPOSE : épaisseur du module écran (vitre + dalle)
BACK = 5.0                      # demandé : 5 mm entre le fond et l'écran (carte à vérifier !)
# ---- boîtier ----
CLR = 0.4                       # jeu par côté
WS, WTB, TB = 8.0, 3.0, 1.6     # parois latérales / haut-bas / fond
R = 5.0                         # rayon des angles
FT = 1.6                        # épaisseur du cadre avant
ANGLE = float(sys.argv[2]) if len(sys.argv) > 2 else 55.0   # inclinaison écran / bureau
VARIANT = sys.argv[3] if len(sys.argv) > 3 else 'lamelles'   # ajourage des flancs : lamelles | treillis
INSERT_D, SCREW_D = 4.2, 3.4    # inserts laiton M3 / passage vis M3
INSERT_DEPTH = 8.0              # trous borgnes des vis du cadre : insert (4 à 6 mm) + 2 mm pour le bout de la vis

PW, PH = GW + 2 * CLR, GH + 2 * CLR
OW, OH = PW + 2 * WS, PH + 2 * WTB
SD = TB + BACK + GT              # profondeur coque
SX = PW / 2 + WS / 2             # x des vis du cadre
SCREW_M = 4.8                    # vis du cadre dans les coins : même distance (4,8 mm) du bord du côté et du bord du haut/bas
SCREWS = [(sx * (OW / 2 - SCREW_M), sy * (OH / 2 - SCREW_M)) for sx in (-1, 1) for sy in (-1, 1)]
# contrôle : l'insert garde au moins 1 mm de matière vers le logement de l'écran
_dx = max(0.0, abs(SCREWS[0][0]) - PW / 2); _dy = max(0.0, abs(SCREWS[0][1]) - PH / 2)
assert np.hypot(_dx, _dy) >= INSERT_D / 2 + 1.0, 'insert trop près du logement de l’écran'
MX = 60.0                        # inserts du pied : rentrés sous l'écran (pied plus étroit que la coque)
MOUNT = [(sx * MX, y) for sx in (-1, 1) for y in (-42.0, 37.0)]     # inserts au dos, dans des bossages
# ouvertures côté gauche (vu de face) : (centre y, largeur) — d'après les photos Waveshare, à confirmer
USB_CUT = (0.0, 14.0)            # port USB-C, environ au milieu
BTN_CUT = (19.0, 10.0)           # SUPPOSE : bouton marche/arrêt, au-dessus du port
CABLE = None                     # fenêtre câbles dans le fond : supprimée (l'USB-C sort par le côté). Ancienne valeur : (60.0, 16.0, 0.0, -5.0)

parts = {}

# ---------- COQUE (repère coque : fond sur z=0, face avant z=SD) ----------
holes = [circle(INSERT_D / 2, x, y) for x, y in MOUNT]   # seuls les trous du pied traversent le fond
if CABLE:
    holes.append(rrect(CABLE[0], CABLE[1], 2.0, CABLE[2], CABLE[3]))
for y in (28.0, 34.0, 40.0):
    holes += [rrect(30.0, 3.0, 1.4, -20.0, y), rrect(30.0, 3.0, 1.4, 20.0, y)]
for y in (-38.0, -44.0):
    holes.append(rrect(50.0, 3.0, 1.4, 0.0, y))
shell = [extrude(rrect(OW, OH, R), holes, 0.0, TB)]
CUT_TOP = SD - 1.5                       # fenêtres jusqu'à 1,5 mm de la face avant (pont sous le cadre)
ins = [circle(INSERT_D / 2, x, y) for x, y in SCREWS]
outer = rrect(OW, OH, R)
SEG = 10
k = 2 * SEG + 1                          # fin de l'arrondi haut-gauche : début du bord gauche
(ub, uw), (bb, bw) = USB_CUT, BTN_CUT
hi1, lo1 = bb + bw / 2, bb - bw / 2      # fenêtre bouton
hi2, lo2 = ub + uw / 2, ub - uw / 2      # fenêtre USB
xo, xi = -OW / 2, -PW / 2
bridge = [(xo, hi1), (xi, hi1), (xi, PH / 2), (-xi, PH / 2), (-xi, -PH / 2), (xi, -PH / 2), (xi, lo2), (xo, lo2)]
lower = poly(np.vstack([outer[:k + 1], bridge, outer[k + 1:]]))
island = rect(OW / 2 - PW / 2, lo1 - hi2, (xo + xi) / 2, (lo1 + hi2) / 2)
# ---- fixation du cadre : rebord tout autour (pas de jour vu de côté) + 4 clips au milieu des grands côtés ----
RW, RD = 1.0, 1.4                        # feuillure en haut de la coque, où vient se poser le rebord du cadre
CL = 0.15                                # jeu entre le rebord et la coque
HOOK_X = (-45.0, 45.0)                   # clips en haut et en bas, entre les vis des coins
HOOK_W, HOOK_T, HOOK_L = 10.0, 1.2, 6.0  # bras du clip : largeur, épaisseur, longueur
BARB = 0.5                               # saillie du crochet
REC_D = HOOK_T + 0.2                     # logement du bras dans la coque (le bras affleure la paroi)
CATCH_D = REC_D + 0.6                    # logement du crochet
Z_REC = SD - HOOK_L - 0.2                # fond du logement
Z_LEDGE = SD - HOOK_L + 0.9              # le crochet s'accroche sous ce rebord
HX = [(xc - HOOK_W / 2 - 0.3, xc + HOOK_W / 2 + 0.3) for xc in HOOK_X]


def notched(loop, Y, depth, x_ranges):
    """Creuse des encoches rectangulaires (profondeur depth) dans les bords haut (y=+Y) et bas (y=-Y) d'un contour."""
    out, n = [], len(loop)
    for i in range(n):
        p_, q_ = loop[i], loop[(i + 1) % n]
        out.append((p_[0], p_[1]))
        for sg in (1, -1):
            if abs(p_[1] - sg * Y) < 1e-6 and abs(q_[1] - sg * Y) < 1e-6:
                lo_, hi_ = min(p_[0], q_[0]), max(p_[0], q_[0])
                rs = sorted([r for r in x_ranges if lo_ < r[0] and r[1] < hi_], key=lambda r: r[0], reverse=q_[0] < p_[0])
                for a_, b_ in rs:
                    f_, g_ = (b_, a_) if q_[0] < p_[0] else (a_, b_)
                    yi = sg * (Y - depth)
                    out += [(f_, sg * Y), (f_, yi), (g_, yi), (g_, sg * Y)]
    return poly(out)


Z_INS = SD - INSERT_DEPTH                # fond des trous d'inserts du cadre (paroi pleine en dessous)
inset = rrect(OW - 2 * RW, OH - 2 * RW, R - RW)
shell.append(extrude(lower, [], TB - 0.4, Z_INS))
shell.append(extrude(lower, ins, Z_INS, Z_REC))
shell.append(extrude(notched(lower, OH / 2, CATCH_D, HX), ins, Z_REC, Z_LEDGE))
shell.append(extrude(notched(lower, OH / 2, REC_D, HX), ins, Z_LEDGE, CUT_TOP))
shell.append(extrude(island, [], TB - 0.4, CUT_TOP))
shell.append(extrude(notched(outer, OH / 2, REC_D, HX), [rect(PW, PH)] + ins, CUT_TOP - 0.2, SD - RD))
shell.append(extrude(notched(inset, OH / 2 - RW, REC_D - RW, HX), [rect(PW, PH)] + ins, SD - RD, SD))
for sx in (-1, 1):                       # appuis de l'écran (4 patins)
    for sy in (-1, 1):
        x0, x1 = sorted([sx * (PW / 2 - 2.5), sx * (PW / 2 + 0.5)])
        shell.append(box(x0, x1, sy * 35 - 7.5, sy * 35 + 7.5, TB - 0.2, SD - GT))
for x, y in MOUNT:                        # bossages des inserts du pied (sous l'écran, à côté de la carte)
    shell.append(tube(4.0, INSERT_D / 2, TB - 0.2, SD - GT - 0.4, x, y))
parts['coque'] = shell

# ---------- CADRE AVANT (repère coque, z de SD à SD+FT) ----------
# gravure en haut du cadre, au milieu : logo + « THE DECK »
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties
from matplotlib.path import Path as MPath
ENGRAVE = 0.6                                # profondeur de gravure (mm)


def _nest(polys):
    """Range des contours fermés en (extérieur, [trous]) selon leur imbrication."""
    clean = []
    for p in polys:
        p = np.asarray(p, float)
        keep = [0] + [i for i in range(1, len(p)) if np.linalg.norm(p[i] - p[i - 1]) > 1e-4]
        p = p[keep]
        if len(p) > 1 and np.linalg.norm(p[0] - p[-1]) < 1e-4: p = p[:-1]
        if len(p) >= 3: clean.append(p)
    polys = clean
    paths = [MPath(p) for p in polys]
    depth, parent = [], []
    for i, p in enumerate(polys):
        cont = [j for j in range(len(polys)) if j != i and paths[j].contains_point(p[0])]
        depth.append(len(cont))
        parent.append(min(cont, key=lambda j: abs(0.5 * np.sum(polys[j][:, 0] * np.roll(polys[j][:, 1], -1) - np.roll(polys[j][:, 0], -1) * polys[j][:, 1]))) if cont else None)
    out = []
    for i, p in enumerate(polys):
        if depth[i] % 2 == 0:
            out.append((poly(p), [poly(polys[k]) for k in range(len(polys)) if parent[k] == i and depth[k] == depth[i] + 1]))
    return out


def text_shapes(text, cap_h, x0, yc):
    fp = FontProperties(fname='/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf')
    tp = TextPath((0, 0), text, size=10, prop=fp)
    cap = TextPath((0, 0), 'H', size=10, prop=fp).get_extents().height
    k = cap_h / cap
    polys = [np.c_[pp[:, 0] * k + x0, pp[:, 1] * k + yc - cap_h / 2] for pp in tp.to_polygons(closed_only=True)]
    w = tp.get_extents().x1 * k
    return _nest(polys), w


def logo_shapes(size, x0, yc):
    """Logo The Deck (pied à lamelles + écran incliné), dessiné pour la gravure : 2 lamelles plus épaisses."""
    k = size / 100.0
    def P(pts):                                # repère SVG (y vers le bas) -> mm
        return np.array([(x0 + x * k, yc - (y - 50) * k) for x, y in pts])
    def pill(xa, xb, y0, h):
        r = h / 2; pts = []
        for a in np.linspace(-90, 90, 9): pts.append((xb - r + r * np.cos(np.radians(a)), y0 + r + r * np.sin(np.radians(a))))
        for a in np.linspace(90, 270, 9): pts.append((xa + r + r * np.cos(np.radians(a)), y0 + r + r * np.sin(np.radians(a))))
        return P(pts)
    body = P([(16, 88), (86, 88), (86, 18)])
    slots = [pill(45, 78, 66, 10), pill(63, 78, 48, 10)]
    # écran : barre aux bouts arrondis de (6,78) à (76,8), épaisseur 9
    a, b, r = np.array([6.0, 78.0]), np.array([76.0, 8.0]), 4.5
    d = (b - a) / np.linalg.norm(b - a); n = np.array([-d[1], d[0]]); ang = np.degrees(np.arctan2(n[1], n[0]))
    cap_pts = [b + r * np.array([np.cos(np.radians(ang - t)), np.sin(np.radians(ang - t))]) for t in np.linspace(0, 180, 10)]
    cap_pts += [a + r * np.array([np.cos(np.radians(ang + 180 - t)), np.sin(np.radians(ang + 180 - t))]) for t in np.linspace(0, 180, 10)]
    return [(poly(body), [poly(sl) for sl in slots]), (poly(P(cap_pts)), [])]


TOP_Y = ((AH + 0.6) / 2 + OH / 2) / 2         # milieu du bandeau du haut
LOGO = 6.8                                     # hauteur du logo (mm)
CAP = 4.6                                      # hauteur des majuscules (mm)
_, TW = text_shapes('THE DECK', CAP, 0, 0)
GAP = 2.4
x_start = -(LOGO + GAP + TW) / 2
ENG = logo_shapes(LOGO, x_start, TOP_Y) + text_shapes('THE DECK', CAP, x_start + LOGO + GAP, TOP_Y)[0]

frame_holes = [rrect(AW + 0.6, AH + 0.6, 1.0)] + [circle(SCREW_D / 2, x, y) for x, y in SCREWS]
frame = [extrude(rrect(OW, OH, R), frame_holes, SD, SD + FT - ENGRAVE),
         extrude(rrect(OW, OH, R), frame_holes + [o for o, _ in ENG], SD + FT - ENGRAVE, SD + FT, maxlen=2.0)]
for _, isl in ENG:                             # intérieurs des lettres (D…) et lamelles du logo : restent en relief
    for h in isl:
        frame.append(extrude(h, [], SD + FT - ENGRAVE, SD + FT, maxlen=1.0))
# rebord sous le cadre : il descend dans la feuillure de la coque et cache le joint
frame.append(extrude(rrect(OW, OH, R), [rrect(OW - 2 * RW + 2 * CL, OH - 2 * RW + 2 * CL, R - RW + CL)], SD - RD + 0.1, SD))
for xc in HOOK_X:                              # clips : bras qui affleure la paroi + crochet (entrée en pente)
    for sg in (1, -1):
        y_out, y_in = sg * OH / 2, sg * (OH / 2 - HOOK_T)
        y_b, y_b2 = sg * (OH / 2 - HOOK_T - BARB), sg * (OH / 2 - HOOK_T - BARB / 2)
        x0_, x1_ = xc - HOOK_W / 2, xc + HOOK_W / 2
        frame.append(box(x0_, x1_, min(y_out, y_in), max(y_out, y_in), SD - HOOK_L, SD))
        frame.append(box(x0_, x1_, min(y_in, y_b), max(y_in, y_b), SD - HOOK_L + 0.3, SD - HOOK_L + 0.8))
        frame.append(box(x0_, x1_, min(y_in, y_b2), max(y_in, y_b2), SD - HOOK_L, SD - HOOK_L + 0.3))
parts['cadre'] = frame

# ---------- PIED (repère plaque : x, u le long de la pente, w sous la pente) ----------
A = np.radians(ANGLE)
c, s = np.cos(A), np.sin(A)
U0 = 48.0                                # u = y_coque + U0
H0 = 3.0 + 5.0 * s                       # coque à 3 mm du bureau
O = np.array([0.0, 0.0, H0])
t = np.array([0.0, c, s])
n = np.array([0.0, -s, c])
ex = np.array([1.0, 0.0, 0.0])
M = np.column_stack([ex, t, -n])         # repère plaque -> monde
INSET = 19.5                             # le pied est 19,5 mm plus étroit que la coque de chaque côté
L_ST, W_ST, PT = 92.0, OW - 2 * INSET, 4.0

RIB_W = 5.0
_xe = W_ST / 2 - 2.0 - RIB_W / 2                                # centre des nervures du bord
RIBS_X = tuple(xc - RIB_W / 2 for xc in (-_xe, -_xe / 3, _xe / 3, _xe))   # 4 nervures de 5 mm, régulièrement espacées
HEX_R, HEX_WALL = 4.6, 2.2


def hexagon(r, cx, cy, a0=90.0):
    a = np.radians(a0 + 60 * np.arange(6))
    return poly(np.c_[cx + r * np.cos(a), cy + r * np.sin(a)])


def hex_ok(cx, cy):
    """Garde les alvéoles loin des bords, des vis, de la fenêtre câbles et des nervures."""
    m = 4.5
    if abs(cx) + HEX_R > W_ST / 2 - m or cy - HEX_R < m or cy + HEX_R > L_ST - m:
        return False
    for x, y in MOUNT:
        if np.hypot(cx - x, cy - (y + U0)) < HEX_R + SCREW_D / 2 + 5.0:
            return False
    cw, ch = (CABLE[0] + 4, CABLE[1] + 4) if CABLE else (0, 0)
    if CABLE and abs(cx - CABLE[2]) < cw / 2 + HEX_R + 2.4 and abs(cy - (CABLE[3] + U0)) < ch / 2 + HEX_R + 2.4:
        return False
    for x0 in RIBS_X:
        if x0 - HEX_R - 2.0 < cx < x0 + 5.0 + HEX_R + 2.0:
            return False
    return True


pitch = HEX_R * np.sqrt(3) + HEX_WALL
row = pitch * np.sqrt(3) / 2
hexes = []
for j in range(-2, 20):
    cy = 6.0 + j * row
    off = (pitch / 2) if j % 2 else 0.0
    for i in range(-20, 21):
        cx = i * pitch + off
        if hex_ok(cx, cy):
            hexes.append(hexagon(HEX_R, cx, cy))

stand = [extrude(rrect(W_ST, L_ST, 2.0, 0.0, L_ST / 2),
                 [circle(SCREW_D / 2, x, y + U0) for x, y in MOUNT]
                 + ([rrect(CABLE[0] + 4, CABLE[1] + 4, 2.0, CABLE[2], CABLE[3] + U0)] if CABLE else []) + hexes,
                 0.0, PT)]


def under(u, w):
    p = O + u * t - w * n
    return p[1], p[2]


yf, zf = under(0.0, PT - 0.3)
YB, ZC = under(L_ST, PT)                 # coin bas de l'extrémité de la plaque
YB -= 0.05
ub = (YB - (PT - 0.3) * s) / c
_, zb = under(ub, PT - 0.3)


def ztop(y):
    return zf + (zb - zf) * (y - yf) / (YB - yf)


# ---------- flancs ajourés ----------
# repère du flanc : (y, z) monde ; repère d'impression : u le long de la plaque, w hauteur au-dessus du plateau
cA = np.cos(np.arctan2(zb - zf, YB - yf))   # pente du dessus de la nervure
KT = (zb - zf) / (YB - yf)
M_IN = 3.2                                  # matière gardée tout autour


def to_print2d(pts):
    yy, zz = pts[:, 0] - O[1], pts[:, 1] - O[2]
    return np.c_[yy * c + zz * s, yy * s - zz * c]


def stadium(y0, y1, zc, r, seg=12):
    pts = []
    for k in range(seg + 1):
        a = np.radians(-90 + 180 * k / seg)
        pts.append((y1 + r * np.cos(a), zc + r * np.sin(a)))
    for k in range(seg + 1):
        a = np.radians(90 + 180 * k / seg)
        pts.append((y0 + r * np.cos(a), zc + r * np.sin(a)))
    return poly(pts)


def lamelles():
    """Fentes horizontales aux bouts arrondis, de plus en plus courtes vers le haut."""
    out, h, gap = [], 4.2, 3.0
    zc = M_IN + h / 2
    while zc + h / 2 <= zb - M_IN:
        yr = YB - M_IN - h / 2
        yl = yf + (zc + h / 2 + M_IN / cA - zf) / KT + h / 2
        yl = max(yl, yf + M_IN + h / 2)
        if yr - yl >= 3.0:
            out.append(stadium(yl, yr, zc, h / 2))
        zc += h + gap
    return out


def offset_tri(P, d):
    """Triangle P rétréci de d (chaque côté recule de d vers l'intérieur)."""
    P = _ccw_pts(P)
    L = []
    for i in range(3):
        a, b = P[i], P[(i + 1) % 3]
        e = (b - a) / np.linalg.norm(b - a)
        nrm = np.array([-e[1], e[0]])          # intérieur (triangle CCW)
        L.append((a + nrm * d, e))
    Q = []
    for i in range(3):
        (p1, d1), (p2, d2) = L[i - 1], L[i]
        A_ = np.array([d1, -d2]).T
        t1 = np.linalg.solve(A_, p2 - p1)[0]
        Q.append(p1 + d1 * t1)
    return np.array(Q)


def _ccw_pts(P):
    P = np.asarray(P, float)
    a = (P[1, 0] - P[0, 0]) * (P[2, 1] - P[0, 1]) - (P[1, 1] - P[0, 1]) * (P[2, 0] - P[0, 0])
    return P if a > 0 else P[::-1]


def inradius(P):
    a, b, cc = (np.linalg.norm(P[i] - P[(i + 1) % 3]) for i in range(3))
    sp = (a + b + cc) / 2
    return np.sqrt(max(sp * (sp - a) * (sp - b) * (sp - cc), 0)) / sp


def rounded_tri(P, d, rc, seg=8):
    Q = offset_tri(P, d + rc)
    pts = []
    for i in range(3):
        a, b, nx = Q[i - 1], Q[i], Q[(i + 1) % 3]
        e1 = (b - a) / np.linalg.norm(b - a); e2 = (nx - b) / np.linalg.norm(nx - b)
        n1 = np.array([e1[1], -e1[0]]); n2 = np.array([e2[1], -e2[0]])   # normales vers l'extérieur
        a1, a2 = np.arctan2(n1[1], n1[0]), np.arctan2(n2[1], n2[0])
        if a2 < a1:
            a2 += 2 * np.pi
        for k in range(seg + 1):
            t_ = a1 + (a2 - a1) * k / seg
            pts.append(b + rc * np.array([np.cos(t_), np.sin(t_)]))
    return poly(pts)


def treillis():
    """Treillis en triangles (poutre Warren) entre le dos du flanc et la plaque, angles arrondis, barres de 3,2 mm."""
    d, rc, n = 1.6, 1.8, 5
    y_end = YB - M_IN                                         # barre arrière (verticale)
    yh = lambda z: yf + (z + M_IN / cA - zf) / KT             # barre avant (sous la plaque)
    z_apex = zf + KT * (y_end - yf) - M_IN / cA
    zs = np.linspace(M_IN, z_apex, n + 1)
    H = [np.array([yh(z), z]) for z in zs]                    # noeuds le long de la plaque
    A = [np.array([y_end, (zs[k] + zs[k + 1]) / 2]) for k in range(n)]   # noeuds le long du dos
    tris = [[H[0], np.array([y_end, M_IN]), A[0]]]            # triangle du bas, posé sur la barre du bureau
    for k in range(n):
        tris.append([H[k], A[k], H[k + 1]])
        if k < n - 1:
            tris.append([A[k], A[k + 1], H[k + 1]])
    out = []
    for P in tris:
        P = np.array(P)
        if inradius(P) > d + rc + 1.0:
            out.append(rounded_tri(P, d, rc))
    return out


def overhangs(holes2d):
    """Bords supérieurs des ouvertures trop à plat pour s'imprimer sans support (angle < 40°, longueur > 4 mm)."""
    bad = 0
    for h in holes2d:
        q = to_print2d(h)
        ar = 0.5 * np.sum(q[:, 0] * np.roll(q[:, 1], -1) - np.roll(q[:, 0], -1) * q[:, 1])
        if ar < 0:
            q = q[::-1]
        for i in range(len(q)):
            a_, b_ = q[i], q[(i + 1) % len(q)]
            du, dw = b_ - a_
            ln = np.hypot(du, dw)
            nw = -du                      # normale sortante (trou CCW) = (dw, -du)
            if ln > 4.0 and nw > 0 and np.degrees(np.arctan2(abs(dw), abs(du))) < 40:
                bad += 1
    return bad


rib_holes = lamelles() if VARIANT == 'lamelles' else treillis()
OVERHANGS = overhangs(rib_holes)
BUMP_DEPTH = 1.0                         # profondeur du logement des patins (voir semelles)
# la nervure s'arrête 1 mm au-dessus du bureau : seules les semelles (et leurs patins) touchent le bureau
rib2d = poly([(yf, BUMP_DEPTH), (YB, BUMP_DEPTH), (YB, zb), (yf, zf)])
assert zf > BUMP_DEPTH + 0.5, 'nervure trop basse à l’avant'
P_RIB = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)        # (a,b,c) -> (x=c, y=a, z=b)
world_bits = []
for x0 in RIBS_X:
    world_bits.append(xform(extrude(rib2d, rib_holes, x0, x0 + 5.0), P_RIB))
for wb in world_bits:                    # monde -> repère plaque
    stand.append(xform(wb, M.T, -M.T @ O))

# ---------- semelles antidérapantes : 2 par nervure, avec un logement pour un patin silicone adhésif ----------
PAD_W, PAD_L, PAD_H = 10.0, 14.0, 3.0    # semelle sous chaque bout de nervure
BUMP_D = 8.4                             # patins silicone 8 × 2 mm : 1 mm dépasse sous la semelle
y_front = yf + 1.0
while ztop(y_front) < PAD_H + 1.0:       # la semelle avant commence là où la nervure est assez haute
    y_front += 0.5
PADS_Y = (y_front + PAD_L / 2, YB - 1.0 - PAD_L / 2)
for x0 in RIBS_X:
    xc = x0 + RIB_W / 2
    for yc in PADS_Y:
        outline = rrect(PAD_W, PAD_L, 2.0, xc, yc)
        for pb in (extrude(outline, [circle(BUMP_D / 2, xc, yc)], 0.0, BUMP_DEPTH), extrude(outline, [], BUMP_DEPTH, PAD_H)):
            stand.append(xform(pb, M.T, -M.T @ O))
parts['pied'] = stand

# ---------- contrôles ----------
report = {}
for name, solids in parts.items():
    for i, so in enumerate(solids):
        bad, vol = check_closed(so, name)
        assert bad == 0, f'{name}[{i}] non fermé ({bad} arêtes)'
        assert vol > 0, f'{name}[{i}] volume négatif'
    allt = np.concatenate(solids)
    report[name] = dict(solides=len(solids), triangles=int(len(allt)),
                        bbox=[np.round(allt.reshape(-1, 3).min(0), 2).tolist(), np.round(allt.reshape(-1, 3).max(0), 2).tolist()])

# ---------- STL (orientation d'impression) ----------
to_print = {
    'coque': lambda tr: tr,
    'cadre': lambda tr: xform(tr, rot_y(180), [0, 0, SD + FT]),
    'pied': lambda tr: tr,
}
for name, solids in parts.items():
    tr = to_print[name](np.concatenate(solids))
    write_stl(f'{OUT}/{name}.stl', tr)
    report[name]['impression_bbox'] = [np.round(tr.reshape(-1, 3).min(0), 2).tolist(), np.round(tr.reshape(-1, 3).max(0), 2).tolist()]

# ---------- assemblage pour la vue 3D ----------
SHELL_R = np.column_stack([ex, t, n])
SHELL_T = O + U0 * t
TO3 = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)   # monde (z haut) -> three.js (y haut)


def world_shell(tr):
    return xform(tr, SHELL_R, SHELL_T)


display = [box(-GW / 2, GW / 2, -GH / 2, GH / 2, SD - GT, SD - 0.05)]
active = [box(-AW / 2, AW / 2, -AH / 2, AH / 2, SD - 0.05, SD)]
pcb = [box(-55, 55, -38, 38, SD - GT - 3.6, SD - GT - 2.0)]
scene = {
    'coque': (world_shell(np.concatenate(parts['coque'])), 'shell', 0.0),
    'cadre': (world_shell(np.concatenate(parts['cadre'])), 'frame', 1.0),
    'ecran': (world_shell(np.concatenate(display)), 'glass', 0.6),
    'zone': (world_shell(np.concatenate(active)), 'active', 0.6),
    'carte': (world_shell(np.concatenate(pcb)), 'pcb', 0.3),
    'pied': (xform(np.concatenate(parts['pied']), M, O), 'stand', -0.6),
}
ex3 = (TO3 @ n).tolist()
out = {'explode_dir': ex3, 'parts': {}}
for k, (tr, mat, e) in scene.items():
    v = xform(tr, TO3).astype(np.float32).reshape(-1)
    out['parts'][k] = {'mat': mat, 'explode': e, 'pos': base64.b64encode(v.tobytes()).decode()}
with open(f'{OUT}/assembly.json', 'w') as fh:
    json.dump(out, fh)

report['gravure'] = dict(largeur=round(LOGO + GAP + TW, 1), hauteur=LOGO, profondeur=ENGRAVE, y_centre=round(TOP_Y, 2))
report['flancs'] = dict(variante=VARIANT, ouvertures=len(rib_holes), surplombs=OVERHANGS)
report['semelles'] = dict(nombre=len(RIBS_X) * 2, y=[round(v, 1) for v in PADS_Y], patin='silicone adhésif 8 × 2 mm', logement=[BUMP_D, BUMP_DEPTH])
report['fixation_cadre'] = dict(rebord=[RW, RD], clips=len(HOOK_X) * 2, clip_bras=[HOOK_W, HOOK_T, HOOK_L], crochet=BARB, x=list(HOOK_X))
report['cotes'] = dict(coque_ext=[round(OW, 2), round(OH, 2), round(SD, 2)], pied_larg=round(W_ST, 1), cadre_ep=FT, angle=ANGLE,
                       fenetre_cadre=[AW + 0.6, AH + 0.6], hauteur_max=round(float(max(
                           (xform(np.concatenate(parts['pied']), M, O)).reshape(-1, 3)[:, 2].max(),
                           world_shell(np.concatenate(parts['cadre'])).reshape(-1, 3)[:, 2].max())), 1))
print(json.dumps(report, indent=1))
