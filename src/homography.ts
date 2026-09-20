/** Row-major 3×3 homography. Maps camera (x,y,1) → screen (u,v,w). */
export type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface Pair {
  src: { x: number; y: number };
  dst: { x: number; y: number };
}

export function applyHomography(H: Homography, p: { x: number; y: number }): { x: number; y: number } | null {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  if (Math.abs(w) < 1e-10) return null;
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
  };
}

/**
 * Direct linear transform for 4+ point correspondences.
 * Destination and source are both in the same units (typically 0..1).
 */
export function computeHomography(pairs: Pair[]): Homography | null {
  if (pairs.length < 4) return null;
  const rows = pairs.length * 2;
  const A: number[][] = [];
  const b: number[] = [];

  for (const { src, dst } of pairs) {
    const { x, y } = src;
    const u = dst.x;
    const v = dst.y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  if (rows === 8) {
    const h = solveSquare(A, b);
    if (!h) return null;
    return [...h, 1] as unknown as Homography;
  }

  const h = solveLeastSquares(A, b);
  if (!h) return null;
  return [...h, 1] as unknown as Homography;
}

export function reprojectionError(H: Homography, pairs: Pair[]): number {
  let acc = 0;
  for (const pair of pairs) {
    const p = applyHomography(H, pair.src);
    if (!p) return Number.POSITIVE_INFINITY;
    acc += (p.x - pair.dst.x) ** 2 + (p.y - pair.dst.y) ** 2;
  }
  return Math.sqrt(acc / pairs.length);
}

function solveSquare(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => {
    const rhs = b[i];
    if (rhs === undefined) throw new Error("b length");
    return [...row, rhs];
  });

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(M[col]?.[col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r]?.[col] ?? 0);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-12) return null;
    const prow = M[pivot]!;
    const crow = M[col]!;
    M[col] = prow;
    M[pivot] = crow;

    const div = M[col]![col]!;
    for (let j = col; j <= n; j++) M[col]![j] = M[col]![j]! / div;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]!;
      if (f === 0) continue;
      for (let j = col; j <= n; j++) M[r]![j] = M[r]![j]! - f * M[col]![j]!;
    }
  }

  return M.map((row) => row[n]!);
}

/** Normal equations AᵀA x = Aᵀb for overdetermined DLT. */
function solveLeastSquares(A: number[][], b: number[]): number[] | null {
  const n = A[0]?.length ?? 0;
  if (!n) return null;
  const ATA: number[][] = [];
  const ATb: number[] = [];
  for (let c = 0; c < n; c++) {
    ATb.push(0);
    ATA.push(Array.from({ length: n }, () => 0));
  }

  for (let i = 0; i < A.length; i++) {
    const row = A[i];
    const bi = b[i];
    if (!row || bi === undefined) continue;
    for (let c = 0; c < n; c++) {
      const rc = row[c] ?? 0;
      ATb[c] = (ATb[c] ?? 0) + rc * bi;
      const dest = ATA[c];
      if (!dest) continue;
      for (let k = 0; k < n; k++) {
        dest[k] = (dest[k] ?? 0) + rc * (row[k] ?? 0);
      }
    }
  }
  return solveSquare(ATA, ATb);
}
