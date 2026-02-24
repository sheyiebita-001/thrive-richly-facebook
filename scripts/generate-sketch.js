#!/usr/bin/env node

/**
 * Thrive Richly — Freehand Sketch Explainer v2
 * 
 * DOODLE VIDEO STYLE — Features an animated marker pen that visibly
 * draws every line, shape, and text element on screen in real-time.
 * Like InstaDoodle / Doodly / VideoScribe whiteboard animations.
 * 
 * Architecture:
 *   1. Each section builds a list of "draw commands" (strokes, text, shapes)
 *   2. Frame renderer replays commands progressively over time
 *   3. A marker pen graphic follows the active drawing point
 *   4. Completed strokes persist, new ones animate with the pen
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
  penBody: '#333333',
  penTip: '#1A1A2E',
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

let _rand
function initRand(seed) { _rand = seededRandom(seed) }
function rnd() { return _rand() }
function jit(amount) { return (rnd() - 0.5) * amount * 2 }

// ============================================================================
// TEXT WRAPPING
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
// DRAW COMMAND SYSTEM
// Each section produces an array of draw commands. The renderer
// plays them sequentially, with the pen following the active command.
//
// Command types:
//   { type: 'line', points: [{x,y}...], color, width, wobble }
//   { type: 'text', text, x, y, font, color, charByChar }
//   { type: 'fill_rect', x, y, w, h, color, opacity }
//   { type: 'circle', cx, cy, r, color, width, fill }
//   { type: 'bullet', cx, cy, r, color }
//   { type: 'check', x, y, size, color }
//   { type: 'star', cx, cy, r, color, fill }
//   { type: 'pause', duration } (fraction of section time)
// ============================================================================

function makeWobblyLinePoints(x1, y1, x2, y2, wobble, seed) {
  const oldRand = _rand
  initRand(seed)
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  const steps = Math.max(6, Math.floor(dist / 10))
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push({
      x: x1 + (x2 - x1) * t + (i > 0 && i < steps ? jit(wobble) : jit(wobble * 0.3)),
      y: y1 + (y2 - y1) * t + (i > 0 && i < steps ? jit(wobble) : jit(wobble * 0.3)),
    })
  }
  _rand = oldRand
  return pts
}

function makeCirclePoints(cx, cy, r, wobble, seed) {
  const oldRand = _rand
  initRand(seed)
  const pts = []
  const steps = 30
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const wr = r + jit(wobble)
    pts.push({ x: cx + wr * Math.cos(angle), y: cy + wr * Math.sin(angle) })
  }
  _rand = oldRand
  return pts
}

// ============================================================================
// HAND + MARKER RENDERER
// Draws a large, clearly visible hand holding a marker pen.
// The pen tip touches (x, y). The hand extends to the bottom-right.
// This is the signature "doodle video" look — a hand drawing on screen.
// ============================================================================
function drawPen(ctx, x, y) {
  ctx.save()

  // Offset: pen tip at (x,y), hand extends to bottom-right
  const hx = x + 35  // hand center x offset from tip
  const hy = y + 45   // hand center y offset from tip

  // === LARGE DROP SHADOW under entire hand ===
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(hx + 12, hy + 50, 70, 35, 0.2, 0, Math.PI * 2)
  ctx.fill()

  // === MARKER PEN (behind hand) ===
  ctx.save()
  ctx.translate(hx - 10, hy - 30)
  ctx.rotate(-0.65) // ~37 degrees tilted

  // Pen body
  const penLen = 180
  const penW = 18
  const penGrad = ctx.createLinearGradient(0, -penLen, 0, 20)
  penGrad.addColorStop(0, '#2A2A2A')
  penGrad.addColorStop(0.4, '#383838')
  penGrad.addColorStop(0.85, '#2E2E2E')
  penGrad.addColorStop(1, '#1A1A1A')
  ctx.fillStyle = penGrad
  ctx.beginPath()
  ctx.moveTo(-penW / 2, -penLen)
  ctx.lineTo(penW / 2, -penLen)
  ctx.lineTo(penW / 2 - 1, 10)
  ctx.lineTo(-penW / 2 + 1, 10)
  ctx.closePath()
  ctx.fill()

  // Pen highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(-3, -penLen + 15, 5, penLen - 30)

  // Gold cap band
  ctx.fillStyle = '#C49A2A'
  ctx.fillRect(-penW / 2 - 1, -penLen, penW + 2, 12)

  // Gold middle band
  ctx.fillStyle = '#C49A2A'
  ctx.fillRect(-penW / 2, -penLen * 0.4, penW, 6)

  // Pen tip (dark cone)
  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.moveTo(-7, 10)
  ctx.lineTo(7, 10)
  ctx.lineTo(1, 28)
  ctx.lineTo(-1, 28)
  ctx.closePath()
  ctx.fill()

  ctx.restore() // un-rotate pen

  // === HAND (skin-colored fist gripping pen) ===
  const skin = '#F0C8A0'
  const skinDark = '#D4A574'
  const skinLight = '#FAE0C0'

  // Back of hand (large oval)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(hx + 20, hy + 18, 52, 40, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // Hand outline
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(hx + 20, hy + 18, 52, 40, 0.3, 0, Math.PI * 2)
  ctx.stroke()

  // Thumb (pointing up along pen)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(hx - 14, hy - 12, 14, 28, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Thumb highlight
  ctx.fillStyle = skinLight
  ctx.beginPath()
  ctx.ellipse(hx - 16, hy - 16, 6, 12, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // Index finger (curled around pen)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(hx - 2, hy + 2, 13, 20, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Middle finger
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(hx + 10, hy + 12, 12, 18, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Ring finger
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(hx + 22, hy + 20, 11, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Pinky (smaller, tucked)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(hx + 34, hy + 26, 9, 13, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Knuckle lines on fingers
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4
  // Index
  ctx.beginPath()
  ctx.arc(hx - 2, hy + 5, 8, 0.3, 2.0)
  ctx.stroke()
  // Middle
  ctx.beginPath()
  ctx.arc(hx + 10, hy + 15, 7, 0.3, 2.0)
  ctx.stroke()
  // Ring
  ctx.beginPath()
  ctx.arc(hx + 22, hy + 23, 6, 0.3, 1.8)
  ctx.stroke()
  ctx.globalAlpha = 1.0

  // Wrist (extending off bottom-right)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.moveTo(hx + 40, hy + 5)
  ctx.quadraticCurveTo(hx + 80, hy + 15, hx + 95, hy + 55)
  ctx.lineTo(hx + 75, hy + 65)
  ctx.quadraticCurveTo(hx + 55, hy + 40, hx + 30, hy + 38)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = skinDark
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

// ============================================================================
// COMMAND RENDERER
// Given a list of commands and a progress (0-1), draws all completed
// commands fully and the active command partially, with pen at the tip.
// Returns the pen position { x, y }.
// ============================================================================
function renderCommands(ctx, commands, progress) {
  if (commands.length === 0) return null

  // Calculate total weight
  let totalWeight = 0
  const weights = commands.map(cmd => {
    const w = cmd.weight || 1
    totalWeight += w
    return w
  })

  let penX = WIDTH / 2, penY = HEIGHT / 2
  let accumulated = 0

  for (let ci = 0; ci < commands.length; ci++) {
    const cmd = commands[ci]
    const cmdStart = accumulated / totalWeight
    const cmdEnd = (accumulated + weights[ci]) / totalWeight
    accumulated += weights[ci]

    if (progress < cmdStart) break

    const cmdProgress = Math.min(1, (progress - cmdStart) / (cmdEnd - cmdStart))

    switch (cmd.type) {
      case 'line': {
        const pts = cmd.points
        const drawCount = Math.floor(cmdProgress * (pts.length - 1)) + 1
        ctx.strokeStyle = cmd.color || COLORS.marker
        ctx.lineWidth = cmd.width || 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < drawCount && i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y)
        }
        // Partial segment for smooth animation
        if (drawCount < pts.length) {
          const frac = (cmdProgress * (pts.length - 1)) - (drawCount - 1)
          const prev = pts[drawCount - 1]
          const next = pts[drawCount]
          if (next) {
            const ix = prev.x + (next.x - prev.x) * frac
            const iy = prev.y + (next.y - prev.y) * frac
            ctx.lineTo(ix, iy)
            penX = ix; penY = iy
          }
        } else {
          penX = pts[pts.length - 1].x
          penY = pts[pts.length - 1].y
        }
        ctx.stroke()
        break
      }

      case 'text': {
        ctx.font = cmd.font || '28px "Poppins", sans-serif'
        ctx.fillStyle = cmd.color || COLORS.marker
        ctx.textAlign = cmd.align || 'left'
        ctx.textBaseline = 'top'
        if (cmd.charByChar) {
          const chars = Math.floor(cmdProgress * cmd.text.length)
          const visible = cmd.text.substring(0, chars)
          ctx.fillText(visible, cmd.x, cmd.y)
          const tw = ctx.measureText(visible).width
          if (cmd.align === 'center') {
            const fullW = ctx.measureText(cmd.text).width
            penX = cmd.x - fullW / 2 + tw
          } else {
            penX = cmd.x + tw
          }
          penY = cmd.y + 5
        } else {
          if (cmdProgress >= 1) {
            ctx.fillText(cmd.text, cmd.x, cmd.y)
          } else {
            ctx.globalAlpha = cmdProgress
            ctx.fillText(cmd.text, cmd.x, cmd.y)
            ctx.globalAlpha = 1.0
          }
          const tw = ctx.measureText(cmd.text).width
          penX = (cmd.align === 'center' ? cmd.x + tw / 2 : cmd.x + tw)
          penY = cmd.y + 5
        }
        break
      }

      case 'fill_rect': {
        ctx.globalAlpha = (cmd.opacity || 1) * Math.min(1, cmdProgress * 3)
        ctx.fillStyle = cmd.color || COLORS.highlight
        ctx.fillRect(cmd.x, cmd.y, cmd.w * Math.min(1, cmdProgress * 1.5), cmd.h)
        ctx.globalAlpha = 1.0
        penX = cmd.x + cmd.w * cmdProgress
        penY = cmd.y + cmd.h / 2
        break
      }

      case 'circle': {
        const pts = cmd.points || makeCirclePoints(cmd.cx, cmd.cy, cmd.r, 4, cmd.seed || 42)
        const drawCount = Math.floor(cmdProgress * pts.length)
        if (cmd.fill && cmdProgress > 0.5) {
          ctx.fillStyle = cmd.fillColor || cmd.color || COLORS.blue
          ctx.globalAlpha = cmd.fillOpacity || 0.2
          ctx.beginPath()
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1.0
        }
        ctx.strokeStyle = cmd.color || COLORS.marker
        ctx.lineWidth = cmd.width || 2.5
        ctx.beginPath()
        for (let i = 0; i < drawCount && i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i].x, pts[i].y)
          else ctx.lineTo(pts[i].x, pts[i].y)
        }
        ctx.stroke()
        if (drawCount > 0 && drawCount <= pts.length) {
          penX = pts[Math.min(drawCount - 1, pts.length - 1)].x
          penY = pts[Math.min(drawCount - 1, pts.length - 1)].y
        }
        break
      }

      case 'bullet': {
        const bp = Math.min(1, cmdProgress * 2)
        ctx.fillStyle = cmd.color || COLORS.accent
        ctx.beginPath()
        ctx.arc(cmd.cx, cmd.cy, cmd.r * bp, 0, Math.PI * 2)
        ctx.fill()
        penX = cmd.cx + cmd.r
        penY = cmd.cy
        break
      }

      case 'check': {
        const pts1 = makeWobblyLinePoints(cmd.x, cmd.y, cmd.x + cmd.size * 0.35, cmd.y + cmd.size * 0.5, 2, cmd.seed || 77)
        const pts2 = makeWobblyLinePoints(cmd.x + cmd.size * 0.35, cmd.y + cmd.size * 0.5, cmd.x + cmd.size, cmd.y - cmd.size * 0.2, 2, (cmd.seed || 77) + 50)
        ctx.strokeStyle = cmd.color || COLORS.green
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        if (cmdProgress < 0.5) {
          const p = cmdProgress * 2
          const dc = Math.floor(p * pts1.length)
          ctx.beginPath()
          for (let i = 0; i < dc && i < pts1.length; i++) {
            if (i === 0) ctx.moveTo(pts1[i].x, pts1[i].y)
            else ctx.lineTo(pts1[i].x, pts1[i].y)
          }
          ctx.stroke()
          if (dc > 0) { penX = pts1[Math.min(dc - 1, pts1.length - 1)].x; penY = pts1[Math.min(dc - 1, pts1.length - 1)].y }
        } else {
          ctx.beginPath()
          pts1.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
          ctx.stroke()
          const p = (cmdProgress - 0.5) * 2
          const dc = Math.floor(p * pts2.length)
          ctx.beginPath()
          for (let i = 0; i < dc && i < pts2.length; i++) {
            if (i === 0) ctx.moveTo(pts2[i].x, pts2[i].y)
            else ctx.lineTo(pts2[i].x, pts2[i].y)
          }
          ctx.stroke()
          if (dc > 0) { penX = pts2[Math.min(dc - 1, pts2.length - 1)].x; penY = pts2[Math.min(dc - 1, pts2.length - 1)].y }
        }
        break
      }

      case 'star': {
        const pts = []
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
          const rad = i % 2 === 0 ? cmd.r : cmd.r * 0.45
          pts.push({ x: cmd.cx + rad * Math.cos(angle), y: cmd.cy + rad * Math.sin(angle) })
        }
        pts.push(pts[0])
        const drawCount = Math.floor(cmdProgress * pts.length)
        if (cmd.fill && cmdProgress > 0.6) {
          ctx.fillStyle = cmd.color || COLORS.accent
          ctx.beginPath()
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
          ctx.fill()
        }
        ctx.strokeStyle = cmd.color || COLORS.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < drawCount; i++) {
          if (i === 0) ctx.moveTo(pts[i].x, pts[i].y)
          else ctx.lineTo(pts[i].x, pts[i].y)
        }
        ctx.stroke()
        if (drawCount > 0) { penX = pts[drawCount - 1].x; penY = pts[drawCount - 1].y }
        break
      }

      case 'pause': {
        break
      }
    }
  }

  return { x: penX, y: penY }
}

// ============================================================================
// BACKGROUND
// ============================================================================
function drawBackground(ctx, seed) {
  const oldRand = _rand
  initRand(seed + 5000)
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Dot grid
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  for (let gx = 50; gx < WIDTH; gx += 40) {
    for (let gy = 50; gy < HEIGHT; gy += 40) {
      ctx.beginPath()
      ctx.arc(gx, gy, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Paper specks
  ctx.fillStyle = 'rgba(0,0,0,0.012)'
  for (let i = 0; i < 100; i++) {
    ctx.beginPath()
    ctx.arc(rnd() * WIDTH, rnd() * HEIGHT, rnd() * 2.5 + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  _rand = oldRand
}

// ============================================================================
// SECTION COMMAND BUILDERS
// ============================================================================

function buildHookCommands(topic, ctx) {
  const cmds = []
  let seed = topic.id * 13

  // Category label
  cmds.push({ type: 'text', text: topic.category.toUpperCase(), x: WIDTH / 2, y: 290, font: 'bold 20px "Poppins", sans-serif', color: COLORS.accent, align: 'center', charByChar: true, weight: 1.5 })

  // Underline under category
  ctx.font = 'bold 20px "Poppins", sans-serif'
  const catW = ctx.measureText(topic.category.toUpperCase()).width
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH / 2 - catW / 2 - 5, 308, WIDTH / 2 + catW / 2 + 5, 308, 2, seed++), color: COLORS.accent, width: 2.5, weight: 0.5 })

  // Title lines
  ctx.font = 'bold 48px "Poppins", sans-serif'
  const titleLines = wrapText(ctx, topic.title, WIDTH - 160)
  titleLines.forEach((line, i) => {
    cmds.push({ type: 'text', text: line, x: WIDTH / 2, y: 350 + i * 62, font: 'bold 48px "Poppins", sans-serif', color: COLORS.marker, align: 'center', charByChar: true, weight: 2 })
  })

  // Circle emphasis around title area
  const circleY = 365 + (titleLines.length - 1) * 31
  cmds.push({ type: 'circle', cx: WIDTH / 2, cy: circleY, r: 100 + titleLines[0].length * 2, color: COLORS.red, width: 2.5, points: makeCirclePoints(WIDTH / 2, circleY, 100 + titleLines[0].length * 2, 8, seed++), weight: 2 })

  // Hook text
  cmds.push({ type: 'pause', weight: 0.3 })
  const hookY = 390 + titleLines.length * 62
  cmds.push({ type: 'text', text: topic.hook, x: WIDTH / 2, y: hookY, font: 'italic 28px "Poppins", sans-serif', color: COLORS.markerLight, align: 'center', charByChar: true, weight: 2.5 })

  return cmds
}

function buildPointsCommands(topic, ctx) {
  const cmds = []
  let seed = topic.id * 17 + 200

  // Section header
  cmds.push({ type: 'text', text: 'HERE\'S THE BREAKDOWN:', x: 90, y: 225, font: 'bold 22px "Poppins", sans-serif', color: COLORS.blue, charByChar: true, weight: 1.5 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(90, 252, 410, 252, 2, seed++), color: COLORS.blue, width: 2.5, weight: 0.5 })
  cmds.push({ type: 'pause', weight: 0.3 })

  // Points
  const pointCount = topic.points.length
  const spacing = Math.min(140, (HEIGHT - 600) / pointCount)
  const startY = 290

  for (let i = 0; i < pointCount; i++) {
    const py = startY + i * spacing

    // Bullet dot
    cmds.push({ type: 'bullet', cx: 105, cy: py + 12, r: 6, color: COLORS.accent, weight: 0.3 })

    // Point text
    ctx.font = '28px "Poppins", sans-serif'
    const lines = wrapText(ctx, topic.points[i], WIDTH - 220)
    lines.forEach((line, li) => {
      cmds.push({ type: 'text', text: line, x: 128, y: py + li * 40, font: '28px "Poppins", sans-serif', color: COLORS.marker, charByChar: true, weight: 2.5 })
    })

    // Highlight underline on CAPS words in first 2 points
    if (i < 2) {
      const capsMatch = topic.points[i].match(/[A-Z]{2,}/)
      if (capsMatch) {
        const beforeW = ctx.measureText(topic.points[i].substring(0, topic.points[i].indexOf(capsMatch[0]))).width
        const wordW = ctx.measureText(capsMatch[0]).width
        cmds.push({ type: 'line', points: makeWobblyLinePoints(128 + beforeW, py + 18, 128 + beforeW + wordW, py + 18, 1, seed++), color: COLORS.accent, width: 5, weight: 0.4 })
      }
    }

    if (i < pointCount - 1) cmds.push({ type: 'pause', weight: 0.2 })
  }

  return cmds
}

function buildDiagramCommands(topic, ctx) {
  const cmds = []
  let seed = topic.id * 23 + 500
  const dx = 80, dy = 310, dw = WIDTH - 160, dh = 460

  // Header
  cmds.push({ type: 'text', text: 'VISUALISED:', x: 90, y: 245, font: 'bold 22px "Poppins", sans-serif', color: COLORS.marker, charByChar: true, weight: 1 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(90, 272, 250, 272, 2, seed++), color: COLORS.marker, width: 2.5, weight: 0.3 })

  // Border box
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx, dy, dx + dw, dy, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.4 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx + dw, dy, dx + dw, dy + dh, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.4 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx + dw, dy + dh, dx, dy + dh, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.4 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx, dy + dh, dx, dy, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.4 })

  const ix = dx + 30, iy = dy + 25, iw = dw - 60, ih = dh - 50

  switch (topic.sketch) {
    case 'growth': {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 30, iy + ih - 20, ix + 30, iy + 10, 3, seed++), color: COLORS.marker, width: 2, weight: 1 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 30, iy + ih - 20, ix + iw - 10, iy + ih - 20, 3, seed++), color: COLORS.marker, width: 2, weight: 1 })
      const curvePts = []
      for (let i = 0; i <= 35; i++) {
        const t = i / 35
        curvePts.push({ x: ix + 40 + t * (iw - 60), y: iy + ih - 30 - Math.pow(t, 2.3) * (ih - 50) })
      }
      cmds.push({ type: 'line', points: curvePts, color: COLORS.green, width: 3.5, weight: 4 })
      cmds.push({ type: 'text', text: 'GROWTH!', x: ix + iw - 140, y: iy + 20, font: 'bold 22px "Poppins", sans-serif', color: COLORS.red, charByChar: true, weight: 1 })
      break
    }
    case 'comparison': {
      const midX = ix + iw / 2
      cmds.push({ type: 'line', points: makeWobblyLinePoints(midX, iy + 5, midX, iy + ih - 5, 2, seed++), color: COLORS.subtle, width: 1.5, weight: 1 })
      cmds.push({ type: 'text', text: '✓ YES', x: ix + iw / 4, y: iy + 15, font: 'bold 26px "Poppins", sans-serif', color: COLORS.green, align: 'center', charByChar: true, weight: 0.8 })
      cmds.push({ type: 'text', text: '✗ NO', x: ix + iw * 3 / 4, y: iy + 15, font: 'bold 26px "Poppins", sans-serif', color: COLORS.red, align: 'center', charByChar: true, weight: 0.8 })
      for (let i = 0; i < 3; i++) {
        cmds.push({ type: 'check', x: ix + 30, y: iy + 65 + i * 55, size: 22, color: COLORS.green, seed: seed++ + i, weight: 0.8 })
      }
      for (let i = 0; i < 3; i++) {
        const bx = midX + 30, by = iy + 65 + i * 55
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx, by, bx + 20, by + 20, 2, seed++), color: COLORS.red, width: 3, weight: 0.4 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx + 20, by, bx, by + 20, 2, seed++), color: COLORS.red, width: 3, weight: 0.4 })
      }
      break
    }
    case 'ladder':
    case 'stack': {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 60, iy + ih - 10, ix + 30, iy + 10, 4, seed++), color: COLORS.marker, width: 2.5, weight: 1 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + iw - 60, iy + ih - 10, ix + iw - 30, iy + 10, 4, seed++), color: COLORS.marker, width: 2.5, weight: 1 })
      for (let i = 0; i < 5; i++) {
        const ry = iy + ih - 40 - i * ((ih - 50) / 5)
        const shrink = i * 5
        const isTop = i === 4
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 40 + shrink, ry, ix + iw - 40 - shrink, ry, 3, seed++), color: isTop ? COLORS.accent : COLORS.marker, width: isTop ? 3 : 2, weight: 0.8 })
      }
      cmds.push({ type: 'star', cx: ix + iw / 2, cy: iy + 25, r: 22, color: COLORS.accent, fill: true, weight: 1 })
      break
    }
    case 'timeline':
    case 'formula': {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 20, iy + ih / 2, ix + iw - 20, iy + ih / 2, 3, seed++), color: COLORS.marker, width: 2, weight: 2 })
      const ax = ix + iw - 20, ay = iy + ih / 2
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ax - 15, ay - 10, ax, ay, 1.5, seed++), color: COLORS.marker, width: 2, weight: 0.3 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ax - 15, ay + 10, ax, ay, 1.5, seed++), color: COLORS.marker, width: 2, weight: 0.3 })
      for (let i = 0; i < 4; i++) {
        const mx = ix + 60 + i * ((iw - 100) / 3)
        cmds.push({ type: 'bullet', cx: mx, cy: ay, r: 8, color: i === 3 ? COLORS.green : COLORS.blue, weight: 0.4 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(mx, ay - 14, mx, ay - 40, 2, seed++), color: COLORS.subtle, width: 1.5, weight: 0.3 })
      }
      break
    }
    case 'shield': {
      const cx = ix + iw / 2, cy = iy + ih / 2
      const s = Math.min(iw, ih) * 0.3
      const shieldPts = [
        { x: cx, y: cy - s }, { x: cx + s * 0.8, y: cy - s * 0.4 },
        { x: cx + s * 0.75, y: cy + s * 0.3 }, { x: cx, y: cy + s * 0.9 },
        { x: cx - s * 0.75, y: cy + s * 0.3 }, { x: cx - s * 0.8, y: cy - s * 0.4 },
        { x: cx, y: cy - s },
      ]
      cmds.push({ type: 'line', points: shieldPts, color: COLORS.blue, width: 3, weight: 3 })
      cmds.push({ type: 'fill_rect', x: cx - s * 0.7, y: cy - s * 0.3, w: s * 1.4, h: s * 1.1, color: 'rgba(46,110,190,0.1)', weight: 0.5 })
      cmds.push({ type: 'check', x: cx - 25, y: cy - 10, size: 50, color: COLORS.green, seed: seed++, weight: 1.5 })
      break
    }
    case 'pie':
    case 'jars':
    case 'three_buckets': {
      const cx = ix + iw / 2, cy = iy + ih / 2 - 10, r = Math.min(iw, ih) / 2 - 30
      const slices = [{ pct: 0.50, color: COLORS.blue }, { pct: 0.30, color: COLORS.accent }, { pct: 0.20, color: COLORS.green }]
      let startA = -Math.PI / 2
      slices.forEach((sl) => {
        const endA = startA + sl.pct * Math.PI * 2
        cmds.push({ type: 'line', points: makeWobblyLinePoints(cx, cy, cx + r * Math.cos(startA), cy + r * Math.sin(startA), 2, seed++), color: sl.color, width: 2, weight: 0.4 })
        const arcPts = []
        const steps = Math.floor(sl.pct * 30) + 5
        for (let i = 0; i <= steps; i++) {
          const a = startA + (endA - startA) * (i / steps)
          arcPts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
        }
        cmds.push({ type: 'line', points: arcPts, color: sl.color, width: 3, weight: 2 })
        const midA = startA + sl.pct * Math.PI
        cmds.push({ type: 'text', text: `${sl.pct * 100}%`, x: cx + r * 0.55 * Math.cos(midA), y: cy + r * 0.55 * Math.sin(midA) - 12, font: 'bold 24px "Poppins", sans-serif', color: sl.color, align: 'center', charByChar: false, weight: 0.5 })
        startA = endA
      })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(cx, cy, cx + r * Math.cos(startA), cy + r * Math.sin(startA), 2, seed++), color: slices[slices.length - 1].color, width: 2, weight: 0.3 })
      break
    }
    case 'flow':
    case 'cycle':
    case 'scroll': {
      const labels = ['IN', 'PROCESS', 'OUT']
      const bw = 100, bh = 50
      const totalBW = labels.length * bw + (labels.length - 1) * 60
      const sx = ix + (iw - totalBW) / 2
      const my = iy + ih / 2
      labels.forEach((label, li) => {
        const bx = sx + li * (bw + 60)
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx, my - bh / 2, bx + bw, my - bh / 2, 3, seed++), color: li === 2 ? COLORS.green : COLORS.blue, width: 2, weight: 0.4 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx + bw, my - bh / 2, bx + bw, my + bh / 2, 3, seed++), color: li === 2 ? COLORS.green : COLORS.blue, width: 2, weight: 0.4 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx + bw, my + bh / 2, bx, my + bh / 2, 3, seed++), color: li === 2 ? COLORS.green : COLORS.blue, width: 2, weight: 0.4 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx, my + bh / 2, bx, my - bh / 2, 3, seed++), color: li === 2 ? COLORS.green : COLORS.blue, width: 2, weight: 0.4 })
        cmds.push({ type: 'text', text: label, x: bx + bw / 2, y: my - 10, font: 'bold 18px "Poppins", sans-serif', color: li === 2 ? COLORS.green : COLORS.blue, align: 'center', charByChar: false, weight: 0.3 })
        if (li < labels.length - 1) {
          cmds.push({ type: 'line', points: makeWobblyLinePoints(bx + bw + 8, my, bx + bw + 48, my, 2, seed++), color: COLORS.subtle, width: 2, weight: 0.4 })
          cmds.push({ type: 'line', points: makeWobblyLinePoints(bx + bw + 38, my - 8, bx + bw + 50, my, 1, seed++), color: COLORS.subtle, width: 2, weight: 0.15 })
          cmds.push({ type: 'line', points: makeWobblyLinePoints(bx + bw + 38, my + 8, bx + bw + 50, my, 1, seed++), color: COLORS.subtle, width: 2, weight: 0.15 })
        }
      })
      break
    }
    case 'checklist': {
      for (let i = 0; i < 5; i++) {
        const cy = iy + 15 + i * 42
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 20, cy, ix + 42, cy, 2, seed++), color: COLORS.marker, width: 2, weight: 0.15 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 42, cy, ix + 42, cy + 22, 2, seed++), color: COLORS.marker, width: 2, weight: 0.15 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 42, cy + 22, ix + 20, cy + 22, 2, seed++), color: COLORS.marker, width: 2, weight: 0.15 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 20, cy + 22, ix + 20, cy, 2, seed++), color: COLORS.marker, width: 2, weight: 0.15 })
        cmds.push({ type: 'check', x: ix + 23, y: cy + 4, size: 16, color: COLORS.green, seed: seed++ + i, weight: 0.5 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 55, cy + 11, ix + 55 + 100 + (seed % 100), cy + 11, 1, seed++), color: COLORS.bgLine, width: 7, weight: 0.3 })
      }
      break
    }
    default: {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 30, iy + ih - 20, ix + 30, iy + 10, 3, seed++), color: COLORS.marker, width: 2, weight: 1 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix + 30, iy + ih - 20, ix + iw - 10, iy + ih - 20, 3, seed++), color: COLORS.marker, width: 2, weight: 1 })
      const pts = []
      for (let i = 0; i <= 30; i++) {
        const t = i / 30
        pts.push({ x: ix + 40 + t * (iw - 60), y: iy + ih - 30 - Math.pow(t, 2) * (ih - 50) })
      }
      cmds.push({ type: 'line', points: pts, color: COLORS.green, width: 3.5, weight: 4 })
    }
  }

  return cmds
}

function buildTakeawayCommands(topic, ctx) {
  const cmds = []
  let seed = topic.id * 31 + 800

  cmds.push({ type: 'fill_rect', x: 70, y: 310, w: WIDTH - 140, h: 400, color: COLORS.highlight, opacity: 0.6, weight: 1 })
  cmds.push({ type: 'fill_rect', x: 70, y: 310, w: 6, h: 400, color: COLORS.accent, weight: 0.3 })
  cmds.push({ type: 'star', cx: 120, cy: 355, r: 18, color: COLORS.accent, fill: true, weight: 1 })
  cmds.push({ type: 'text', text: 'KEY TAKEAWAY', x: 150, y: 340, font: 'bold 26px "Poppins", sans-serif', color: COLORS.accent, charByChar: true, weight: 1.5 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(150, 372, 350, 372, 2, seed++), color: COLORS.accent, width: 2.5, weight: 0.4 })
  cmds.push({ type: 'pause', weight: 0.3 })

  ctx.font = 'bold 32px "Poppins", sans-serif'
  const lines = wrapText(ctx, topic.takeaway, WIDTH - 220)
  lines.forEach((line, i) => {
    cmds.push({ type: 'text', text: line, x: 100, y: 400 + i * 50, font: 'bold 32px "Poppins", sans-serif', color: COLORS.marker, charByChar: true, weight: 3 })
  })

  return cmds
}

function buildBrandCommands(topic) {
  const cmds = []
  let seed = topic.id * 37 + 1100

  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH / 2 - 80, HEIGHT / 2 - 80, WIDTH / 2 + 80, HEIGHT / 2 - 80, 3, seed++), color: COLORS.accent, width: 2, weight: 0.5 })
  cmds.push({ type: 'text', text: 'THRIVE', x: WIDTH / 2 - 140, y: HEIGHT / 2 - 50, font: 'bold 42px "Poppins", sans-serif', color: COLORS.brand1, charByChar: true, weight: 1.5 })
  cmds.push({ type: 'text', text: 'RICHLY', x: WIDTH / 2 + 20, y: HEIGHT / 2 - 50, font: 'bold 42px "Poppins", sans-serif', color: COLORS.brand2, charByChar: true, weight: 1.5 })
  cmds.push({ type: 'text', text: 'Wealth wisdom, sketched simply.', x: WIDTH / 2, y: HEIGHT / 2 + 15, font: '22px "Poppins", sans-serif', color: COLORS.subtle, align: 'center', charByChar: true, weight: 2 })

  // CTA box
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH / 2 - 180, HEIGHT / 2 + 55, WIDTH / 2 + 180, HEIGHT / 2 + 55, 3, seed++), color: COLORS.accent, width: 2, weight: 0.3 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH / 2 + 180, HEIGHT / 2 + 55, WIDTH / 2 + 180, HEIGHT / 2 + 95, 3, seed++), color: COLORS.accent, width: 2, weight: 0.3 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH / 2 + 180, HEIGHT / 2 + 95, WIDTH / 2 - 180, HEIGHT / 2 + 95, 3, seed++), color: COLORS.accent, width: 2, weight: 0.3 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH / 2 - 180, HEIGHT / 2 + 95, WIDTH / 2 - 180, HEIGHT / 2 + 55, 3, seed++), color: COLORS.accent, width: 2, weight: 0.3 })
  cmds.push({ type: 'text', text: 'Follow for daily sketches', x: WIDTH / 2, y: HEIGHT / 2 + 60, font: 'bold 24px "Poppins", sans-serif', color: COLORS.accent, align: 'center', charByChar: true, weight: 1.5 })

  return cmds
}

// ============================================================================
// FRAME GENERATION
// ============================================================================
function generateFrames(topic, framesDir) {
  console.log('  ✏️  Generating doodle frames with animated pen...')

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')
  const bgSeed = topic.id * 7 + 99
  initRand(bgSeed)

  const sectionDefs = [
    { name: 'hook', duration: 6, builder: () => buildHookCommands(topic, ctx) },
    { name: 'points', duration: 24, builder: () => buildPointsCommands(topic, ctx) },
    { name: 'diagram', duration: 16, builder: () => buildDiagramCommands(topic, ctx) },
    { name: 'takeaway', duration: 16, builder: () => buildTakeawayCommands(topic, ctx) },
    { name: 'brand', duration: 5, builder: () => buildBrandCommands(topic) },
  ]

  const TRANS = 0.6
  const sections = sectionDefs.map(s => ({ ...s, commands: s.builder() }))
  const totalDuration = sections.reduce((s, sec) => s + sec.duration, 0) + TRANS * (sections.length - 1)
  const totalFrames = Math.ceil(totalDuration * FPS)

  console.log(`  📐 ${sections.length} sections, ${totalDuration.toFixed(1)}s, ${totalFrames} frames`)

  fs.mkdirSync(framesDir, { recursive: true })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS

    drawBackground(ctx, bgSeed)

    let elapsed = 0
    let penPos = null
    let showPen = true

    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si]
      const secStart = elapsed
      const secEnd = elapsed + sec.duration

      if (t >= secStart && t < secEnd + TRANS / 2) {
        let alpha = 1.0
        if (t < secStart + TRANS / 2) alpha = Math.min(1, (t - secStart) / (TRANS / 2))
        if (t > secEnd - TRANS / 2) alpha = Math.max(0, 1 - (t - (secEnd - TRANS / 2)) / (TRANS / 2))

        const secT = Math.min(1, (t - secStart) / sec.duration)

        ctx.globalAlpha = alpha
        penPos = renderCommands(ctx, sec.commands, secT)
        ctx.globalAlpha = 1.0

        if (alpha < 0.5 || (sec.name === 'brand' && secT > 0.9)) showPen = false
        if (alpha > 0) break
      }
      elapsed += sec.duration + TRANS
    }

    // Draw the animated hand + pen
    if (penPos && showPen) {
      drawPen(ctx, penPos.x, penPos.y)
      if (frame === FPS * 2) console.log(`  ✋ Hand confirmed visible at frame ${frame} — position (${penPos.x.toFixed(0)}, ${penPos.y.toFixed(0)})`)
    } else if (frame === FPS * 2) {
      console.log(`  ⚠️  Hand NOT drawn at frame ${frame} — penPos=${!!penPos}, showPen=${showPen}`)
    }

    // Watermark
    ctx.globalAlpha = 0.25
    ctx.font = '16px "Poppins", sans-serif'
    ctx.fillStyle = COLORS.subtle
    ctx.textAlign = 'center'
    ctx.fillText('THRIVE RICHLY', WIDTH / 2, HEIGHT - 35)
    ctx.globalAlpha = 1.0

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
// VIDEO ASSEMBLY
// ============================================================================
function assembleVideo(framesDir, outputPath, duration) {
  console.log('  🎬 Assembling video...')

  let musicPath = null
  if (fs.existsSync(MUSIC_DIR)) {
    const files = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|aac|m4a|wav)$/i.test(f))
    if (files.length > 0) {
      musicPath = path.join(MUSIC_DIR, files[Math.floor(Math.random() * files.length)])
      console.log(`  🎵 Music: ${path.basename(musicPath)}`)
    }
  }

  if (musicPath) {
    const fade = Math.max(0, duration - 2)
    try {
      execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" -i "${musicPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -af "afade=t=in:d=1.5,afade=t=out:st=${fade}:d=2,volume=0.3" -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
      console.log(`  ✅ Video (with music): ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB`)
      return
    } catch (e) { console.log('  ⚠️  Music failed, using silent...') }
  }

  const noAudio = outputPath.replace('.mp4', '_v.mp4')
  execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${noAudio}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
  try {
    execSync(`ffmpeg -y -i "${noAudio}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -shortest -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
  } catch (e) { fs.copyFileSync(noAudio, outputPath) }
  try { fs.unlinkSync(noAudio) } catch (e) {}

  console.log(`  ✅ Video: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB`)
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
  return caps[topic.id % caps.length]
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
    console.log('✅ All sketch topics posted!')
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
  console.log('✏️  Thrive Richly — Doodle Sketch v2 (Animated Pen)\n')
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
    console.log(`\n✅ "${topic.title}" posted`)
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`)
    process.exit(1)
  }

  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }) } catch (e) {}

  console.log('\n' + '='.repeat(50))
  console.log(`🎉 Sketch published: "${topic.title}"`)
  console.log(`📊 Remaining: ${remaining}`)
  console.log('='.repeat(50))
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1) })
