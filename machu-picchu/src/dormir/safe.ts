// TikTok-safe layout (same as the previous shorts): the top bar covers y < 200, the like/comment/share
// column covers x > 950 from y ≈ 700, the description covers y > 1400.
export const SAFE = {
  captions: { bottom: 520, fontSize: 80, maxWidth: 820, shiftX: -40 },
  /** Characters' feet should sit around here so the captions don't cover the bodies. */
  feetY: 1260,
};
