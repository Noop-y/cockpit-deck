"""Petit mailleur : extrusions de polygones à trous, cylindres, boîtes, export STL."""
import numpy as np
from scipy.spatial import Delaunay
from matplotlib.path import Path


# ---------- contours 2D ----------
def _ccw(loop):
    a = 0.5 * np.sum(loop[:, 0] * np.roll(loop[:, 1], -1) - np.roll(loop[:, 0], -1) * loop[:, 1])
    return loop if a > 0 else loop[::-1]


def _cw(loop):
    return _ccw(loop)[::-1]


def rrect(w, h, r, cx=0.0, cy=0.0, seg=10):
    pts = []
    r = min(r, w / 2 - 1e-6, h / 2 - 1e-6)
    if r <= 0:
        return rect(w, h, cx, cy)
    for (sx, sy, a0) in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
        ccx, ccy = cx + sx * (w / 2 - r), cy + sy * (h / 2 - r)
        for k in range(seg + 1):
            a = np.radians(a0 + 90 * k / seg)
            pts.append((ccx + r * np.cos(a), ccy + r * np.sin(a)))
    return _ccw(np.array(pts))


def rect(w, h, cx=0.0, cy=0.0):
    return _ccw(np.array([(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2),
                          (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]))


def circle(r, cx=0.0, cy=0.0, n=32):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return _ccw(np.c_[cx + r * np.cos(a), cy + r * np.sin(a)])


def poly(pts):
    return _ccw(np.array(pts, dtype=float))


def _densify(loop, maxlen):
    out = []
    n = len(loop)
    for i in range(n):
        p, q = loop[i], loop[(i + 1) % n]
        k = max(1, int(np.ceil(np.linalg.norm(q - p) / maxlen)))
        for j in range(k):
            out.append(p + (q - p) * j / k)
    return np.array(out)


# ---------- triangulation de face avec trous ----------
def triangulate(outer, holes, maxlen=4.0):
    loops = [_ccw(_densify(outer, maxlen))] + [_cw(_densify(h, maxlen)) for h in holes]
    for _ in range(40):
        pts = np.vstack(loops)
        offs = np.cumsum([0] + [len(l) for l in loops])
        tri = Delaunay(pts)
        simp = tri.simplices
        cen = pts[simp].mean(axis=1)
        inside = Path(loops[0]).contains_points(cen)
        for h in loops[1:]:
            inside &= ~Path(h).contains_points(cen)
        simp = simp[inside]
        e = np.sort(np.concatenate([simp[:, [0, 1]], simp[:, [1, 2]], simp[:, [2, 0]]]), axis=1)
        ekey = set((e[:, 0].astype(np.int64) * 1000003 + e[:, 1]).tolist())
        missing = False
        new_loops = []
        for li, l in enumerate(loops):
            base = offs[li]
            nn = len(l)
            a = base + np.arange(nn)
            b = base + (np.arange(nn) + 1) % nn
            k = np.minimum(a, b).astype(np.int64) * 1000003 + np.maximum(a, b)
            ok = np.array([kk in ekey for kk in k.tolist()])
            if ok.all():
                new_loops.append(l)
                continue
            missing = True
            nl = []
            for i in range(nn):
                nl.append(l[i])
                if not ok[i]:
                    nl.append((l[i] + l[(i + 1) % nn]) / 2)
            new_loops.append(np.array(nl))
        if not missing:
            # orientation des triangles : CCW (normale +z)
            p = pts[simp]
            cr = (p[:, 1, 0] - p[:, 0, 0]) * (p[:, 2, 1] - p[:, 0, 1]) - (p[:, 1, 1] - p[:, 0, 1]) * (p[:, 2, 0] - p[:, 0, 0])
            simp = np.where((cr < 0)[:, None], simp[:, [0, 2, 1]], simp)
            simp = simp[np.abs(cr) > 1e-12]
            return pts, simp, loops
        loops = new_loops
    raise RuntimeError("triangulation impossible")


def extrude(outer, holes, z0, z1, maxlen=4.0):
    pts, simp, loops = triangulate(outer, holes, maxlen)
    tris = []
    P0 = np.c_[pts, np.full(len(pts), z0)]
    P1 = np.c_[pts, np.full(len(pts), z1)]
    tris.append(P1[simp])                 # dessus (normale +z)
    tris.append(P0[simp[:, [0, 2, 1]]])   # dessous (normale -z)
    for l in loops:  # extérieur CCW, trous CW -> normales sortantes
        a = l
        b = np.roll(l, -1, axis=0)
        a0, b0 = np.c_[a, np.full(len(a), z0)], np.c_[b, np.full(len(b), z0)]
        a1, b1 = np.c_[a, np.full(len(a), z1)], np.c_[b, np.full(len(b), z1)]
        tris.append(np.stack([a0, b0, b1], axis=1))
        tris.append(np.stack([a0, b1, a1], axis=1))
    return np.concatenate(tris)


def tube(r_out, r_in, z0, z1, cx=0.0, cy=0.0, n=40):
    holes = [circle(r_in, cx, cy, n)] if r_in > 0 else []
    return extrude(circle(r_out, cx, cy, n), holes, z0, z1, maxlen=50)


def box(x0, x1, y0, y1, z0, z1):
    return extrude(rect(x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2), [], z0, z1, maxlen=1000)


# ---------- transformations ----------
def xform(tris, R=np.eye(3), T=np.zeros(3)):
    out = tris @ np.asarray(R).T + np.asarray(T)
    if np.linalg.det(R) < 0:
        out = out[:, [0, 2, 1]]
    return out


def rot_x(deg):
    a = np.radians(deg)
    return np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])


def rot_y(deg):
    a = np.radians(deg)
    return np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])


# ---------- contrôle & export ----------
def check_closed(tris, name):
    v = np.round(tris.reshape(-1, 3), 5)
    uniq, inv = np.unique(v, axis=0, return_inverse=True)
    f = inv.reshape(-1, 3)
    e = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), axis=1)
    _, cnt = np.unique(e, axis=0, return_counts=True)
    bad = int(np.sum(cnt % 2 == 1))
    vol = float(np.sum(np.einsum('ij,ij->i', tris[:, 0], np.cross(tris[:, 1], tris[:, 2]))) / 6)
    return bad, vol


def write_stl(path, tris):
    tris = np.asarray(tris, dtype=np.float32)
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    n = np.where(ln > 0, n / np.maximum(ln, 1e-12), 0).astype(np.float32)
    rec = np.zeros(len(tris), dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')])
    rec['n'] = n
    rec['v'] = tris
    with open(path, 'wb') as fh:
        fh.write(b'The Deck - boitier'.ljust(80, b' '))
        fh.write(np.uint32(len(tris)).tobytes())
        fh.write(rec.tobytes())
