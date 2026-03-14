/**
 * Draw a baby animal character on a canvas context.
 * Each animal has a colored body, drawn at a given x position standing on groundY.
 * Supports 10 animal types with front-facing and side-facing poses.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x         - centre X
 * @param {number} groundY   - Y of ground / floor the animal stands on
 * @param {string} color     - theme colour for body
 * @param {string} name      - label drawn above head
 * @param {number} scale     - uniform scale (default 1)
 * @param {object} [motion]  - optional motion info
 * @param {number} motion.facing  - -1 = left, 0 = forward, 1 = right
 * @param {number} motion.walkPhase - 0-1 cyclic phase for leg/body animation
 * @param {string} animalType - 'puppy'|'kitten'|'elephant'|'horse'|'cow'|'bunny'|'duck'|'penguin'|'frog'|'bear'
 * @param {boolean} underwater - when true, overlay scuba mask and bubble trail
 */
export function drawAnimalCharacter(ctx, x, groundY, color, name, scale = 1, motion, animalType, underwater) {
  const s = scale;
  const facing = motion ? motion.facing : 0;
  const walkPhase = motion ? motion.walkPhase : 0;

  const drawFn = _animalDrawers[animalType] || _animalDrawers.puppy;

  ctx.save();

  if (facing !== 0) {
    // Side-facing: mirror for left
    if (facing === -1) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    drawFn.side(ctx, x, groundY, color, s, walkPhase);
  } else {
    drawFn.front(ctx, x, groundY, color, s, walkPhase);
  }

  // Underwater overlay (scuba mask + bubbles) drawn before restore so it flips with facing
  if (underwater) {
    const headTop = drawFn.headTop(groundY, s);
    const headCenterY = headTop + drawFn.headH(s) * 0.4;
    _drawScubaMask(ctx, x, headCenterY, s);
    _drawBubbles(ctx, x, headTop, s, walkPhase);
  }

  ctx.restore();

  // Name label drawn after restore so it is never mirrored
  const headTop = drawFn.headTop(groundY, s);
  ctx.save();
  _drawNameLabel(ctx, x, headTop, color, name, s);
  ctx.restore();
}

// ────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────

/** Draw the name label above the head */
function _drawNameLabel(ctx, x, headTop, color, name, s) {
  ctx.font = `bold ${11 * s}px sans-serif`;
  ctx.textAlign = 'center';
  const labelY = headTop - 8 * s;
  const metrics = ctx.measureText(name);
  const pad = 3;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(x - metrics.width / 2 - pad, labelY - 10, metrics.width + pad * 2, 14);
  ctx.fillStyle = color;
  ctx.fillText(name, x, labelY);
}

/** Helper: draw a rounded rectangle path */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw two simple black eyes with white highlights */
function _drawEyes(ctx, leftX, rightX, eyeY, radius, s) {
  // Black eye circles
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(leftX, eyeY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rightX, eyeY, radius, 0, Math.PI * 2);
  ctx.fill();
  // White highlights
  ctx.fillStyle = '#fff';
  const hlOff = radius * 0.3;
  const hlR = radius * 0.4;
  ctx.beginPath();
  ctx.arc(leftX - hlOff, eyeY - hlOff, hlR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rightX - hlOff, eyeY - hlOff, hlR, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw a single side-facing eye */
function _drawSideEye(ctx, eyeX, eyeY, radius, s) {
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(eyeX - radius * 0.3, eyeY - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw scuba mask goggles over eyes */
function _drawScubaMask(ctx, x, eyeY, s) {
  // Goggles band
  ctx.fillStyle = 'rgba(0, 200, 255, 0.5)';
  _roundRect(ctx, x - 12 * s, eyeY - 5 * s, 24 * s, 10 * s, 3 * s);
  ctx.fill();
  // Goggle rims
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.2 * s;
  _roundRect(ctx, x - 12 * s, eyeY - 5 * s, 24 * s, 10 * s, 3 * s);
  ctx.stroke();
  // Tube on top
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x + 10 * s, eyeY - 5 * s);
  ctx.lineTo(x + 12 * s, eyeY - 14 * s);
  ctx.lineTo(x + 14 * s, eyeY - 16 * s);
  ctx.stroke();
  // Tube mouthpiece
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.arc(x + 14 * s, eyeY - 16 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw bubble trail above head */
function _drawBubbles(ctx, x, headTop, s, walkPhase) {
  ctx.fillStyle = 'rgba(150, 220, 255, 0.6)';
  ctx.strokeStyle = 'rgba(100, 180, 240, 0.5)';
  ctx.lineWidth = 0.5 * s;
  const bubbles = [
    { dx: -3, dy: -12, r: 2 },
    { dx: 4, dy: -18, r: 1.5 },
    { dx: 0, dy: -25, r: 2.5 },
  ];
  for (const b of bubbles) {
    const bx = x + b.dx * s + Math.sin(walkPhase * Math.PI * 2 + b.dy) * 2 * s;
    const by = headTop + b.dy * s - Math.abs(Math.sin(walkPhase * Math.PI * 2 + b.dx)) * 3 * s;
    ctx.beginPath();
    ctx.arc(bx, by, b.r * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Darken a CSS color string by mixing with black */
function _darken(color, amount) {
  // Quick approach: use rgba overlay
  return color; // fallback — animals use explicit darker shades where needed
}

/** Simple stubby legs for front-facing quadrupeds */
function _drawFrontLegs(ctx, x, legsTop, legW, legH, legGap, s, legColor) {
  ctx.fillStyle = legColor;
  // Back pair (inner)
  _roundRect(ctx, x - legGap - legW / 2, legsTop, legW, legH, 2 * s);
  ctx.fill();
  _roundRect(ctx, x + legGap - legW / 2, legsTop, legW, legH, 2 * s);
  ctx.fill();
}

// ────────────────────────────────────────────────────────
// PUPPY
// ────────────────────────────────────────────────────────

const _puppy = {
  headH: (s) => 14 * s,
  headTop: (groundY, s) => groundY - 50 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 24 * s, bodyH = 18 * s;
    const headR = 10 * s;
    const legW = 5 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCY = bodyTop - 4 * s;

    // Legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 8 * s, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 3 * s, legsTop, legW, legH, 2 * s); ctx.fill();

    // Tail (wags with walkPhase)
    const tailWag = Math.sin(walkPhase * Math.PI * 2) * 8 * s;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 12 * s, bodyTop + 5 * s);
    ctx.quadraticCurveTo(x + 18 * s + tailWag, bodyTop - 2 * s, x + 16 * s + tailWag, bodyTop - 8 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 6 * s);
    ctx.fill();

    // Belly highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.6, 8 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (round)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Floppy ears
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x - 10 * s, headCY + 2 * s, 5 * s, 8 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 10 * s, headCY + 2 * s, 5 * s, 8 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Ear inner (slightly darker)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x - 10 * s, headCY + 3 * s, 3 * s, 5 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 10 * s, headCY + 3 * s, 3 * s, 5 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, headCY + 4 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(x, headCY + 2 * s, 2.5 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tongue (sticking out)
    ctx.fillStyle = '#ff8ca0';
    ctx.beginPath();
    ctx.ellipse(x, headCY + 7 * s, 2 * s, 3 * s, 0, 0, Math.PI);
    ctx.fill();

    // Eyes
    _drawEyes(ctx, x - 4 * s, x + 4 * s, headCY - 3 * s, 2 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 26 * s, bodyH = 16 * s;
    const headR = 9 * s;
    const legW = 4 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCX = x + 10 * s, headCY = bodyTop - 2 * s;

    const phase = walkPhase * Math.PI * 2;
    const legSwing = Math.sin(phase) * 6 * s;

    // Tail wag
    const tailWag = Math.sin(phase) * 6 * s;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 13 * s, bodyTop + 4 * s);
    ctx.quadraticCurveTo(x - 18 * s, bodyTop - 4 * s + tailWag, x - 16 * s, bodyTop - 10 * s + tailWag);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Back legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 8 * s + (-legSwing * 0.5), legsTop, legW, legH, 2 * s); ctx.fill();
    // Front legs
    _roundRect(ctx, x + 6 * s + legSwing, legsTop, legW, legH, 2 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 5 * s);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.7, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Ear (floppy, one visible from side)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(headCX - 2 * s, headCY - 4 * s, 4 * s, 7 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(headCX - 2 * s, headCY - 3 * s, 2.5 * s, 4.5 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(headCX + 5 * s, headCY + 2 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(headCX + 9 * s, headCY + 1 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Tongue
    ctx.fillStyle = '#ff8ca0';
    ctx.beginPath();
    ctx.ellipse(headCX + 7 * s, headCY + 5 * s, 1.5 * s, 2.5 * s, 0.3, 0, Math.PI);
    ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 2 * s, headCY - 2 * s, 2 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// KITTEN
// ────────────────────────────────────────────────────────

const _kitten = {
  headH: (s) => 14 * s,
  headTop: (groundY, s) => groundY - 50 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 20 * s, bodyH = 18 * s;
    const headW = 16 * s, headH = 14 * s;
    const legW = 4 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headTop = bodyTop - headH + 2 * s;

    // Curled tail (visible from front, to the side)
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 10 * s, bodyTop + 10 * s);
    ctx.quadraticCurveTo(x + 18 * s, bodyTop + 5 * s, x + 16 * s, bodyTop - 2 * s);
    ctx.quadraticCurveTo(x + 14 * s, bodyTop - 6 * s, x + 10 * s, bodyTop - 3 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Legs (sitting pose)
    ctx.fillStyle = color;
    _roundRect(ctx, x - 7 * s, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 3 * s, legsTop, legW, legH, 2 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 5 * s);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.55, 6 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (slightly triangular = wider at bottom)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, headTop);
    ctx.quadraticCurveTo(x + headW / 2 + 2 * s, headTop + 2 * s, x + headW / 2, headTop + headH);
    ctx.lineTo(x - headW / 2, headTop + headH);
    ctx.quadraticCurveTo(x - headW / 2 - 2 * s, headTop + 2 * s, x, headTop);
    ctx.fill();

    // Fill to make it look rounder
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH * 0.55, headW / 2, headH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed ears
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 8 * s, headTop + 4 * s);
    ctx.lineTo(x - 6 * s, headTop - 6 * s);
    ctx.lineTo(x - 2 * s, headTop + 2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, headTop + 4 * s);
    ctx.lineTo(x + 6 * s, headTop - 6 * s);
    ctx.lineTo(x + 2 * s, headTop + 2 * s);
    ctx.closePath();
    ctx.fill();

    // Ear inner
    ctx.fillStyle = '#ffb6c1';
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, headTop + 3 * s);
    ctx.lineTo(x - 6 * s, headTop - 3 * s);
    ctx.lineTo(x - 3 * s, headTop + 2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 7 * s, headTop + 3 * s);
    ctx.lineTo(x + 6 * s, headTop - 3 * s);
    ctx.lineTo(x + 3 * s, headTop + 2 * s);
    ctx.closePath();
    ctx.fill();

    // Muzzle
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH * 0.7, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose (tiny pink triangle)
    ctx.fillStyle = '#ff9eaf';
    ctx.beginPath();
    ctx.moveTo(x, headTop + headH * 0.55);
    ctx.lineTo(x - 1.5 * s, headTop + headH * 0.65);
    ctx.lineTo(x + 1.5 * s, headTop + headH * 0.65);
    ctx.closePath();
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x, headTop + headH * 0.65);
    ctx.lineTo(x - 2 * s, headTop + headH * 0.75);
    ctx.moveTo(x, headTop + headH * 0.65);
    ctx.lineTo(x + 2 * s, headTop + headH * 0.75);
    ctx.stroke();

    // Whiskers
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.7 * s;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + side * 5 * s, headTop + headH * 0.65 + i * 2 * s);
        ctx.lineTo(x + side * 14 * s, headTop + headH * 0.6 + i * 3 * s);
        ctx.stroke();
      }
    }

    // Eyes
    _drawEyes(ctx, x - 4 * s, x + 4 * s, headTop + headH * 0.4, 2.2 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 24 * s, bodyH = 14 * s;
    const headR = 8 * s;
    const legW = 3.5 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCX = x + 9 * s, headCY = bodyTop;

    const phase = walkPhase * Math.PI * 2;
    const legSwing = Math.sin(phase) * 5 * s;

    // Tail (curves up)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, bodyTop + 6 * s);
    ctx.quadraticCurveTo(x - 18 * s, bodyTop - 5 * s, x - 14 * s, bodyTop - 10 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 7 * s - legSwing * 0.4, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 5 * s + legSwing, legsTop, legW, legH, 2 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 5 * s);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Pointed ear
    ctx.beginPath();
    ctx.moveTo(headCX - 2 * s, headCY - 5 * s);
    ctx.lineTo(headCX + 1 * s, headCY - 12 * s);
    ctx.lineTo(headCX + 4 * s, headCY - 5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb6c1';
    ctx.beginPath();
    ctx.moveTo(headCX - 0.5 * s, headCY - 6 * s);
    ctx.lineTo(headCX + 1 * s, headCY - 10 * s);
    ctx.lineTo(headCX + 2.5 * s, headCY - 6 * s);
    ctx.closePath();
    ctx.fill();

    // Muzzle
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(headCX + 5 * s, headCY + 2 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#ff9eaf';
    ctx.beginPath();
    ctx.arc(headCX + 8 * s, headCY + 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.7 * s;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(headCX + 6 * s, headCY + 2 * s + i * 2 * s);
      ctx.lineTo(headCX + 15 * s, headCY + 1 * s + i * 3 * s);
      ctx.stroke();
    }

    // Eye
    _drawSideEye(ctx, headCX + 2 * s, headCY - 2 * s, 2 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// ELEPHANT
// ────────────────────────────────────────────────────────

const _elephant = {
  headH: (s) => 16 * s,
  headTop: (groundY, s) => groundY - 52 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 28 * s, bodyH = 18 * s;
    const headR = 10 * s;
    const legW = 6 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCY = bodyTop - 6 * s;

    // Legs (thick stubby)
    ctx.fillStyle = color;
    _roundRect(ctx, x - 10 * s, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 4 * s, legsTop, legW, legH, 2 * s); ctx.fill();

    // Toenails
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - 7 * s, feetY - 1 * s, 2 * s, Math.PI, 0); ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 7 * s, feetY - 1 * s, 2 * s, Math.PI, 0); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 7 * s);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.6, 10 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Big floppy ears (semicircles)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x - 14 * s, headCY + 2 * s, 8 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 14 * s, headCY + 2 * s, 8 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ear inner
    ctx.fillStyle = 'rgba(255,200,200,0.3)';
    ctx.beginPath();
    ctx.ellipse(x - 14 * s, headCY + 3 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 14 * s, headCY + 3 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Trunk (hangs down center)
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, headCY + 6 * s);
    ctx.quadraticCurveTo(x + 2 * s, headCY + 14 * s, x - 2 * s, headCY + 18 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Trunk tip
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 2 * s, headCY + 18 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    _drawEyes(ctx, x - 5 * s, x + 5 * s, headCY - 2 * s, 2 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 28 * s, bodyH = 16 * s;
    const headR = 9 * s;
    const legW = 5 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCX = x + 10 * s, headCY = bodyTop;

    const phase = walkPhase * Math.PI * 2;
    const legSwing = Math.sin(phase) * 4 * s;

    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, bodyTop + 4 * s);
    ctx.lineTo(x - 18 * s, bodyTop + 1 * s);
    ctx.stroke();
    // Tail tuft
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 18 * s, bodyTop + 1 * s);
    ctx.lineTo(x - 19 * s, bodyTop - 1 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Back legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 9 * s - legSwing * 0.4, legsTop, legW, legH, 2 * s); ctx.fill();
    // Front legs
    _roundRect(ctx, x + 6 * s + legSwing, legsTop, legW, legH, 2 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 6 * s);
    ctx.fill();

    // Big ear (one visible)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(headCX - 4 * s, headCY + 2 * s, 7 * s, 10 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,200,0.3)';
    ctx.beginPath();
    ctx.ellipse(headCX - 4 * s, headCY + 3 * s, 4 * s, 7 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Trunk (side view — curves forward and down)
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(headCX + 7 * s, headCY + 2 * s);
    ctx.quadraticCurveTo(headCX + 14 * s, headCY + 6 * s, headCX + 12 * s, headCY + 14 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Eye
    _drawSideEye(ctx, headCX + 3 * s, headCY - 2 * s, 2 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// HORSE
// ────────────────────────────────────────────────────────

const _horse = {
  headH: (s) => 16 * s,
  headTop: (groundY, s) => groundY - 52 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 22 * s, bodyH = 18 * s;
    const headW = 12 * s, headH = 16 * s;
    const legW = 4 * s, legH = 12 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headTop = bodyTop - headH + 2 * s;

    // Legs (thinner)
    ctx.fillStyle = color;
    _roundRect(ctx, x - 8 * s, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 4 * s, legsTop, legW, legH, 2 * s); ctx.fill();

    // Hooves
    ctx.fillStyle = '#444';
    _roundRect(ctx, x - 9 * s, feetY - 3 * s, legW + 2 * s, 3 * s, 1 * s); ctx.fill();
    _roundRect(ctx, x + 3 * s, feetY - 3 * s, legW + 2 * s, 3 * s, 1 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 5 * s);
    ctx.fill();

    // Head (oval, longer face)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH / 2, headW / 2, headH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mane (zigzag on top of head)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, headTop - 2 * s);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(x + (i % 2 === 0 ? 3 : -3) * s, headTop + i * 3 * s);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Upright ears
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, headTop + 2 * s);
    ctx.lineTo(x - 4 * s, headTop - 7 * s);
    ctx.lineTo(x - 1 * s, headTop + 1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 5 * s, headTop + 2 * s);
    ctx.lineTo(x + 4 * s, headTop - 7 * s);
    ctx.lineTo(x + 1 * s, headTop + 1 * s);
    ctx.closePath();
    ctx.fill();

    // Nostrils
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(x - 2 * s, headTop + headH * 0.75, 1.2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2 * s, headTop + headH * 0.75, 1.2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    _drawEyes(ctx, x - 4 * s, x + 4 * s, headTop + headH * 0.35, 1.8 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 26 * s, bodyH = 15 * s;
    const headW = 10 * s, headH = 14 * s;
    const legW = 3.5 * s, legH = 12 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCX = x + 12 * s, headCY = bodyTop - 2 * s;

    const phase = walkPhase * Math.PI * 2;
    const legSwing = Math.sin(phase) * 6 * s;

    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 13 * s, bodyTop + 3 * s);
    ctx.quadraticCurveTo(x - 20 * s, bodyTop + 8 * s, x - 18 * s, bodyTop + 16 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Back legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 8 * s - legSwing * 0.4, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x - 3 * s + legSwing * 0.4, legsTop, legW, legH, 2 * s); ctx.fill();
    // Front legs
    _roundRect(ctx, x + 5 * s + legSwing, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 10 * s - legSwing, legsTop, legW, legH, 2 * s); ctx.fill();

    // Hooves
    ctx.fillStyle = '#444';
    const hoofPositions = [x - 8 * s - legSwing * 0.4, x - 3 * s + legSwing * 0.4, x + 5 * s + legSwing, x + 10 * s - legSwing];
    for (const hx of hoofPositions) {
      _roundRect(ctx, hx - 0.5 * s, feetY - 2.5 * s, legW + 1 * s, 2.5 * s, 1 * s);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 5 * s);
    ctx.fill();

    // Mane (along neck)
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const mx = x + 6 * s + i * 1.5 * s;
      const my = bodyTop - 2 * s + i * 3 * s;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx + (i % 2 === 0 ? 2 : -2) * s, my);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Head (oval)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(headCX, headCY, headW / 2, headH / 2, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.beginPath();
    ctx.moveTo(headCX + 1 * s, headCY - 6 * s);
    ctx.lineTo(headCX + 3 * s, headCY - 12 * s);
    ctx.lineTo(headCX + 5 * s, headCY - 6 * s);
    ctx.closePath();
    ctx.fill();

    // Nostril
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(headCX + 5 * s, headCY + 4 * s, 1 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 1 * s, headCY - 2 * s, 1.8 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// COW
// ────────────────────────────────────────────────────────

const _cow = {
  headH: (s) => 14 * s,
  headTop: (groundY, s) => groundY - 50 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 28 * s, bodyH = 18 * s;
    const headW = 18 * s, headH = 14 * s;
    const legW = 5 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headTop = bodyTop - headH + 2 * s;

    // Legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 10 * s, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 5 * s, legsTop, legW, legH, 2 * s); ctx.fill();

    // Hooves
    ctx.fillStyle = '#444';
    _roundRect(ctx, x - 11 * s, feetY - 3 * s, legW + 2 * s, 3 * s, 1 * s); ctx.fill();
    _roundRect(ctx, x + 4 * s, feetY - 3 * s, legW + 2 * s, 3 * s, 1 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 6 * s);
    ctx.fill();

    // Spots (2-3 irregular patches)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - 6 * s, bodyTop + 6 * s, 5 * s, 4 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7 * s, bodyTop + 10 * s, 4 * s, 3 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * s, bodyTop + 5 * s, 3 * s, 3.5 * s, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Head (wide)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH / 2, headW / 2, headH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // White face blaze
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH * 0.5, 4 * s, headH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = '#c8b87a';
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, headTop + 2 * s);
    ctx.lineTo(x - 8 * s, headTop - 5 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6 * s, headTop + 2 * s);
    ctx.lineTo(x + 8 * s, headTop - 5 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Muzzle
    ctx.fillStyle = 'rgba(255,220,200,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH * 0.72, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nostrils
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(x - 2 * s, headTop + headH * 0.73, 1 * s, 1.3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2 * s, headTop + headH * 0.73, 1 * s, 1.3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    _drawEyes(ctx, x - 5 * s, x + 5 * s, headTop + headH * 0.38, 2 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 30 * s, bodyH = 16 * s;
    const headR = 8 * s;
    const legW = 4.5 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCX = x + 12 * s, headCY = bodyTop - 1 * s;

    const phase = walkPhase * Math.PI * 2;
    const legSwing = Math.sin(phase) * 4 * s;

    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 15 * s, bodyTop + 4 * s);
    ctx.quadraticCurveTo(x - 20 * s, bodyTop + 8 * s, x - 18 * s, bodyTop + 14 * s);
    ctx.stroke();
    // Tail tuft
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 18 * s, bodyTop + 14 * s);
    ctx.lineTo(x - 19 * s, bodyTop + 16 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 9 * s - legSwing * 0.4, legsTop, legW, legH, 2 * s); ctx.fill();
    _roundRect(ctx, x + 6 * s + legSwing, legsTop, legW, legH, 2 * s); ctx.fill();

    // Hooves
    ctx.fillStyle = '#444';
    _roundRect(ctx, x - 10 * s - legSwing * 0.4, feetY - 2.5 * s, legW + 2 * s, 2.5 * s, 1 * s); ctx.fill();
    _roundRect(ctx, x + 5 * s + legSwing, feetY - 2.5 * s, legW + 2 * s, 2.5 * s, 1 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 6 * s);
    ctx.fill();

    // Spots
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - 4 * s, bodyTop + 6 * s, 5 * s, 4 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x + 5 * s, bodyTop + 10 * s, 3.5 * s, 3 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Horn
    ctx.strokeStyle = '#c8b87a';
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(headCX + 2 * s, headCY - 6 * s);
    ctx.lineTo(headCX + 4 * s, headCY - 12 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Muzzle
    ctx.fillStyle = 'rgba(255,220,200,0.5)';
    ctx.beginPath();
    ctx.ellipse(headCX + 6 * s, headCY + 3 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nostril
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(headCX + 9 * s, headCY + 3 * s, 1 * s, 1.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 2 * s, headCY - 2 * s, 2 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// BUNNY
// ────────────────────────────────────────────────────────

const _bunny = {
  headH: (s) => 14 * s,
  headTop: (groundY, s) => groundY - 52 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 20 * s, bodyH = 16 * s;
    const headR = 9 * s;
    const legW = 5 * s, legH = 8 * s;
    const feetY = groundY;

    // Hop motion — body bobs up
    const hopOffset = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 4 * s;

    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH + hopOffset;
    const headCY = bodyTop - 5 * s;

    // Big feet
    ctx.fillStyle = color;
    _roundRect(ctx, x - 10 * s, feetY - 4 * s, 8 * s, 4 * s, 2 * s); ctx.fill();
    _roundRect(ctx, x + 2 * s, feetY - 4 * s, 8 * s, 4 * s, 2 * s); ctx.fill();

    // Legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 7 * s, legsTop, legW, legH - hopOffset, 2 * s); ctx.fill();
    _roundRect(ctx, x + 2 * s, legsTop, legW, legH - hopOffset, 2 * s); ctx.fill();

    // Cotton-ball tail (visible peeking from side)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 12 * s, bodyTop + bodyH * 0.6, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 7 * s);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.6, 6 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Tall upright ears (two long ovals)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x - 5 * s, headCY - 16 * s, 3.5 * s, 10 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 5 * s, headCY - 16 * s, 3.5 * s, 10 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Ear inner (pink)
    ctx.fillStyle = '#ffb6c1';
    ctx.beginPath();
    ctx.ellipse(x - 5 * s, headCY - 15 * s, 2 * s, 7 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 5 * s, headCY - 15 * s, 2 * s, 7 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Cheek fluffs
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x - 7 * s, headCY + 1 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7 * s, headCY + 1 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose (small pink)
    ctx.fillStyle = '#ff9eaf';
    ctx.beginPath();
    ctx.ellipse(x, headCY + 3 * s, 2 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (Y shape)
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 0.7 * s;
    ctx.beginPath();
    ctx.moveTo(x, headCY + 4.5 * s);
    ctx.lineTo(x, headCY + 6 * s);
    ctx.moveTo(x, headCY + 6 * s);
    ctx.lineTo(x - 2 * s, headCY + 7 * s);
    ctx.moveTo(x, headCY + 6 * s);
    ctx.lineTo(x + 2 * s, headCY + 7 * s);
    ctx.stroke();

    // Buck teeth
    ctx.fillStyle = '#fff';
    _roundRect(ctx, x - 1.5 * s, headCY + 4.5 * s, 1.5 * s, 2 * s, 0.5 * s); ctx.fill();
    _roundRect(ctx, x, headCY + 4.5 * s, 1.5 * s, 2 * s, 0.5 * s); ctx.fill();

    // Big round eyes
    _drawEyes(ctx, x - 4 * s, x + 4 * s, headCY - 2 * s, 2.5 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 22 * s, bodyH = 14 * s;
    const headR = 8 * s;
    const legW = 4 * s, legH = 8 * s;
    const feetY = groundY;

    const hopOffset = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 4 * s;

    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH + hopOffset;
    const headCX = x + 8 * s, headCY = bodyTop - 3 * s;

    // Cotton-ball tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 12 * s, bodyTop + bodyH * 0.5, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Big back feet
    ctx.fillStyle = color;
    _roundRect(ctx, x - 10 * s, feetY - 4 * s, 9 * s, 4 * s, 2 * s); ctx.fill();
    // Front feet
    _roundRect(ctx, x + 4 * s, feetY - 3 * s, 5 * s, 3 * s, 1.5 * s); ctx.fill();

    // Legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 6 * s, legsTop, legW + 1 * s, legH - hopOffset, 2 * s); ctx.fill();
    _roundRect(ctx, x + 5 * s, legsTop, legW, legH - hopOffset, 2 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 6 * s);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Ear (one tall upright)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(headCX, headCY - 14 * s, 3 * s, 9 * s, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb6c1';
    ctx.beginPath();
    ctx.ellipse(headCX, headCY - 13 * s, 1.8 * s, 6 * s, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#ff9eaf';
    ctx.beginPath();
    ctx.arc(headCX + 7 * s, headCY + 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Buck teeth
    ctx.fillStyle = '#fff';
    _roundRect(ctx, headCX + 5 * s, headCY + 2.5 * s, 1.5 * s, 2 * s, 0.5 * s); ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 3 * s, headCY - 2 * s, 2.2 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// DUCK
// ────────────────────────────────────────────────────────

const _duck = {
  headH: (s) => 12 * s,
  headTop: (groundY, s) => groundY - 48 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 22 * s, bodyH = 18 * s;
    const headR = 8 * s;
    const feetY = groundY;
    const bodyTop = feetY - 6 * s - bodyH;
    const headCY = bodyTop - 4 * s;

    // Waddle — body sways
    const waddle = Math.sin(walkPhase * Math.PI * 2) * 2 * s;

    // Webbed feet (orange)
    ctx.fillStyle = '#e8960c';
    // Left foot
    ctx.beginPath();
    ctx.moveTo(x - 6 * s + waddle, feetY);
    ctx.lineTo(x - 10 * s + waddle, feetY);
    ctx.lineTo(x - 6 * s + waddle, feetY - 3 * s);
    ctx.lineTo(x - 2 * s + waddle, feetY);
    ctx.closePath();
    ctx.fill();
    // Right foot
    ctx.beginPath();
    ctx.moveTo(x + 6 * s + waddle, feetY);
    ctx.lineTo(x + 2 * s + waddle, feetY);
    ctx.lineTo(x + 6 * s + waddle, feetY - 3 * s);
    ctx.lineTo(x + 10 * s + waddle, feetY);
    ctx.closePath();
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#e8960c';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s + waddle, bodyTop + bodyH);
    ctx.lineTo(x - 6 * s + waddle, feetY - 2 * s);
    ctx.moveTo(x + 5 * s + waddle, bodyTop + bodyH);
    ctx.lineTo(x + 6 * s + waddle, feetY - 2 * s);
    ctx.stroke();

    // Body (round)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + waddle, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings (on sides)
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x - 10 * s + waddle, bodyTop + bodyH * 0.45, 4 * s, 8 * s, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 10 * s + waddle, bodyTop + bodyH * 0.45, 4 * s, 8 * s, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // White chest
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + waddle, bodyTop + bodyH * 0.55, 7 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + waddle, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Bill (flat wide, orange/yellow)
    ctx.fillStyle = '#f0a030';
    ctx.beginPath();
    ctx.ellipse(x + waddle, headCY + 5 * s, 5 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bill line
    ctx.strokeStyle = '#c07820';
    ctx.lineWidth = 0.7 * s;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s + waddle, headCY + 5 * s);
    ctx.lineTo(x + 5 * s + waddle, headCY + 5 * s);
    ctx.stroke();

    // Eyes
    _drawEyes(ctx, x - 3 * s + waddle, x + 3 * s + waddle, headCY - 1 * s, 1.8 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 24 * s, bodyH = 16 * s;
    const headR = 7 * s;
    const feetY = groundY;
    const bodyTop = feetY - 6 * s - bodyH;
    const headCX = x + 9 * s, headCY = bodyTop - 2 * s;

    const waddle = Math.sin(walkPhase * Math.PI * 2) * 2 * s;

    // Webbed foot
    ctx.fillStyle = '#e8960c';
    ctx.beginPath();
    ctx.moveTo(x + waddle, feetY);
    ctx.lineTo(x - 4 * s + waddle, feetY);
    ctx.lineTo(x + waddle, feetY - 3 * s);
    ctx.lineTo(x + 6 * s + waddle, feetY);
    ctx.closePath();
    ctx.fill();

    // Leg
    ctx.strokeStyle = '#e8960c';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x + waddle, bodyTop + bodyH);
    ctx.lineTo(x + waddle, feetY - 2 * s);
    ctx.stroke();

    // Tail feathers
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, bodyTop + 6 * s);
    ctx.lineTo(x - 16 * s, bodyTop + 2 * s);
    ctx.lineTo(x - 14 * s, bodyTop + 0 * s);
    ctx.lineTo(x - 10 * s, bodyTop + 4 * s);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x - 2 * s, bodyTop + bodyH * 0.4, 8 * s, 6 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Bill (side view — protruding)
    ctx.fillStyle = '#f0a030';
    ctx.beginPath();
    ctx.moveTo(headCX + 5 * s, headCY + 1 * s);
    ctx.lineTo(headCX + 14 * s, headCY + 2 * s);
    ctx.lineTo(headCX + 14 * s, headCY + 4 * s);
    ctx.lineTo(headCX + 5 * s, headCY + 4 * s);
    ctx.closePath();
    ctx.fill();
    // Bill line
    ctx.strokeStyle = '#c07820';
    ctx.lineWidth = 0.5 * s;
    ctx.beginPath();
    ctx.moveTo(headCX + 5 * s, headCY + 2.5 * s);
    ctx.lineTo(headCX + 14 * s, headCY + 3 * s);
    ctx.stroke();

    // Eye
    _drawSideEye(ctx, headCX + 2 * s, headCY - 1 * s, 1.8 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// PENGUIN
// ────────────────────────────────────────────────────────

const _penguin = {
  headH: (s) => 12 * s,
  headTop: (groundY, s) => groundY - 50 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 20 * s, bodyH = 22 * s;
    const headR = 8 * s;
    const feetY = groundY;
    const bodyTop = feetY - 5 * s - bodyH;
    const headCY = bodyTop - 4 * s;

    const waddle = Math.sin(walkPhase * Math.PI * 2) * 2 * s;

    // Orange feet
    ctx.fillStyle = '#e8860c';
    _roundRect(ctx, x - 8 * s + waddle, feetY - 4 * s, 7 * s, 4 * s, 1.5 * s); ctx.fill();
    _roundRect(ctx, x + 1 * s + waddle, feetY - 4 * s, 7 * s, 4 * s, 1.5 * s); ctx.fill();

    // Body (colored back)
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2 + waddle, bodyTop, bodyW, bodyH, 8 * s);
    ctx.fill();

    // White belly (tuxedo front — always white)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + waddle, bodyTop + bodyH * 0.55, 7 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flippers
    ctx.fillStyle = color;
    // Left flipper
    ctx.beginPath();
    ctx.ellipse(x - 11 * s + waddle, bodyTop + bodyH * 0.4, 3 * s, 9 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Right flipper
    ctx.beginPath();
    ctx.ellipse(x + 11 * s + waddle, bodyTop + bodyH * 0.4, 3 * s, 9 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Head (colored)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + waddle, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // White face patches
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x - 3 * s + waddle, headCY + 1 * s, 3 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 3 * s + waddle, headCY + 1 * s, 3 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beak (small orange triangle)
    ctx.fillStyle = '#f0a030';
    ctx.beginPath();
    ctx.moveTo(x - 2 * s + waddle, headCY + 3 * s);
    ctx.lineTo(x + waddle, headCY + 6 * s);
    ctx.lineTo(x + 2 * s + waddle, headCY + 3 * s);
    ctx.closePath();
    ctx.fill();

    // Eyes
    _drawEyes(ctx, x - 3 * s + waddle, x + 3 * s + waddle, headCY - 1 * s, 1.8 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 16 * s, bodyH = 20 * s;
    const headR = 7 * s;
    const feetY = groundY;
    const bodyTop = feetY - 5 * s - bodyH;
    const headCX = x + 4 * s, headCY = bodyTop - 2 * s;

    const waddle = Math.sin(walkPhase * Math.PI * 2) * 2 * s;

    // Foot
    ctx.fillStyle = '#e8860c';
    _roundRect(ctx, x - 2 * s + waddle, feetY - 4 * s, 8 * s, 4 * s, 1.5 * s); ctx.fill();

    // Body (colored)
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 6 * s);
    ctx.fill();

    // White belly (front half)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + 3 * s, bodyTop + bodyH * 0.5, 5 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flipper
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x - 4 * s, bodyTop + bodyH * 0.4, 3 * s, 8 * s, 0.15 + Math.sin(walkPhase * Math.PI * 2) * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // White cheek patch
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(headCX + 3 * s, headCY + 1 * s, 3 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beak (side — protruding)
    ctx.fillStyle = '#f0a030';
    ctx.beginPath();
    ctx.moveTo(headCX + 5 * s, headCY + 2 * s);
    ctx.lineTo(headCX + 11 * s, headCY + 3.5 * s);
    ctx.lineTo(headCX + 5 * s, headCY + 5 * s);
    ctx.closePath();
    ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 3 * s, headCY - 1 * s, 1.6 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// FROG
// ────────────────────────────────────────────────────────

const _frog = {
  headH: (s) => 12 * s,
  headTop: (groundY, s) => groundY - 46 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 26 * s, bodyH = 14 * s;
    const headW = 24 * s, headH = 12 * s;
    const legW = 5 * s, legH = 8 * s;
    const feetY = groundY;

    // Hop motion
    const hopOffset = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 5 * s;

    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH + hopOffset;
    const headTop = bodyTop - headH + 4 * s;

    // Long back legs (bent)
    ctx.fillStyle = color;
    // Left back leg
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, bodyTop + bodyH);
    ctx.quadraticCurveTo(x - 16 * s, feetY - 2 * s, x - 12 * s, feetY);
    ctx.lineTo(x - 6 * s, feetY);
    ctx.quadraticCurveTo(x - 8 * s, bodyTop + bodyH - 2 * s, x - 10 * s, bodyTop + bodyH);
    ctx.fill();
    // Right back leg
    ctx.beginPath();
    ctx.moveTo(x + 10 * s, bodyTop + bodyH);
    ctx.quadraticCurveTo(x + 16 * s, feetY - 2 * s, x + 12 * s, feetY);
    ctx.lineTo(x + 6 * s, feetY);
    ctx.quadraticCurveTo(x + 8 * s, bodyTop + bodyH - 2 * s, x + 10 * s, bodyTop + bodyH);
    ctx.fill();

    // Webbed toes
    ctx.fillStyle = color;
    for (let side = -1; side <= 1; side += 2) {
      for (let t = -1; t <= 1; t++) {
        ctx.beginPath();
        ctx.arc(x + side * (9 + t * 2) * s, feetY - 1 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Body (wide flat)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,255,200,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.55, 9 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (wide)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, headTop + headH / 2, headW / 2, headH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Big eyes ON TOP of head
    const eyeR = 4 * s;
    // Eye bulges (colored circles)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 7 * s, headTop - 1 * s, eyeR + 1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 7 * s, headTop - 1 * s, eyeR + 1 * s, 0, Math.PI * 2);
    ctx.fill();

    // Actual eyes (big and round)
    _drawEyes(ctx, x - 7 * s, x + 7 * s, headTop - 1 * s, 3 * s, s);

    // Wide smile
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.arc(x, headTop + headH * 0.5, 8 * s, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(x - 2 * s, headTop + headH * 0.35, 1 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2 * s, headTop + headH * 0.35, 1 * s, 0, Math.PI * 2); ctx.fill();
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 24 * s, bodyH = 12 * s;
    const headR = 8 * s;
    const feetY = groundY;

    const hopOffset = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 5 * s;

    const bodyTop = feetY - 8 * s - bodyH + hopOffset;
    const headCX = x + 8 * s, headCY = bodyTop;

    // Back leg (bent, long)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 8 * s, bodyTop + bodyH);
    ctx.quadraticCurveTo(x - 14 * s, feetY - 4 * s, x - 10 * s, feetY);
    ctx.lineTo(x - 4 * s, feetY);
    ctx.quadraticCurveTo(x - 6 * s, bodyTop + bodyH - 2 * s, x - 8 * s, bodyTop + bodyH);
    ctx.fill();

    // Front leg (short)
    ctx.fillStyle = color;
    _roundRect(ctx, x + 6 * s, feetY - 6 * s - hopOffset, 3 * s, 6 * s + hopOffset, 1.5 * s); ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Big eye bulge on top
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX + 2 * s, headCY - 5 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 2 * s, headCY - 5 * s, 2.5 * s, s);

    // Wide mouth line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(headCX + 2 * s, headCY + 4 * s);
    ctx.lineTo(headCX + 10 * s, headCY + 3 * s);
    ctx.stroke();
  },
};

// ────────────────────────────────────────────────────────
// BEAR
// ────────────────────────────────────────────────────────

const _bear = {
  headH: (s) => 14 * s,
  headTop: (groundY, s) => groundY - 52 * s,

  front(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 26 * s, bodyH = 20 * s;
    const headR = 10 * s;
    const legW = 6 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCY = bodyTop - 5 * s;

    // Thick legs
    ctx.fillStyle = color;
    _roundRect(ctx, x - 10 * s, legsTop, legW, legH, 3 * s); ctx.fill();
    _roundRect(ctx, x + 4 * s, legsTop, legW, legH, 3 * s); ctx.fill();

    // Paw pads
    ctx.fillStyle = 'rgba(255,220,180,0.4)';
    ctx.beginPath();
    ctx.ellipse(x - 7 * s, feetY - 2 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7 * s, feetY - 2 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();

    // Small round tail (peeking)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 14 * s, bodyTop + bodyH * 0.7, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Body (stocky round)
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 8 * s);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,230,200,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, bodyTop + bodyH * 0.55, 8 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (round)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Round ears on top
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 8 * s, headCY - 8 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 8 * s, headCY - 8 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    // Ear inner
    ctx.fillStyle = 'rgba(255,200,180,0.4)';
    ctx.beginPath();
    ctx.arc(x - 8 * s, headCY - 8 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 8 * s, headCY - 8 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle
    ctx.fillStyle = 'rgba(255,230,200,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, headCY + 4 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(x, headCY + 2 * s, 2.5 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x, headCY + 4 * s);
    ctx.lineTo(x - 2.5 * s, headCY + 6 * s);
    ctx.moveTo(x, headCY + 4 * s);
    ctx.lineTo(x + 2.5 * s, headCY + 6 * s);
    ctx.stroke();

    // Eyes
    _drawEyes(ctx, x - 4 * s, x + 4 * s, headCY - 2 * s, 2 * s, s);
  },

  side(ctx, x, groundY, color, s, walkPhase) {
    const bodyW = 26 * s, bodyH = 18 * s;
    const headR = 9 * s;
    const legW = 5 * s, legH = 10 * s;
    const feetY = groundY;
    const legsTop = feetY - legH;
    const bodyTop = legsTop - bodyH;
    const headCX = x + 10 * s, headCY = bodyTop - 2 * s;

    const phase = walkPhase * Math.PI * 2;
    const legSwing = Math.sin(phase) * 5 * s;

    // Small tail
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 14 * s, bodyTop + bodyH * 0.4, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Back legs (lumbering stride)
    ctx.fillStyle = color;
    _roundRect(ctx, x - 9 * s - legSwing * 0.5, legsTop, legW, legH, 2 * s); ctx.fill();
    // Front legs
    _roundRect(ctx, x + 6 * s + legSwing, legsTop, legW, legH, 2 * s); ctx.fill();

    // Paw pads
    ctx.fillStyle = 'rgba(255,220,180,0.4)';
    ctx.beginPath();
    ctx.ellipse(x - 6.5 * s - legSwing * 0.5, feetY - 1.5 * s, 3 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 8.5 * s + legSwing, feetY - 1.5 * s, 3 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = color;
    _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 7 * s);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,230,200,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * s, bodyTop + bodyH * 0.6, 9 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Ear (one visible, on top)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCX + 2 * s, headCY - 8 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,180,0.4)';
    ctx.beginPath();
    ctx.arc(headCX + 2 * s, headCY - 8 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle
    ctx.fillStyle = 'rgba(255,230,200,0.4)';
    ctx.beginPath();
    ctx.ellipse(headCX + 6 * s, headCY + 2 * s, 4 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(headCX + 9 * s, headCY + 1 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    _drawSideEye(ctx, headCX + 3 * s, headCY - 2 * s, 2 * s, s);
  },
};

// ────────────────────────────────────────────────────────
// Animal type registry
// ────────────────────────────────────────────────────────

const _animalDrawers = {
  puppy: _puppy,
  kitten: _kitten,
  elephant: _elephant,
  horse: _horse,
  cow: _cow,
  bunny: _bunny,
  duck: _duck,
  penguin: _penguin,
  frog: _frog,
  bear: _bear,
};
