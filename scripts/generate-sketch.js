#!/usr/bin/env node

/**
 * Thrive Richly — Freehand Sketch Explainer Video Generator
 * 
 * Generates whiteboard-style explainer videos with HAND-DRAWN aesthetic.
 * All lines, shapes, and underlines have natural wobble and imperfections.
 * Text appears as if being written in real-time with a marker pen.
 * 
 * Visual: Cream paper background + sketchy marker lines + hand-drawn diagrams
 * Flow: Hook → Points (appear one by one) → Takeaway → Brand
 * 
 * Required env vars:
 *   FB_PAGE_ACCESS_TOKEN  — Page Access Token
 *   FB_PAGE_ID            — Facebook Page ID
 */

const fs = require('fs')
const path = require('path')
const { createCanvas } = require('canvas')
const { execSync } = require('child_process')

// ============================================================================
// CONFIG
// ============================================================================
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FB_PAGE_ID = process.env.FB_PAGE_ID || '216309642249176'
const TOPICS_FILE = path.join(__dirname, 'sketch-topics.json')
const TEMP_DIR = path.join(__dirname, '..', 'temp-sketch')
const FRAMES_DIR = path.join(TEMP_DIR, 'frames')
const MUSIC_DIR = path.join(__dirname, 'music')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 24

const COLORS = {
  bg: '#FAF6EE',
  bgLine: '#ECE6D8',
  marker: '#1A1A2E',
  markerLight: '#3D3D5C',
  accent: '#C49A2A',
  blue: '#2E6EBE',
  green: '#1E8A45',
  red: '#C03030',
  subtle: '#9A9AAA',
  highlight: '#FFEFB8',
  brand1: '#C49A2A',
  brand2: '#E8C547',
}

if (!FB_PAGE_ACCESS_TOKEN) {
  console.error('❌ FB_PAGE_ACCESS_TOKEN environment variable is required')
  process.exit(1)
}

// ============================================================================
// SEEDED RANDOM
// ============================================================================
function seededRandom(seed) {
  let s = seed
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Persistent jitter random per concept for consistent wobble
let _rand
function initRand(seed) { _rand = seededRandom(seed) }
function rnd() { return _rand() }
function jit(amount) { return (rnd() - 0.5) * amount * 2 }

// ============================================================================
// FREEHAND DRAWING PRIMITIVES
// ============================================================================

/** Draw a wobbly line that looks hand-drawn */
function sketchLine(ctx, x1, y1, x2, y2, wobble = 3) {
  const steps = Math.max(8, Math.floor(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / 8))
  ctx.beginPath()
  ctx.moveTo(x1 + jit(wobble * 0.5), y1 + jit(wobble * 0.5))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = x1 + (x2 - x1) * t + jit(wobble)
    const y = y1 + (y2 - y1) * t + jit(wobble)
    ctx.lineTo(x, y)
  }
  ctx.stroke()
}

/** Draw a wobbly rectangle */
function sketchRect(ctx, x, y, w, h, wobble = 3) {
  sketchLine(ctx, x, y, x + w, y, wobble)
  sketchLine(ctx, x + w, y, x + w, y + h, wobble)
  sketchLine(ctx, x + w, y + h, x, y + h, wobble)
  sketchLine(ctx, x, y + h, x, y, wobble)
}

/** Draw a wobbly filled rectangle */
function sketchFilledRect(ctx, x, y, w, h, wobble = 3) {
  ctx.beginPath()
  const corners = [
    [x + jit(wobble), y + jit(wobble)],
    [x + w + jit(wobble), y + jit(wobble)],
    [x + w + jit(wobble), y + h + jit(wobble)],
    [x + jit(wobble), y + h + jit(wobble)],
  ]
  ctx.moveTo(corners[0][0], corners[0][1])
  for (let i = 1; i < corners.length; i++) {
    // Add midpoint wobble for each edge
    const prev = corners[i - 1]
    const curr = corners[i]
    const mx = (prev[0] + curr[0]) / 2 + jit(wobble)
    const my = (prev[1] + curr[1]) / 2 + jit(wobble)
    ctx.quadraticCurveTo(mx, my, curr[0], curr[1])
  }
  ctx.closePath()
  ctx.fill()
}

/** Draw a wobbly circle */
function sketchCircle(ctx, cx, cy, r, wobble = 4) {
  ctx.beginPath()
  const steps = 36
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const wr = r + jit(wobble)
    const x = cx + wr * Math.cos(angle)
    const y = cy + wr * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Draw a wobbly underline */
function sketchUnderline(ctx, x, y, width, wobble = 2) {
  const saved = ctx.lineWidth
  ctx.lineWidth = 2.5
  sketchLine(ctx, x, y, x + width, y, wobble)
  ctx.lineWidth = saved
}

/** Draw a hand-drawn arrow */
function sketchArrow(ctx, x1, y1, x2, y2, wobble = 3) {
  sketchLine(ctx, x1, y1, x2, y2, wobble)
  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 15
  const a1 = angle + Math.PI * 0.8
  const a2 = angle - Math.PI * 0.8
  sketchLine(ctx, x2, y2, x2 + headLen * Math.cos(a1), y2 + headLen * Math.sin(a1), wobble * 0.5)
  sketchLine(ctx, x2, y2, x2 + headLen * Math.cos(a2), y2 + headLen * Math.sin(a2), wobble * 0.5)
}

/** Draw a hand-drawn checkmark */
function sketchCheck(ctx, x, y, size, wobble = 2) {
  ctx.lineWidth = 3
  sketchLine(ctx, x, y, x + size * 0.35, y + size * 0.5, wobble)
  sketchLine(ctx, x + size * 0.35, y + size * 0.5, x + size, y - size * 0.2, wobble)
}

/** Draw a hand-drawn bullet point (small filled circle) */
function sketchBullet(ctx, x, y, radius = 5) {
  sketchCircle(ctx, x, y, radius, 1.5)
  ctx.fill()
}

/** Draw a wobbly star */
function sketchStar(ctx, cx, cy, r, wobble = 3) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 === 0 ? r + jit(wobble) : r * 0.45 + jit(wobble * 0.5)
    const x = cx + rad * Math.cos(angle)
    const y = cy + rad * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

// ============================================================================
// TEXT HELPERS
// ============================================================================
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// ============================================================================
// WHITEBOARD BACKGROUND — Paper texture with faint grid
// ============================================================================
function drawBackground(ctx, conceptSeed) {
  initRand(conceptSeed + 1000)

  // Cream paper base
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Subtle dot grid (not lines — more whiteboard feel)
  ctx.fillStyle = 'rgba(0,0,0,0.04)'
  for (let gx = 50; gx < WIDTH; gx += 40) {
    for (let gy = 50; gy < HEIGHT; gy += 40) {
      ctx.beginPath()
      ctx.arc(gx + jit(1), gy + jit(1), 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Random paper texture specks
  ctx.fillStyle = 'rgba(0,0,0,0.015)'
  for (let i = 0; i < 150; i++) {
    ctx.beginPath()
    ctx.arc(rnd() * WIDTH, rnd() * HEIGHT, rnd() * 3 + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Faint coffee stain ring (adds authenticity)
  ctx.strokeStyle = 'rgba(160, 130, 80, 0.04)'
  ctx.lineWidth = 2
  const stainX = 200 + rnd() * 600
  const stainY = 300 + rnd() * 1200
  sketchCircle(ctx, stainX, stainY, 40 + rnd() * 30, 8)
  ctx.stroke()
}

// ============================================================================
// SKETCH DIAGRAM RENDERERS
// ============================================================================

function drawSketchGrowth(ctx, x, y, w, h, progress) {
  ctx.strokeStyle = COLORS.marker
  ctx.lineWidth = 2

  // Axes
  if (progress > 0.05) {
    sketchLine(ctx, x + 30, y + h - 30, x + 30, y + 20, 3)
    sketchLine(ctx, x + 30, y + h - 30, x + w - 20, y + h - 30, 3)
  }

  // Exponential curve
  if (progress > 0.15) {
    ctx.strokeStyle = COLORS.green
    ctx.lineWidth = 3
    const pts = Math.floor(Math.min(1, (progress - 0.15) / 0.6) * 30)
    ctx.beginPath()
    for (let i = 0; i <= pts; i++) {
      const t = i / 30
      const px = x + 40 + t * (w - 70)
      const py = y + h - 40 - Math.pow(t, 2.3) * (h - 70)
      if (i === 0) ctx.moveTo(px + jit(2), py + jit(2))
      else ctx.lineTo(px + jit(2), py + jit(2))
    }
    ctx.stroke()
  }

  // Annotation arrow and label
  if (progress > 0.8) {
    ctx.strokeStyle = COLORS.red
    ctx.lineWidth = 2
    sketchArrow(ctx, x + w - 120, y + 60, x + w - 60, y + 100, 3)
    ctx.fillStyle = COLORS.red
    ctx.font = 'bold 20px "Poppins", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('GROWTH!', x + w - 190, y + 55)
  }
}

function drawSketchComparison(ctx, x, y, w, h, progress) {
  const midX = x + w / 2
  ctx.lineWidth = 2

  // Divider line
  if (progress > 0.1) {
    ctx.strokeStyle = COLORS.subtle
    ctx.setLineDash([8, 6])
    sketchLine(ctx, midX, y + 10, midX, y + h - 10, 2)
    ctx.setLineDash([])
  }

  // Left side (green / good)
  if (progress > 0.2) {
    ctx.strokeStyle = COLORS.green
    ctx.fillStyle = COLORS.green
    ctx.font = 'bold 24px "Poppins", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓ YES', x + w / 4, y + 35)
    sketchUnderline(ctx, x + w / 4 - 40, y + 42, 80, 2)

    // Check marks
    const checks = Math.min(3, Math.floor((progress - 0.3) / 0.15) + 1)
    if (progress > 0.3) {
      for (let i = 0; i < checks; i++) {
        sketchCheck(ctx, x + 40, y + 65 + i * 45, 20, 2)
      }
    }
  }

  // Right side (red / bad)
  if (progress > 0.4) {
    ctx.strokeStyle = COLORS.red
    ctx.fillStyle = COLORS.red
    ctx.font = 'bold 24px "Poppins", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✗ NO', x + w * 3 / 4, y + 35)
    sketchUnderline(ctx, x + w * 3 / 4 - 30, y + 42, 60, 2)

    // X marks
    const xs = Math.min(3, Math.floor((progress - 0.5) / 0.15) + 1)
    if (progress > 0.5) {
      ctx.lineWidth = 3
      for (let i = 0; i < xs; i++) {
        const bx = midX + 50
        const by = y + 65 + i * 45
        sketchLine(ctx, bx, by, bx + 18, by + 18, 2)
        sketchLine(ctx, bx + 18, by, bx, by + 18, 2)
      }
    }
  }
}

function drawSketchPie(ctx, x, y, w, h, progress) {
  const cx = x + w / 2
  const cy = y + h / 2 - 15
  const r = Math.min(w, h) / 2 - 40

  const slices = [
    { pct: 0.50, color: COLORS.blue, label: '50%' },
    { pct: 0.30, color: COLORS.accent, label: '30%' },
    { pct: 0.20, color: COLORS.green, label: '20%' },
  ]

  let startAngle = -Math.PI / 2
  const totalDraw = Math.min(1, progress * 1.3) * Math.PI * 2

  for (const slice of slices) {
    const sliceAngle = slice.pct * Math.PI * 2
    const drawAngle = Math.min(sliceAngle, Math.max(0, totalDraw - (startAngle + Math.PI / 2)))

    if (drawAngle > 0) {
      // Draw wobbly slice
      ctx.fillStyle = slice.color
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, startAngle, startAngle + drawAngle)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1.0

      // Wobbly outline
      ctx.strokeStyle = slice.color
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(cx + jit(2), cy + jit(2))
      const arcStart = startAngle
      const arcEnd = startAngle + drawAngle
      for (let a = arcStart; a <= arcEnd; a += 0.1) {
        ctx.lineTo(cx + (r + jit(3)) * Math.cos(a), cy + (r + jit(3)) * Math.sin(a))
      }
      ctx.lineTo(cx + jit(2), cy + jit(2))
      ctx.stroke()

      // Label
      if (drawAngle >= sliceAngle * 0.6) {
        const mid = startAngle + sliceAngle / 2
        ctx.fillStyle = slice.color
        ctx.font = 'bold 26px "Poppins", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(slice.label, cx + r * 0.55 * Math.cos(mid), cy + r * 0.55 * Math.sin(mid) + 8)
      }
    }
    startAngle += sliceAngle
  }
}

function drawSketchLadder(ctx, x, y, w, h, progress) {
  ctx.lineWidth = 2.5
  ctx.strokeStyle = COLORS.marker

  // Side rails
  const railL = x + 60
  const railR = x + w - 60
  if (progress > 0.05) {
    sketchLine(ctx, railL, y + h - 20, railL - 30, y + 20, 4)
    sketchLine(ctx, railR, y + h - 20, railR + 30, y + 20, 4)
  }

  // Rungs
  const rungs = 5
  for (let i = 0; i < rungs; i++) {
    const rungProg = (progress - 0.1 - i * 0.12)
    if (rungProg > 0) {
      const ry = y + h - 50 - i * ((h - 70) / rungs)
      const shrink = i * 6
      ctx.strokeStyle = i === rungs - 1 ? COLORS.accent : COLORS.marker
      ctx.lineWidth = i === rungs - 1 ? 3 : 2
      sketchLine(ctx, railL - 20 + shrink, ry, railR + 20 - shrink, ry, 3)
    }
  }

  // Star at top
  if (progress > 0.85) {
    ctx.fillStyle = COLORS.accent
    ctx.strokeStyle = COLORS.accent
    ctx.lineWidth = 2
    sketchStar(ctx, x + w / 2, y + 35, 22, 3)
    ctx.fill()
    ctx.stroke()
  }
}

function drawSketchTimeline(ctx, x, y, w, h, progress) {
  ctx.strokeStyle = COLORS.marker
  ctx.lineWidth = 2

  // Main line
  if (progress > 0.05) {
    const lineY = y + h / 2
    sketchArrow(ctx, x + 30, lineY, x + w - 30, lineY, 3)
  }

  // Markers
  const dots = 4
  for (let i = 0; i < dots; i++) {
    const dp = (progress - 0.15 - i * 0.15)
    if (dp > 0) {
      const dx = x + 80 + i * ((w - 160) / (dots - 1))
      const dy = y + h / 2
      ctx.fillStyle = i === dots - 1 ? COLORS.green : COLORS.blue
      ctx.strokeStyle = ctx.fillStyle
      sketchCircle(ctx, dx, dy, 8, 2)
      ctx.fill()

      // Tick up
      ctx.lineWidth = 1.5
      sketchLine(ctx, dx, dy - 12, dx, dy - 35, 2)
    }
  }
}

function drawSketchShield(ctx, x, y, w, h, progress) {
  const cx = x + w / 2
  const cy = y + h / 2

  if (progress > 0.1) {
    const s = Math.min(w, h) * 0.28
    ctx.strokeStyle = COLORS.blue
    ctx.lineWidth = 3

    // Shield shape (wobbly)
    ctx.beginPath()
    ctx.moveTo(cx + jit(3), cy - s + jit(3))
    ctx.lineTo(cx + s * 0.8 + jit(3), cy - s * 0.4 + jit(3))
    ctx.lineTo(cx + s * 0.75 + jit(3), cy + s * 0.3 + jit(3))
    ctx.lineTo(cx + jit(3), cy + s * 0.9 + jit(3))
    ctx.lineTo(cx - s * 0.75 + jit(3), cy + s * 0.3 + jit(3))
    ctx.lineTo(cx - s * 0.8 + jit(3), cy - s * 0.4 + jit(3))
    ctx.closePath()

    ctx.fillStyle = 'rgba(46, 110, 190, 0.15)'
    ctx.fill()
    ctx.stroke()

    // Checkmark inside
    if (progress > 0.5) {
      ctx.strokeStyle = COLORS.green
      ctx.lineWidth = 4
      sketchCheck(ctx, cx - 25, cy - 5, 50, 3)
    }
  }
}

function drawSketchFlow(ctx, x, y, w, h, progress) {
  const boxes = ['IN', 'PROCESS', 'OUT']
  const boxW = 100
  const totalW = boxes.length * boxW + (boxes.length - 1) * 60
  const startX = x + (w - totalW) / 2
  const midY = y + h / 2

  boxes.forEach((label, i) => {
    const bp = (progress - i * 0.2) / 0.3
    if (bp > 0) {
      const bx = startX + i * (boxW + 60)
      ctx.strokeStyle = i === 2 ? COLORS.green : COLORS.blue
      ctx.lineWidth = 2
      sketchRect(ctx, bx, midY - 25, boxW, 50, 3)

      if (bp > 0.5) {
        ctx.fillStyle = ctx.strokeStyle
        ctx.font = 'bold 18px "Poppins", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(label, bx + boxW / 2, midY + 7)
      }

      // Arrow between boxes
      if (i < boxes.length - 1 && bp > 0.8) {
        ctx.strokeStyle = COLORS.subtle
        ctx.lineWidth = 2
        sketchArrow(ctx, bx + boxW + 8, midY, bx + boxW + 50, midY, 2)
      }
    }
  })
}

function drawSketchChecklist(ctx, x, y, w, h, progress) {
  const items = 5
  const itemH = 38
  const startY = y + 20

  for (let i = 0; i < items; i++) {
    const ip = (progress - i * 0.12) / 0.2
    if (ip > 0) {
      const iy = startY + i * itemH
      // Box
      ctx.strokeStyle = ip > 1 ? COLORS.green : COLORS.marker
      ctx.lineWidth = 2
      sketchRect(ctx, x + 30, iy, 22, 22, 2)

      // Check if filled
      if (ip > 1) {
        ctx.strokeStyle = COLORS.green
        ctx.lineWidth = 2.5
        sketchCheck(ctx, x + 33, iy + 4, 16, 1.5)
      }

      // Line (representing text)
      ctx.strokeStyle = COLORS.bgLine
      ctx.lineWidth = 8
      const lineW = 100 + rnd() * 150
      sketchLine(ctx, x + 65, iy + 11, x + 65 + lineW, iy + 11, 1)
    }
  }
}

// Diagram dispatcher
function drawSketchDiagram(ctx, type, x, y, w, h, progress) {
  switch (type) {
    case 'growth':
    case 'decline':
      drawSketchGrowth(ctx, x, y, w, h, progress)
      break
    case 'comparison':
    case 'balance':
      drawSketchComparison(ctx, x, y, w, h, progress)
      break
    case 'pie':
    case 'jars':
    case 'three_buckets':
    case 'quadrant':
    case 'venn':
    case 'seven_streams':
      drawSketchPie(ctx, x, y, w, h, progress)
      break
    case 'ladder':
    case 'stack':
      drawSketchLadder(ctx, x, y, w, h, progress)
      break
    case 'timeline':
    case 'formula':
      drawSketchTimeline(ctx, x, y, w, h, progress)
      break
    case 'shield':
      drawSketchShield(ctx, x, y, w, h, progress)
      break
    case 'flow':
    case 'cycle':
    case 'scroll':
      drawSketchFlow(ctx, x, y, w, h, progress)
      break
    case 'checklist':
      drawSketchChecklist(ctx, x, y, w, h, progress)
      break
    case 'brain':
    case 'iceberg':
    case 'fork':
    case 'circles':
      drawSketchShield(ctx, x, y, w, h, progress)
      break
    default:
      drawSketchGrowth(ctx, x, y, w, h, progress)
  }
}

// ============================================================================
// SECTION RENDERERS
// ============================================================================

function renderHook(ctx, topic, alpha, progress) {
  ctx.globalAlpha = alpha

  // Category tag
  ctx.fillStyle = COLORS.accent
  ctx.font = 'bold 20px "Poppins", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(topic.category.toUpperCase(), WIDTH / 2, 300)

  // Wobbly underline under category
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  const catW = ctx.measureText(topic.category.toUpperCase()).width
  sketchUnderline(ctx, WIDTH / 2 - catW / 2 - 5, 308, catW + 10, 2)

  // Title
  ctx.fillStyle = COLORS.marker
  ctx.font = 'bold 48px "Poppins", sans-serif'
  ctx.textAlign = 'center'
  const titleLines = wrapText(ctx, topic.title, WIDTH - 160)
  titleLines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, 380 + i * 62)
  })

  // Hand-drawn circle around an important word area
  if (progress > 0.5) {
    ctx.strokeStyle = COLORS.red
    ctx.lineWidth = 2
    const circleY = 380 + (titleLines.length - 1) * 62
    sketchCircle(ctx, WIDTH / 2, circleY - 15, 120 + titleLines[0].length * 2, 8)
    ctx.stroke()
  }

  // Hook text
  if (progress > 0.3) {
    ctx.fillStyle = COLORS.markerLight
    ctx.font = 'italic 28px "Poppins", sans-serif'
    ctx.textAlign = 'center'
    const hookY = 400 + titleLines.length * 62
    const hookAlpha = Math.min(1, (progress - 0.3) / 0.3)
    ctx.globalAlpha = alpha * hookAlpha
    ctx.fillText(topic.hook, WIDTH / 2, hookY)
  }

  ctx.globalAlpha = 1.0
}

function renderPoints(ctx, topic, alpha, progress) {
  ctx.globalAlpha = alpha

  // Section label
  ctx.fillStyle = COLORS.blue
  ctx.font = 'bold 22px "Poppins", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HERE\'S THE BREAKDOWN:', 90, 230)
  ctx.strokeStyle = COLORS.blue
  ctx.lineWidth = 2
  sketchUnderline(ctx, 90, 242, 320, 2)

  // Points appear one by one
  const pointCount = topic.points.length
  const pointSpacing = Math.min(130, (HEIGHT - 550) / pointCount)
  const startY = 290

  for (let i = 0; i < pointCount; i++) {
    const pointStart = i / pointCount
    const pointProg = Math.max(0, (progress - pointStart) / (1 / pointCount))

    if (pointProg > 0) {
      const py = startY + i * pointSpacing
      const textAlpha = Math.min(1, pointProg * 2)
      ctx.globalAlpha = alpha * textAlpha

      // Bullet / number
      ctx.fillStyle = COLORS.accent
      ctx.font = 'bold 28px "Poppins", sans-serif'
      ctx.textAlign = 'left'

      // Sketch bullet
      ctx.strokeStyle = COLORS.accent
      ctx.lineWidth = 2
      sketchBullet(ctx, 108, py + 2, 6)

      // Point text
      ctx.fillStyle = COLORS.marker
      ctx.font = '28px "Poppins", sans-serif'
      const lines = wrapText(ctx, topic.points[i], WIDTH - 220)
      lines.forEach((line, li) => {
        ctx.fillText(line, 130, py + li * 38)
      })

      // Hand-drawn emphasis on key words (underline occasional words)
      if (pointProg > 0.8 && i < 2) {
        ctx.strokeStyle = COLORS.accent
        ctx.globalAlpha = alpha * 0.4
        ctx.lineWidth = 6
        const firstLine = lines[0]
        const capsWord = firstLine.match(/[A-Z]{2,}/)
        if (capsWord) {
          const beforeW = ctx.measureText(firstLine.substring(0, firstLine.indexOf(capsWord[0]))).width
          const wordW = ctx.measureText(capsWord[0]).width
          sketchLine(ctx, 130 + beforeW, py + 6, 130 + beforeW + wordW, py + 6, 1)
        }
      }
    }
  }

  ctx.globalAlpha = 1.0
}

function renderDiagram(ctx, topic, alpha, progress) {
  ctx.globalAlpha = alpha

  // Label
  ctx.fillStyle = COLORS.marker
  ctx.font = 'bold 22px "Poppins", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('VISUALISED:', 90, 250)
  ctx.strokeStyle = COLORS.marker
  ctx.lineWidth = 2
  sketchUnderline(ctx, 90, 262, 160, 2)

  // Diagram area with hand-drawn border
  const dx = 70, dy = 300, dw = WIDTH - 140, dh = 480
  ctx.strokeStyle = COLORS.bgLine
  ctx.lineWidth = 1.5
  sketchRect(ctx, dx, dy, dw, dh, 4)

  drawSketchDiagram(ctx, topic.sketch, dx + 20, dy + 15, dw - 40, dh - 30, progress)

  ctx.globalAlpha = 1.0
}

function renderTakeaway(ctx, topic, alpha, progress) {
  ctx.globalAlpha = alpha

  // Highlight box background (hand-drawn)
  ctx.fillStyle = COLORS.highlight
  sketchFilledRect(ctx, 70, 320, WIDTH - 140, 380, 5)

  // Left accent bar
  ctx.fillStyle = COLORS.accent
  ctx.fillRect(70, 320, 6, 380)

  // Header with star
  ctx.fillStyle = COLORS.accent
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  sketchStar(ctx, 120, 365, 18, 2)
  ctx.fill()
  ctx.stroke()

  ctx.font = 'bold 26px "Poppins", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('KEY TAKEAWAY', 150, 375)
  sketchUnderline(ctx, 150, 385, 200, 2)

  // Takeaway text — reveal word by word
  const words = topic.takeaway.split(' ')
  const showWords = Math.floor(progress * words.length)
  const visibleText = words.slice(0, showWords).join(' ')

  if (visibleText) {
    ctx.fillStyle = COLORS.marker
    ctx.font = 'bold 32px "Poppins", sans-serif'
    const lines = wrapText(ctx, visibleText, WIDTH - 220)
    lines.forEach((line, i) => {
      ctx.fillText(line, 100, 430 + i * 48)
    })
  }

  ctx.globalAlpha = 1.0
}

function renderBrand(ctx, alpha) {
  ctx.globalAlpha = alpha

  // Hand-drawn separator
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  sketchLine(ctx, WIDTH / 2 - 80, HEIGHT / 2 - 80, WIDTH / 2 + 80, HEIGHT / 2 - 80, 3)

  // Brand name
  ctx.font = 'bold 42px "Poppins", sans-serif'
  ctx.textAlign = 'center'
  const t1 = 'THRIVE '
  const t2 = 'RICHLY'
  const t1w = ctx.measureText(t1).width
  const t2w = ctx.measureText(t2).width
  const bx = (WIDTH - t1w - t2w) / 2

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.brand1
  ctx.fillText(t1, bx, HEIGHT / 2 - 20)
  ctx.fillStyle = COLORS.brand2
  ctx.fillText(t2, bx + t1w, HEIGHT / 2 - 20)

  // Tagline
  ctx.font = '22px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.subtle
  ctx.textAlign = 'center'
  ctx.fillText('Wealth wisdom, sketched simply.', WIDTH / 2, HEIGHT / 2 + 30)

  // CTA
  ctx.font = 'bold 24px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent
  ctx.fillText('Follow for daily sketches', WIDTH / 2, HEIGHT / 2 + 80)

  // Hand-drawn box around CTA
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  sketchRect(ctx, WIDTH / 2 - 180, HEIGHT / 2 + 55, 360, 40, 3)

  ctx.globalAlpha = 1.0
}

// ============================================================================
// FRAME GENERATION
// ============================================================================
function generateFrames(topic, framesDir) {
  console.log('  ✏️  Generating freehand sketch frames...')

  const SECTIONS = [
    { name: 'hook', duration: 5 },
    { name: 'points', duration: 22 },
    { name: 'diagram', duration: 14 },
    { name: 'takeaway', duration: 14 },
    { name: 'brand', duration: 4 },
  ]
  const TRANS = 0.8

  const totalDuration = SECTIONS.reduce((s, sec) => s + sec.duration, 0) + TRANS * (SECTIONS.length - 1)
  const totalFrames = Math.ceil(totalDuration * FPS)

  console.log(`  📐 ${SECTIONS.length} sections, ${totalDuration.toFixed(1)}s, ${totalFrames} frames`)

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')
  const bgSeed = topic.id * 7 + 99

  fs.mkdirSync(framesDir, { recursive: true })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS

    // Reset jitter seed per frame + concept for consistent wobble
    initRand(bgSeed + frame * 3)

    // Draw background (always fresh — wobble is seeded so it's stable)
    drawBackground(ctx, bgSeed)

    // Determine active section
    let elapsed = 0
    for (let si = 0; si < SECTIONS.length; si++) {
      const sec = SECTIONS[si]
      const secStart = elapsed
      const secEnd = elapsed + sec.duration

      if (t >= secStart && t < secEnd + TRANS / 2) {
        let alpha = 1.0
        if (t < secStart + TRANS / 2) alpha = Math.min(1, (t - secStart) / (TRANS / 2))
        if (t > secEnd - TRANS / 2) alpha = Math.max(0, 1 - (t - (secEnd - TRANS / 2)) / (TRANS / 2))

        const secT = Math.min(1, (t - secStart) / sec.duration)

        // Re-init jitter for consistent sketch look within section
        initRand(bgSeed + si * 1000 + 42)

        switch (sec.name) {
          case 'hook': renderHook(ctx, topic, alpha, secT); break
          case 'points': renderPoints(ctx, topic, alpha, secT); break
          case 'diagram': renderDiagram(ctx, topic, alpha, secT); break
          case 'takeaway': renderTakeaway(ctx, topic, alpha, secT); break
          case 'brand': renderBrand(ctx, alpha); break
        }
        if (alpha > 0) break
      }
      elapsed += sec.duration + TRANS
    }

    // Watermark
    ctx.globalAlpha = 0.3
    ctx.font = '16px "Poppins", sans-serif'
    ctx.fillStyle = COLORS.subtle
    ctx.textAlign = 'center'
    ctx.fillText('THRIVE RICHLY', WIDTH / 2, HEIGHT - 35)
    ctx.globalAlpha = 1.0

    // Save
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.88 })
    fs.writeFileSync(path.join(framesDir, `frame_${String(frame).padStart(5, '0')}.jpg`), buffer)

    if (frame % (FPS * 4) === 0) {
      console.log(`  🎞️  ${frame}/${totalFrames} frames (${t.toFixed(1)}s / ${totalDuration.toFixed(1)}s)`)
    }
  }

  console.log(`  ✅ All ${totalFrames} frames rendered`)
  return { totalDuration, totalFrames }
}

// ============================================================================
// VIDEO ASSEMBLY (same proven approach as Reels)
// ============================================================================
function assembleVideo(framesDir, outputPath, duration) {
  console.log('  🎬 Assembling video...')

  let musicPath = null
  if (fs.existsSync(MUSIC_DIR)) {
    const files = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|aac|m4a|wav)$/i.test(f))
    if (files.length > 0) {
      musicPath = path.join(MUSIC_DIR, files[Math.floor(Math.random() * files.length)])
      console.log(`  🎵 Using music: ${path.basename(musicPath)}`)
    }
  }

  if (musicPath) {
    const fade = Math.max(0, duration - 2)
    try {
      execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" -i "${musicPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -af "afade=t=in:d=1.5,afade=t=out:st=${fade}:d=2,volume=0.3" -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
      console.log(`  ✅ Video ready (with music): ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB`)
      return
    } catch (e) { console.log('  ⚠️  Music mux failed, trying silent...') }
  }

  const noAudio = outputPath.replace('.mp4', '_v.mp4')
  execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${noAudio}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
  try {
    execSync(`ffmpeg -y -i "${noAudio}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -shortest -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
  } catch (e) { fs.copyFileSync(noAudio, outputPath) }
  try { fs.unlinkSync(noAudio) } catch (e) {}

  console.log(`  ✅ Video ready: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB`)
}

// ============================================================================
// FACEBOOK REELS UPLOAD
// ============================================================================
async function uploadReel(videoPath, caption, scheduledTime = null) {
  const videoBuffer = fs.readFileSync(videoPath)

  const initRes = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_phase: 'start', access_token: FB_PAGE_ACCESS_TOKEN }),
  })
  if (!initRes.ok) throw new Error(`Init: ${await initRes.text()}`)
  const { video_id, upload_url } = await initRes.json()

  console.log(`  📤 Video ID: ${video_id}, uploading ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB...`)

  const uploadRes = await fetch(upload_url, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${FB_PAGE_ACCESS_TOKEN}`,
      offset: '0',
      file_size: videoBuffer.length.toString(),
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer,
  })
  if (!uploadRes.ok) throw new Error(`Upload: ${await uploadRes.text()}`)

  const finish = {
    upload_phase: 'finish', video_id,
    title: caption.substring(0, 100),
    description: caption,
    access_token: FB_PAGE_ACCESS_TOKEN,
  }
  if (scheduledTime) {
    finish.video_state = 'SCHEDULED'
    finish.scheduled_publish_time = Math.floor(scheduledTime.getTime() / 1000)
  }

  const pubRes = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finish),
  })

  if (!pubRes.ok && scheduledTime) {
    delete finish.video_state
    delete finish.scheduled_publish_time
    const retry = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finish),
    })
    if (!retry.ok) throw new Error(`Publish: ${await retry.text()}`)
    return await retry.json()
  }
  if (!pubRes.ok) throw new Error(`Publish: ${await pubRes.text()}`)
  return await pubRes.json()
}

// ============================================================================
// CAPTION + SCHEDULING
// ============================================================================
function generateCaption(topic) {
  const caps = [
    `✏️ ${topic.title}\n\n${topic.takeaway}\n\n🔖 Save this. Share it. Apply it.`,
    `💡 ${topic.title} — sketched in 60 seconds.\n\n${topic.takeaway}\n\nFollow for daily financial sketches.`,
    `🧠 Did you know?\n\n${topic.hook}\n\n${topic.takeaway}\n\n📌 Save for later.`,
    `✏️ "${topic.title}"\n\n${topic.takeaway}\n\n🔥 Tag someone who needs to see this.`,
  ]
  const hash = topic.title.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return caps[hash % caps.length]
}

function getScheduleTime() {
  const t = new Date()
  t.setUTCHours(10 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0)
  if (t <= new Date()) t.setDate(t.getDate() + 1)
  const min = new Date(Date.now() + 15 * 60 * 1000)
  if (t < min) t.setTime(min.getTime())
  return t
}

// ============================================================================
// TOPIC MANAGEMENT
// ============================================================================
function getNextTopic() {
  const data = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'))
  const pending = data.topics.filter(t => t.status === 'pending')
  if (pending.length === 0) {
    console.log('✅ All sketch topics posted! Add more to sketch-topics.json.')
    process.exit(0)
  }
  return { data, topic: pending[0], remaining: pending.length - 1 }
}

function markComplete(data, topicId) {
  const t = data.topics.find(x => x.id === topicId)
  if (t) { t.status = 'posted'; t.postedAt = new Date().toISOString().split('T')[0] }
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(data, null, 2))
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('✏️  Thrive Richly — Freehand Sketch Explainer Generator\n')
  console.log(`📱 Page ID: ${FB_PAGE_ID}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}\n`)

  const { data, topic, remaining } = getNextTopic()
  const schedTime = getScheduleTime()

  console.log(`📝 Topic: ${topic.title}`)
  console.log(`📂 Category: ${topic.category}`)
  console.log(`🎨 Sketch: ${topic.sketch}`)
  console.log(`⏰ Scheduled: ${schedTime.toISOString()}\n`)

  fs.mkdirSync(TEMP_DIR, { recursive: true })
  const framesDir = path.join(FRAMES_DIR, `sketch-${topic.id}`)

  try {
    const { totalDuration } = generateFrames(topic, framesDir)
    const videoPath = path.join(TEMP_DIR, `sketch-${topic.id}.mp4`)
    assembleVideo(framesDir, videoPath, totalDuration)

    const caption = generateCaption(topic)
    console.log('\n  📤 Uploading to Facebook...')
    const result = await uploadReel(videoPath, caption, schedTime)
    console.log(`  ✅ Published! ID: ${result.id || result.video_id || 'success'}`)

    markComplete(data, topic.id)
    console.log(`\n✅ Marked "${topic.title}" as posted`)
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`)
    process.exit(1)
  }

  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }) } catch (e) {}

  console.log('\n' + '='.repeat(50))
  console.log(`🎉 Sketch published: "${topic.title}"`)
  console.log(`📊 Remaining: ${remaining}`)
  console.log(`📅 Days of content: ${remaining}`)
  console.log('='.repeat(50))
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1) })
