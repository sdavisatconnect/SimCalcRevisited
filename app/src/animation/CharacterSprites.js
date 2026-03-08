/**
 * Draw a robot character on a canvas context.
 * Each robot has a colored body, drawn at a given x position standing on groundY.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x         - centre X
 * @param {number} groundY   - Y of ground / floor the robot stands on
 * @param {string} color     - theme colour for body, eyes, etc.
 * @param {string} name      - label drawn above head
 * @param {number} scale     - uniform scale (default 1)
 * @param {object} [motion]  - optional motion info
 * @param {number} motion.facing  - -1 = left, 0 = forward, 1 = right
 * @param {number} motion.walkPhase - 0‒1 cyclic phase for leg animation
 */
export function drawCharacter(ctx, x, groundY, color, name, scale = 1, motion) {
  const s = scale; // shorthand

  const facing = motion ? motion.facing : 0;
  const walkPhase = motion ? motion.walkPhase : 0;

  if (facing === 0) {
    _drawFront(ctx, x, groundY, color, name, s);
  } else {
    _drawSide(ctx, x, groundY, color, name, s, facing, walkPhase);
  }
}

// ────────────────────────────────────────────────────────
// Front-facing (idle) pose — same as the original robot
// ────────────────────────────────────────────────────────
function _drawFront(ctx, x, groundY, color, name, s) {
  const headW = 14 * s;
  const headH = 12 * s;
  const bodyW = 18 * s;
  const bodyH = 16 * s;
  const legW = 4 * s;
  const legH = 12 * s;
  const armW = 5 * s;
  const armH = 14 * s;
  const footH = 3 * s;

  const feetY = groundY;
  const legsTop = feetY - footH - legH;
  const bodyTop = legsTop - bodyH;
  const headTop = bodyTop - 2 * s - headH;

  ctx.save();

  // --- Legs ---
  const legGap = 4 * s;
  ctx.fillStyle = '#555';
  ctx.fillRect(x - legGap - legW / 2, legsTop, legW, legH);
  ctx.fillRect(x + legGap - legW / 2, legsTop, legW, legH);

  // --- Feet ---
  ctx.fillStyle = '#444';
  ctx.fillRect(x - legGap - legW / 2 - 1 * s, feetY - footH, legW + 2 * s, footH);
  ctx.fillRect(x + legGap - legW / 2 - 1 * s, feetY - footH, legW + 2 * s, footH);

  // --- Body ---
  ctx.fillStyle = color;
  _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 3 * s);
  ctx.fill();

  // Chest plate detail
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x - 5 * s, bodyTop + 3 * s, 10 * s, 8 * s);

  // Chest indicator light
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, bodyTop + bodyH * 0.45, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4eff4e';
  ctx.beginPath();
  ctx.arc(x, bodyTop + bodyH * 0.45, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // --- Arms ---
  ctx.fillStyle = '#666';
  ctx.fillRect(x - bodyW / 2 - armW, bodyTop + 2 * s, armW, armH);
  ctx.fillRect(x + bodyW / 2, bodyTop + 2 * s, armW, armH);

  // Hands
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - bodyW / 2 - armW / 2, bodyTop + 2 * s + armH + 1.5 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + bodyW / 2 + armW / 2, bodyTop + 2 * s + armH + 1.5 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // --- Head ---
  ctx.fillStyle = '#777';
  _roundRect(ctx, x - headW / 2, headTop, headW, headH, 3 * s);
  ctx.fill();

  // Visor
  ctx.fillStyle = '#222';
  _roundRect(ctx, x - headW / 2 + 2 * s, headTop + 2 * s, headW - 4 * s, headH - 5 * s, 2 * s);
  ctx.fill();

  // Eyes (glowing)
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4 * s;
  ctx.beginPath();
  ctx.arc(x - 3.5 * s, headTop + headH * 0.4, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 3.5 * s, headTop + headH * 0.4, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Antenna
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x, headTop);
  ctx.lineTo(x, headTop - 5 * s);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, headTop - 5 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();

  // --- Name label ---
  _drawNameLabel(ctx, x, headTop, color, name, s);

  ctx.restore();
}

// ────────────────────────────────────────────────────────
// Side-facing (walking) pose
// facing: -1 = looking left, 1 = looking right
// walkPhase: 0‒1 cyclic
// ────────────────────────────────────────────────────────
function _drawSide(ctx, x, groundY, color, name, s, facing, walkPhase) {
  const headW = 12 * s;   // narrower from side
  const headH = 12 * s;
  const bodyW = 12 * s;   // narrower from side
  const bodyH = 16 * s;
  const legW = 4 * s;
  const legH = 12 * s;
  const armW = 4 * s;
  const armH = 14 * s;
  const footW = 6 * s;
  const footH = 3 * s;

  const feetY = groundY;
  const legsTop = feetY - footH - legH;
  const bodyTop = legsTop - bodyH;
  const headTop = bodyTop - 2 * s - headH;

  // Leg swing: use sin wave for a natural stride
  const phase = walkPhase * Math.PI * 2;
  const legSwing = Math.sin(phase) * legH * 0.45;  // forward/back swing amount

  ctx.save();

  // Flip for direction — draw everything as if facing right, then mirror
  if (facing === -1) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }

  // --- Back leg (drawn first, slightly darker) ---
  _drawSideLeg(ctx, x, legsTop, legW, legH, footW, footH, feetY, -legSwing, s, '#484848', '#3a3a3a');

  // --- Back arm ---
  _drawSideArm(ctx, x, bodyTop, bodyW, armW, armH, s, '#555', color, legSwing);

  // --- Body ---
  ctx.fillStyle = color;
  _roundRect(ctx, x - bodyW / 2, bodyTop, bodyW, bodyH, 3 * s);
  ctx.fill();

  // Side panel detail (lighter stripe)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x - bodyW / 2 + 2 * s, bodyTop + 3 * s, bodyW - 4 * s, 8 * s);

  // Side indicator light
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + 2 * s, bodyTop + bodyH * 0.45, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4eff4e';
  ctx.beginPath();
  ctx.arc(x + 2 * s, bodyTop + bodyH * 0.45, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();

  // --- Front arm ---
  _drawSideArm(ctx, x, bodyTop, bodyW, armW, armH, s, '#666', color, -legSwing);

  // --- Front leg ---
  _drawSideLeg(ctx, x, legsTop, legW, legH, footW, footH, feetY, legSwing, s, '#555', '#444');

  // --- Head ---
  ctx.fillStyle = '#777';
  _roundRect(ctx, x - headW / 2, headTop, headW, headH, 3 * s);
  ctx.fill();

  // Visor — on the facing side
  ctx.fillStyle = '#222';
  _roundRect(ctx, x - headW / 2 + 3 * s, headTop + 2 * s, headW - 5 * s, headH - 5 * s, 2 * s);
  ctx.fill();

  // Single eye (side profile — one glowing eye visible)
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4 * s;
  ctx.beginPath();
  ctx.arc(x + 2 * s, headTop + headH * 0.4, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Antenna
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x, headTop);
  ctx.lineTo(x, headTop - 5 * s);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, headTop - 5 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // --- Name label (drawn after restore so it's never mirrored) ---
  ctx.save();
  _drawNameLabel(ctx, x, headTop, color, name, s);
  ctx.restore();
}

/** Draw one leg in side view, offset by `swing` pixels forward/back */
function _drawSideLeg(ctx, x, legsTop, legW, legH, footW, footH, feetY, swing, s, legColor, footColor) {
  // Upper leg pivots from hip
  const hipX = x;
  const hipY = legsTop;
  const kneeY = hipY + legH * 0.55;
  const ankleY = feetY - footH;

  // Simple two-segment leg: thigh angles forward/back, shin stays roughly vertical
  const thighAngle = swing / (legH * 0.55);  // radians approx
  const kneeX = hipX + Math.sin(thighAngle) * legH * 0.55;
  const kneeYActual = hipY + Math.cos(thighAngle) * legH * 0.55;

  // Thigh
  ctx.strokeStyle = legColor;
  ctx.lineWidth = legW;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeYActual);
  ctx.stroke();

  // Shin — from knee straight down to ankle
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeYActual);
  ctx.lineTo(kneeX, ankleY);
  ctx.stroke();

  // Foot
  ctx.fillStyle = footColor;
  ctx.fillRect(kneeX - 1 * s, ankleY, footW, footH);
  ctx.lineCap = 'butt';
}

/** Draw one arm in side view, swinging opposite to legs */
function _drawSideArm(ctx, x, bodyTop, bodyW, armW, armH, s, armColor, handColor, swing) {
  const shoulderX = x;
  const shoulderY = bodyTop + 3 * s;
  const armAngle = -swing / (armH * 0.7);  // swing opposite to legs

  const elbowX = shoulderX + Math.sin(armAngle) * armH * 0.5;
  const elbowY = shoulderY + Math.cos(armAngle) * armH * 0.5;
  const handX = elbowX;
  const handY = shoulderY + armH;

  ctx.strokeStyle = armColor;
  ctx.lineWidth = armW;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  // Hand circle
  ctx.fillStyle = handColor;
  ctx.beginPath();
  ctx.arc(handX, handY + 1.5 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'butt';
}

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
