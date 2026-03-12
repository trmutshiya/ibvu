// ── Fractal Tree Generator ────────────────────────────────────────────────
export function generateBranches(x, y, angleDeg, length, depth, maxDepth, acc = []) {
  if (depth < 0 || length < 2) return acc;
  const rad = (angleDeg * Math.PI) / 180;
  const x2  = x + Math.sin(rad) * length;
  const y2  = y - Math.cos(rad) * length;
  const level = maxDepth - depth;
  const t = level / maxDepth;
  acc.push({
    id: acc.length,
    x1: x, y1: y, x2, y2,
    level,
    sw:    Math.max(0.5, ((depth + 1) / (maxDepth + 1)) * 7.5),
    len:   Math.hypot(x2 - x, y2 - y),
    color: `rgb(${Math.round(107-15*t)},${Math.round(76+46*t)},${Math.round(53+39*t)})`,
    isLeaf: depth === 0,
  });
  generateBranches(x2, y2, angleDeg - 25, length * 0.70, depth - 1, maxDepth, acc);
  generateBranches(x2, y2, angleDeg + 25, length * 0.70, depth - 1, maxDepth, acc);
  return acc;
}

export const MAX_DEPTH  = 7;
export const BRANCHES   = generateBranches(150, 290, 0, 68, MAX_DEPTH, MAX_DEPTH);
export const TREE_START = 5.8;
export const LEVEL_DUR  = 0.44;
export const BRANCH_DUR = 0.32;
export const LEAVES_AT  = TREE_START + (MAX_DEPTH * LEVEL_DUR) + BRANCH_DUR + 0.1;
// ENTER_AT = LEAVES_AT + 1.4 = 10.7s — also hardcoded in index.css for .brand-nav
export const ENTER_AT   = LEAVES_AT + 1.4;

export const MOTES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x:     Math.random() * 100,
  y:     10 + Math.random() * 75,
  size:  1 + Math.random() * 2.5,
  dur:   (3 + Math.random() * 5).toFixed(1) + "s",
  delay: (Math.random() * 8).toFixed(1) + "s",
}));

export const IMPACT_Y = 314;
export const DROPLETS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
  const dist  = 14 + Math.random() * 30;
  return {
    id:    i,
    left:  150 + Math.cos(angle) * 4,
    top:   IMPACT_Y + Math.random() * 4,
    size:  1.5 + Math.random() * 2.5,
    dx:    (Math.cos(angle) * dist).toFixed(0) + "px",
    dy:    (-3 - Math.random() * 9).toFixed(0) + "px",
    dur:   (0.3 + Math.random() * 0.45).toFixed(2) + "s",
    delay: (4.55 + Math.random() * 0.5).toFixed(2) + "s",
  };
});
