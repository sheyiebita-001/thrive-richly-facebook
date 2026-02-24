#!/usr/bin/env node

/**
 * Thrive Richly — Long-Form Financial Empowerment Video Generator
 * 
 * Creates 5-7 minute doodle-style educational videos with animated
 * hand/pen drawing everything on screen. For deeper financial topics
 * that drive watch time and engagement.
 * 
 * Structure per video:
 *   1. Hook/Intro (15s) — attention grabber + title
 *   2. Sections (7-9 × ~40s each) — heading + points + diagram
 *   3. Takeaway (20s) — golden box summary
 *   4. Brand/CTA (10s) — follow prompt
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
const TOPICS_FILE = path.join(__dirname, 'long-topics.json')
const TEMP_DIR = path.join(__dirname, '..', 'temp-long')
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
let _rand
function seededRandom(seed) {
  let s = seed
  return function () { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}
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
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = word }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

// ============================================================================
// WOBBLY LINE POINTS
// ============================================================================
function makeWobblyLinePoints(x1, y1, x2, y2, wobble, seed) {
  const old = _rand; initRand(seed)
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
  _rand = old; return pts
}

function makeCirclePoints(cx, cy, r, wobble, seed) {
  const old = _rand; initRand(seed)
  const pts = []
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 2
    const wr = r + jit(wobble)
    pts.push({ x: cx + wr * Math.cos(a), y: cy + wr * Math.sin(a) })
  }
  _rand = old; return pts
}

// ============================================================================
// HAND + MARKER RENDERER
// ============================================================================
function drawPen(ctx, x, y) {
  ctx.save()
  const hx = x + 35, hy = y + 45

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath(); ctx.ellipse(hx + 12, hy + 50, 70, 35, 0.2, 0, Math.PI * 2); ctx.fill()

  // Marker pen
  ctx.save(); ctx.translate(hx - 10, hy - 30); ctx.rotate(-0.65)
  const penLen = 180, penW = 18
  const penGrad = ctx.createLinearGradient(0, -penLen, 0, 20)
  penGrad.addColorStop(0, '#2A2A2A'); penGrad.addColorStop(0.4, '#383838')
  penGrad.addColorStop(0.85, '#2E2E2E'); penGrad.addColorStop(1, '#1A1A1A')
  ctx.fillStyle = penGrad
  ctx.beginPath(); ctx.moveTo(-penW/2, -penLen); ctx.lineTo(penW/2, -penLen)
  ctx.lineTo(penW/2-1, 10); ctx.lineTo(-penW/2+1, 10); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-3, -penLen+15, 5, penLen-30)
  ctx.fillStyle = '#C49A2A'; ctx.fillRect(-penW/2-1, -penLen, penW+2, 12)
  ctx.fillRect(-penW/2, -penLen*0.4, penW, 6)
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-7,10); ctx.lineTo(7,10)
  ctx.lineTo(1,28); ctx.lineTo(-1,28); ctx.closePath(); ctx.fill()
  ctx.restore()

  // Hand (fist)
  const skin = '#F0C8A0', skinDark = '#D4A574', skinLight = '#FAE0C0'
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hx+20, hy+18, 52, 40, 0.3, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = skinDark; ctx.lineWidth = 2; ctx.stroke()
  // Thumb
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hx-14, hy-12, 14, 28, -0.5, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = skinDark; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.fillStyle = skinLight; ctx.beginPath(); ctx.ellipse(hx-16, hy-16, 6, 12, -0.5, 0, Math.PI*2); ctx.fill()
  // Fingers
  const fingers = [[-2, 2, 13, 20, -0.3], [10, 12, 12, 18, -0.15], [22, 20, 11, 16, 0], [34, 26, 9, 13, 0.15]]
  fingers.forEach(([fx, fy, rx, ry, rot]) => {
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hx+fx, hy+fy, rx, ry, rot, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = skinDark; ctx.lineWidth = 1.5; ctx.stroke()
  })
  // Knuckle lines
  ctx.strokeStyle = skinDark; ctx.lineWidth = 1; ctx.globalAlpha = 0.4
  ;[[-2, 5, 8], [10, 15, 7], [22, 23, 6]].forEach(([kx, ky, kr]) => {
    ctx.beginPath(); ctx.arc(hx+kx, hy+ky, kr, 0.3, 2.0); ctx.stroke()
  })
  ctx.globalAlpha = 1.0
  // Wrist
  ctx.fillStyle = skin; ctx.beginPath()
  ctx.moveTo(hx+40, hy+5); ctx.quadraticCurveTo(hx+80, hy+15, hx+95, hy+55)
  ctx.lineTo(hx+75, hy+65); ctx.quadraticCurveTo(hx+55, hy+40, hx+30, hy+38)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = skinDark; ctx.lineWidth = 1.5; ctx.stroke()

  ctx.restore()
}

// ============================================================================
// COMMAND RENDERER
// ============================================================================
function renderCommands(ctx, commands, progress) {
  if (!commands.length) return null
  let totalWeight = 0
  const weights = commands.map(cmd => { const w = cmd.weight || 1; totalWeight += w; return w })
  let penX = WIDTH / 2, penY = HEIGHT / 2, accumulated = 0

  for (let ci = 0; ci < commands.length; ci++) {
    const cmd = commands[ci]
    const cmdStart = accumulated / totalWeight
    const cmdEnd = (accumulated + weights[ci]) / totalWeight
    accumulated += weights[ci]
    if (progress < cmdStart) break
    const p = Math.min(1, (progress - cmdStart) / (cmdEnd - cmdStart))

    switch (cmd.type) {
      case 'line': {
        const pts = cmd.points
        const dc = Math.floor(p * (pts.length - 1)) + 1
        ctx.strokeStyle = cmd.color || COLORS.marker; ctx.lineWidth = cmd.width || 2.5
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < dc && i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        if (dc < pts.length) {
          const frac = (p * (pts.length - 1)) - (dc - 1)
          const prev = pts[dc - 1], next = pts[dc]
          if (next) { penX = prev.x + (next.x - prev.x) * frac; penY = prev.y + (next.y - prev.y) * frac; ctx.lineTo(penX, penY) }
        } else { penX = pts[pts.length - 1].x; penY = pts[pts.length - 1].y }
        ctx.stroke(); break
      }
      case 'text': {
        ctx.font = cmd.font || '28px "Poppins", sans-serif'
        ctx.fillStyle = cmd.color || COLORS.marker
        ctx.textAlign = cmd.align || 'left'; ctx.textBaseline = 'top'
        if (cmd.charByChar) {
          const chars = Math.floor(p * cmd.text.length)
          const vis = cmd.text.substring(0, chars)
          ctx.fillText(vis, cmd.x, cmd.y)
          const tw = ctx.measureText(vis).width
          penX = cmd.align === 'center' ? cmd.x - ctx.measureText(cmd.text).width / 2 + tw : cmd.x + tw
          penY = cmd.y + 5
        } else {
          ctx.globalAlpha = p >= 1 ? 1 : p; ctx.fillText(cmd.text, cmd.x, cmd.y); ctx.globalAlpha = 1
          penX = cmd.x + ctx.measureText(cmd.text).width; penY = cmd.y + 5
        }
        break
      }
      case 'fill_rect': {
        ctx.globalAlpha = (cmd.opacity || 1) * Math.min(1, p * 3)
        ctx.fillStyle = cmd.color || COLORS.highlight
        ctx.fillRect(cmd.x, cmd.y, cmd.w * Math.min(1, p * 1.5), cmd.h)
        ctx.globalAlpha = 1; penX = cmd.x + cmd.w * p; penY = cmd.y + cmd.h / 2; break
      }
      case 'circle': {
        const pts = cmd.points || makeCirclePoints(cmd.cx, cmd.cy, cmd.r, 4, 42)
        const dc = Math.floor(p * pts.length)
        ctx.strokeStyle = cmd.color || COLORS.marker; ctx.lineWidth = cmd.width || 2.5
        ctx.beginPath()
        for (let i = 0; i < dc && i < pts.length; i++) { i === 0 ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y) }
        ctx.stroke()
        if (dc > 0) { penX = pts[Math.min(dc-1, pts.length-1)].x; penY = pts[Math.min(dc-1, pts.length-1)].y }
        break
      }
      case 'bullet': {
        const bp = Math.min(1, p * 2)
        ctx.fillStyle = cmd.color || COLORS.accent
        ctx.beginPath(); ctx.arc(cmd.cx, cmd.cy, cmd.r * bp, 0, Math.PI * 2); ctx.fill()
        penX = cmd.cx + cmd.r; penY = cmd.cy; break
      }
      case 'check': {
        const p1 = makeWobblyLinePoints(cmd.x, cmd.y, cmd.x + cmd.size * 0.35, cmd.y + cmd.size * 0.5, 2, cmd.seed || 77)
        const p2 = makeWobblyLinePoints(cmd.x + cmd.size * 0.35, cmd.y + cmd.size * 0.5, cmd.x + cmd.size, cmd.y - cmd.size * 0.2, 2, (cmd.seed || 77) + 50)
        ctx.strokeStyle = cmd.color || COLORS.green; ctx.lineWidth = 3; ctx.lineCap = 'round'
        const allPts = [...p1, ...p2]
        const dc = Math.floor(p * allPts.length)
        ctx.beginPath()
        for (let i = 0; i < dc; i++) { i === 0 ? ctx.moveTo(allPts[i].x, allPts[i].y) : ctx.lineTo(allPts[i].x, allPts[i].y) }
        ctx.stroke()
        if (dc > 0) { penX = allPts[dc-1].x; penY = allPts[dc-1].y }
        break
      }
      case 'star': {
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          pts.push({ x: cmd.cx + (i % 2 === 0 ? cmd.r : cmd.r * 0.45) * Math.cos(a), y: cmd.cy + (i % 2 === 0 ? cmd.r : cmd.r * 0.45) * Math.sin(a) })
        }
        pts.push(pts[0])
        const dc = Math.floor(p * pts.length)
        if (cmd.fill && p > 0.6) { ctx.fillStyle = cmd.color || COLORS.accent; ctx.beginPath(); pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)); ctx.fill() }
        ctx.strokeStyle = cmd.color || COLORS.accent; ctx.lineWidth = 2; ctx.beginPath()
        for (let i = 0; i < dc; i++) { i === 0 ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y) }
        ctx.stroke()
        if (dc > 0) { penX = pts[dc-1].x; penY = pts[dc-1].y }
        break
      }
      case 'pause': break
    }
  }
  return { x: penX, y: penY }
}

// ============================================================================
// BACKGROUND
// ============================================================================
function drawBackground(ctx, seed) {
  const old = _rand; initRand(seed + 5000)
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  for (let gx = 50; gx < WIDTH; gx += 40) for (let gy = 50; gy < HEIGHT; gy += 40) { ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill() }
  ctx.fillStyle = 'rgba(0,0,0,0.012)'
  for (let i = 0; i < 80; i++) { ctx.beginPath(); ctx.arc(rnd() * WIDTH, rnd() * HEIGHT, rnd() * 2 + 0.5, 0, Math.PI * 2); ctx.fill() }
  _rand = old
}

// ============================================================================
// SECTION COMMAND BUILDERS
// ============================================================================

function buildHookCommands(topic, ctx) {
  const cmds = []
  let seed = topic.id * 13

  // Category
  cmds.push({ type: 'text', text: topic.category.toUpperCase(), x: WIDTH / 2, y: 320, font: 'bold 22px "Poppins", sans-serif', color: COLORS.accent, align: 'center', charByChar: true, weight: 1 })
  ctx.font = 'bold 22px "Poppins", sans-serif'
  const catW = ctx.measureText(topic.category.toUpperCase()).width
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH/2 - catW/2 - 5, 340, WIDTH/2 + catW/2 + 5, 340, 2, seed++), color: COLORS.accent, width: 2.5, weight: 0.4 })

  // Title
  ctx.font = 'bold 44px "Poppins", sans-serif'
  const titleLines = wrapText(ctx, topic.title, WIDTH - 140)
  titleLines.forEach((line, i) => {
    cmds.push({ type: 'text', text: line, x: WIDTH / 2, y: 380 + i * 58, font: 'bold 44px "Poppins", sans-serif', color: COLORS.marker, align: 'center', charByChar: true, weight: 2 })
  })

  // Circle emphasis
  const cy = 395 + (titleLines.length - 1) * 29
  cmds.push({ type: 'circle', cx: WIDTH/2, cy, r: 90 + titleLines[0].length * 2, color: COLORS.red, width: 2.5, points: makeCirclePoints(WIDTH/2, cy, 90 + titleLines[0].length * 2, 8, seed++), weight: 1.5 })

  // Hook
  cmds.push({ type: 'pause', weight: 0.3 })
  const hookY = 420 + titleLines.length * 58
  ctx.font = 'italic 26px "Poppins", sans-serif'
  const hookLines = wrapText(ctx, topic.hook, WIDTH - 160)
  hookLines.forEach((line, i) => {
    cmds.push({ type: 'text', text: line, x: WIDTH / 2, y: hookY + i * 38, font: 'italic 26px "Poppins", sans-serif', color: COLORS.markerLight, align: 'center', charByChar: true, weight: 2 })
  })

  return cmds
}

function buildSectionCommands(section, sectionIndex, topic, ctx) {
  const cmds = []
  let seed = topic.id * 100 + sectionIndex * 50

  // Section number + heading
  const secNum = `PART ${sectionIndex + 1}`
  cmds.push({ type: 'text', text: secNum, x: 80, y: 240, font: 'bold 18px "Poppins", sans-serif', color: COLORS.subtle, charByChar: true, weight: 0.6 })

  ctx.font = 'bold 32px "Poppins", sans-serif'
  const headLines = wrapText(ctx, section.heading, WIDTH - 160)
  headLines.forEach((line, i) => {
    cmds.push({ type: 'text', text: line, x: 80, y: 268 + i * 44, font: 'bold 32px "Poppins", sans-serif', color: COLORS.marker, charByChar: true, weight: 1.5 })
  })

  // Underline
  const ulY = 278 + headLines.length * 44
  cmds.push({ type: 'line', points: makeWobblyLinePoints(80, ulY, 400, ulY, 2, seed++), color: COLORS.blue, width: 3, weight: 0.4 })
  cmds.push({ type: 'pause', weight: 0.3 })

  // Points
  const startY = ulY + 20
  const maxPointHeight = HEIGHT - startY - 100
  const spacing = Math.min(110, maxPointHeight / section.points.length)

  section.points.forEach((point, pi) => {
    const py = startY + pi * spacing

    // Bullet
    cmds.push({ type: 'bullet', cx: 95, cy: py + 14, r: 5, color: COLORS.accent, weight: 0.2 })

    // Text
    ctx.font = '24px "Poppins", sans-serif'
    const lines = wrapText(ctx, point, WIDTH - 200)
    lines.forEach((line, li) => {
      cmds.push({ type: 'text', text: line, x: 115, y: py + li * 34, font: '24px "Poppins", sans-serif', color: COLORS.marker, charByChar: true, weight: 2 })
    })

    if (pi < section.points.length - 1) cmds.push({ type: 'pause', weight: 0.15 })
  })

  return cmds
}

function buildDiagramCommands(section, sectionIndex, topic, ctx) {
  const cmds = []
  let seed = topic.id * 200 + sectionIndex * 70
  const dx = 80, dy = 300, dw = WIDTH - 160, dh = 420
  const ix = dx + 25, iy = dy + 20, iw = dw - 50, ih = dh - 40

  // Header
  cmds.push({ type: 'text', text: section.heading.toUpperCase(), x: WIDTH / 2, y: 255, font: 'bold 20px "Poppins", sans-serif', color: COLORS.subtle, align: 'center', charByChar: true, weight: 0.8 })

  // Box border
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx, dy, dx+dw, dy, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.3 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx+dw, dy, dx+dw, dy+dh, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.3 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx+dw, dy+dh, dx, dy+dh, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.3 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(dx, dy+dh, dx, dy, 3, seed++), color: COLORS.bgLine, width: 1.5, weight: 0.3 })

  // Diagram based on sketch type
  const sketch = section.sketch || 'growth'
  switch (sketch) {
    case 'growth': {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+30, iy+ih-20, ix+30, iy+10, 3, seed++), color: COLORS.marker, width: 2, weight: 0.8 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+30, iy+ih-20, ix+iw-10, iy+ih-20, 3, seed++), color: COLORS.marker, width: 2, weight: 0.8 })
      const pts = []; for (let i = 0; i <= 35; i++) { const t = i/35; pts.push({ x: ix+40+t*(iw-60), y: iy+ih-30-Math.pow(t, 2.3)*(ih-50) }) }
      cmds.push({ type: 'line', points: pts, color: COLORS.green, width: 3.5, weight: 3 })
      break
    }
    case 'comparison': {
      const mid = ix + iw/2
      cmds.push({ type: 'line', points: makeWobblyLinePoints(mid, iy+5, mid, iy+ih-5, 2, seed++), color: COLORS.subtle, width: 1.5, weight: 0.8 })
      cmds.push({ type: 'text', text: '✓ DO', x: ix+iw/4, y: iy+15, font: 'bold 24px "Poppins", sans-serif', color: COLORS.green, align: 'center', charByChar: true, weight: 0.5 })
      cmds.push({ type: 'text', text: '✗ DON\'T', x: ix+iw*3/4, y: iy+15, font: 'bold 24px "Poppins", sans-serif', color: COLORS.red, align: 'center', charByChar: true, weight: 0.5 })
      for (let i = 0; i < 3; i++) { cmds.push({ type: 'check', x: ix+20, y: iy+55+i*50, size: 20, color: COLORS.green, seed: seed++, weight: 0.6 }) }
      for (let i = 0; i < 3; i++) {
        const bx = mid+20, by = iy+55+i*50
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx, by, bx+18, by+18, 2, seed++), color: COLORS.red, width: 3, weight: 0.3 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx+18, by, bx, by+18, 2, seed++), color: COLORS.red, width: 3, weight: 0.3 })
      }
      break
    }
    case 'ladder':
    case 'stack': {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+60, iy+ih-10, ix+30, iy+10, 4, seed++), color: COLORS.marker, width: 2.5, weight: 0.8 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+iw-60, iy+ih-10, ix+iw-30, iy+10, 4, seed++), color: COLORS.marker, width: 2.5, weight: 0.8 })
      for (let i = 0; i < 5; i++) {
        const ry = iy+ih-35-i*((ih-45)/5), isTop = i === 4
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+40+i*4, ry, ix+iw-40-i*4, ry, 3, seed++), color: isTop ? COLORS.accent : COLORS.marker, width: isTop ? 3 : 2, weight: 0.6 })
      }
      cmds.push({ type: 'star', cx: ix+iw/2, cy: iy+20, r: 20, color: COLORS.accent, fill: true, weight: 0.8 })
      break
    }
    case 'timeline':
    case 'formula': {
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+15, iy+ih/2, ix+iw-15, iy+ih/2, 3, seed++), color: COLORS.marker, width: 2, weight: 1.5 })
      const ax = ix+iw-15, ay = iy+ih/2
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ax-12, ay-8, ax, ay, 1, seed++), color: COLORS.marker, width: 2, weight: 0.2 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ax-12, ay+8, ax, ay, 1, seed++), color: COLORS.marker, width: 2, weight: 0.2 })
      for (let i = 0; i < 4; i++) {
        const mx = ix+50+i*((iw-80)/3)
        cmds.push({ type: 'bullet', cx: mx, cy: ay, r: 7, color: i === 3 ? COLORS.green : COLORS.blue, weight: 0.3 })
      }
      break
    }
    case 'pie':
    case 'three_buckets':
    case 'jars': {
      const cx = ix+iw/2, cy = iy+ih/2, r = Math.min(iw,ih)/2-25
      const slices = [{ p: 0.5, c: COLORS.blue }, { p: 0.3, c: COLORS.accent }, { p: 0.2, c: COLORS.green }]
      let sa = -Math.PI/2
      slices.forEach(sl => {
        const ea = sa + sl.p * Math.PI * 2
        cmds.push({ type: 'line', points: makeWobblyLinePoints(cx, cy, cx+r*Math.cos(sa), cy+r*Math.sin(sa), 2, seed++), color: sl.c, width: 2, weight: 0.3 })
        const arc = []; const st = Math.floor(sl.p*25)+5
        for (let i = 0; i <= st; i++) { const a = sa+(ea-sa)*(i/st); arc.push({ x: cx+r*Math.cos(a), y: cy+r*Math.sin(a) }) }
        cmds.push({ type: 'line', points: arc, color: sl.c, width: 3, weight: 1.5 })
        const ma = sa+sl.p*Math.PI
        cmds.push({ type: 'text', text: `${sl.p*100}%`, x: cx+r*0.55*Math.cos(ma), y: cy+r*0.55*Math.sin(ma)-10, font: 'bold 22px "Poppins", sans-serif', color: sl.c, align: 'center', weight: 0.3 })
        sa = ea
      })
      break
    }
    case 'shield': {
      const cx = ix+iw/2, cy = iy+ih/2, s = Math.min(iw,ih)*0.28
      const sp = [{x:cx,y:cy-s},{x:cx+s*0.8,y:cy-s*0.4},{x:cx+s*0.75,y:cy+s*0.3},{x:cx,y:cy+s*0.9},{x:cx-s*0.75,y:cy+s*0.3},{x:cx-s*0.8,y:cy-s*0.4},{x:cx,y:cy-s}]
      cmds.push({ type: 'line', points: sp, color: COLORS.blue, width: 3, weight: 2.5 })
      cmds.push({ type: 'check', x: cx-20, y: cy-8, size: 40, color: COLORS.green, seed: seed++, weight: 1 })
      break
    }
    case 'flow':
    case 'cycle': {
      const labels = ['START', 'PROCESS', 'RESULT']
      const bw = 90, bh = 45, gap = 50
      const sx = ix + (iw - labels.length*bw - (labels.length-1)*gap) / 2
      const my = iy + ih/2
      labels.forEach((l, li) => {
        const bx = sx + li*(bw+gap)
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx, my-bh/2, bx+bw, my-bh/2, 2, seed++), color: COLORS.blue, width: 2, weight: 0.3 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx+bw, my-bh/2, bx+bw, my+bh/2, 2, seed++), color: COLORS.blue, width: 2, weight: 0.3 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx+bw, my+bh/2, bx, my+bh/2, 2, seed++), color: COLORS.blue, width: 2, weight: 0.3 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(bx, my+bh/2, bx, my-bh/2, 2, seed++), color: COLORS.blue, width: 2, weight: 0.3 })
        cmds.push({ type: 'text', text: l, x: bx+bw/2, y: my-8, font: 'bold 14px "Poppins", sans-serif', color: COLORS.blue, align: 'center', weight: 0.2 })
        if (li < labels.length-1) {
          cmds.push({ type: 'line', points: makeWobblyLinePoints(bx+bw+5, my, bx+bw+gap-5, my, 1.5, seed++), color: COLORS.subtle, width: 2, weight: 0.3 })
        }
      })
      break
    }
    case 'checklist': {
      for (let i = 0; i < Math.min(5, section.points.length); i++) {
        const cy = iy+10+i*40
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+15, cy, ix+35, cy, 2, seed++), color: COLORS.marker, width: 2, weight: 0.1 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+35, cy, ix+35, cy+20, 2, seed++), color: COLORS.marker, width: 2, weight: 0.1 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+35, cy+20, ix+15, cy+20, 2, seed++), color: COLORS.marker, width: 2, weight: 0.1 })
        cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+15, cy+20, ix+15, cy, 2, seed++), color: COLORS.marker, width: 2, weight: 0.1 })
        cmds.push({ type: 'check', x: ix+17, y: cy+3, size: 15, color: COLORS.green, seed: seed++, weight: 0.4 })
      }
      break
    }
    default: {
      // Default growth curve
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+30, iy+ih-20, ix+30, iy+10, 3, seed++), color: COLORS.marker, width: 2, weight: 0.8 })
      cmds.push({ type: 'line', points: makeWobblyLinePoints(ix+30, iy+ih-20, ix+iw-10, iy+ih-20, 3, seed++), color: COLORS.marker, width: 2, weight: 0.8 })
      const pts = []; for (let i = 0; i <= 30; i++) { const t = i/30; pts.push({ x: ix+40+t*(iw-60), y: iy+ih-30-Math.pow(t,2)*(ih-50) }) }
      cmds.push({ type: 'line', points: pts, color: COLORS.green, width: 3.5, weight: 3 })
    }
  }

  return cmds
}

function buildTakeawayCommands(topic, ctx) {
  const cmds = []
  let seed = topic.id * 31 + 800

  cmds.push({ type: 'fill_rect', x: 60, y: 330, w: WIDTH - 120, h: 450, color: COLORS.highlight, opacity: 0.5, weight: 0.8 })
  cmds.push({ type: 'fill_rect', x: 60, y: 330, w: 6, h: 450, color: COLORS.accent, weight: 0.2 })
  cmds.push({ type: 'star', cx: 110, cy: 380, r: 20, color: COLORS.accent, fill: true, weight: 0.8 })
  cmds.push({ type: 'text', text: 'KEY TAKEAWAY', x: 145, y: 365, font: 'bold 28px "Poppins", sans-serif', color: COLORS.accent, charByChar: true, weight: 1.2 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(145, 398, 370, 398, 2, seed++), color: COLORS.accent, width: 2.5, weight: 0.3 })
  cmds.push({ type: 'pause', weight: 0.3 })

  ctx.font = 'bold 30px "Poppins", sans-serif'
  const lines = wrapText(ctx, topic.takeaway, WIDTH - 200)
  lines.forEach((line, i) => {
    cmds.push({ type: 'text', text: line, x: 90, y: 425 + i * 48, font: 'bold 30px "Poppins", sans-serif', color: COLORS.marker, charByChar: true, weight: 2.5 })
  })

  return cmds
}

function buildBrandCommands(topic) {
  const cmds = []
  let seed = topic.id * 37 + 1100

  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH/2-100, HEIGHT/2-100, WIDTH/2+100, HEIGHT/2-100, 3, seed++), color: COLORS.accent, width: 2, weight: 0.4 })
  cmds.push({ type: 'text', text: 'THRIVE', x: WIDTH/2-160, y: HEIGHT/2-60, font: 'bold 48px "Poppins", sans-serif', color: COLORS.brand1, charByChar: true, weight: 1.5 })
  cmds.push({ type: 'text', text: 'RICHLY', x: WIDTH/2+20, y: HEIGHT/2-60, font: 'bold 48px "Poppins", sans-serif', color: COLORS.brand2, charByChar: true, weight: 1.5 })
  cmds.push({ type: 'text', text: 'Financial empowerment, sketched simply.', x: WIDTH/2, y: HEIGHT/2+10, font: '22px "Poppins", sans-serif', color: COLORS.subtle, align: 'center', charByChar: true, weight: 1.5 })

  // CTA box
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH/2-190, HEIGHT/2+50, WIDTH/2+190, HEIGHT/2+50, 3, seed++), color: COLORS.accent, width: 2, weight: 0.2 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH/2+190, HEIGHT/2+50, WIDTH/2+190, HEIGHT/2+95, 3, seed++), color: COLORS.accent, width: 2, weight: 0.2 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH/2+190, HEIGHT/2+95, WIDTH/2-190, HEIGHT/2+95, 3, seed++), color: COLORS.accent, width: 2, weight: 0.2 })
  cmds.push({ type: 'line', points: makeWobblyLinePoints(WIDTH/2-190, HEIGHT/2+95, WIDTH/2-190, HEIGHT/2+50, 3, seed++), color: COLORS.accent, width: 2, weight: 0.2 })
  cmds.push({ type: 'text', text: 'Follow + Share for more', x: WIDTH/2, y: HEIGHT/2+58, font: 'bold 26px "Poppins", sans-serif', color: COLORS.accent, align: 'center', charByChar: true, weight: 1.5 })

  return cmds
}

// ============================================================================
// FRAME GENERATION
// ============================================================================
function generateFrames(topic, framesDir) {
  console.log('  ✏️  Generating long-form doodle frames with animated pen...')

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')
  const bgSeed = topic.id * 7 + 99
  initRand(bgSeed)

  // Build all sections
  // Structure: hook → content sections (text + diagram alternating) → takeaway → brand
  const allSections = []

  // Hook
  allSections.push({ name: 'hook', duration: 15, commands: buildHookCommands(topic, ctx) })

  // Content sections: each section gets a TEXT screen then a DIAGRAM screen
  topic.sections.forEach((sec, si) => {
    allSections.push({ name: `section-${si}-text`, duration: 35 + sec.points.length * 3, commands: buildSectionCommands(sec, si, topic, ctx) })
    allSections.push({ name: `section-${si}-diagram`, duration: 12, commands: buildDiagramCommands(sec, si, topic, ctx) })
  })

  // Takeaway
  allSections.push({ name: 'takeaway', duration: 20, commands: buildTakeawayCommands(topic, ctx) })

  // Brand
  allSections.push({ name: 'brand', duration: 10, commands: buildBrandCommands(topic) })

  const TRANS = 0.5
  const totalDuration = allSections.reduce((s, sec) => s + sec.duration, 0) + TRANS * (allSections.length - 1)
  const totalFrames = Math.ceil(totalDuration * FPS)

  console.log(`  📐 ${allSections.length} screens, ${totalDuration.toFixed(1)}s (${(totalDuration/60).toFixed(1)} min), ${totalFrames} frames`)

  fs.mkdirSync(framesDir, { recursive: true })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS

    drawBackground(ctx, bgSeed)

    let elapsed = 0
    let penPos = null
    let showPen = true

    for (let si = 0; si < allSections.length; si++) {
      const sec = allSections[si]
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

        if (alpha < 0.5 || (sec.name === 'brand' && secT > 0.85)) showPen = false
        if (alpha > 0) break
      }
      elapsed += sec.duration + TRANS
    }

    // Draw hand
    if (penPos && showPen) {
      drawPen(ctx, penPos.x, penPos.y)
    }

    // Watermark
    ctx.globalAlpha = 0.2
    ctx.font = '16px "Poppins", sans-serif'
    ctx.fillStyle = COLORS.subtle; ctx.textAlign = 'center'
    ctx.fillText('THRIVE RICHLY', WIDTH / 2, HEIGHT - 35)
    ctx.globalAlpha = 1.0

    // Progress bar at bottom
    const progressPct = t / totalDuration
    ctx.fillStyle = COLORS.accent
    ctx.globalAlpha = 0.3
    ctx.fillRect(0, HEIGHT - 6, WIDTH * progressPct, 6)
    ctx.globalAlpha = 1.0

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 })
    fs.writeFileSync(path.join(framesDir, `frame_${String(frame).padStart(6, '0')}.jpg`), buffer)

    if (frame % (FPS * 10) === 0) {
      console.log(`  🎞️  ${frame}/${totalFrames} (${(t/60).toFixed(1)}m / ${(totalDuration/60).toFixed(1)}m)`)
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
    const fade = Math.max(0, duration - 3)
    try {
      execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%06d.jpg" -stream_loop -1 -i "${musicPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -af "afade=t=in:d=2,afade=t=out:st=${fade}:d=3,volume=0.25" -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 10 * 1024 * 1024 })
      console.log(`  ✅ Video (with music): ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB`)
      return
    } catch (e) { console.log('  ⚠️  Music failed, using silent...') }
  }

  const noAudio = outputPath.replace('.mp4', '_v.mp4')
  execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%06d.jpg" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${noAudio}" 2>&1`, { maxBuffer: 10 * 1024 * 1024 })
  try {
    execSync(`ffmpeg -y -i "${noAudio}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -shortest -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 10 * 1024 * 1024 })
  } catch (e) { fs.copyFileSync(noAudio, outputPath) }
  try { fs.unlinkSync(noAudio) } catch (e) {}

  console.log(`  ✅ Video: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB`)
}

// ============================================================================
// FACEBOOK VIDEO UPLOAD (non-Reels — regular video for long-form)
// ============================================================================
async function uploadVideo(videoPath, caption, scheduledTime = null) {
  const videoBuffer = fs.readFileSync(videoPath)
  const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1)

  // For long videos, use resumable upload
  console.log(`  📤 Uploading ${sizeMB}MB video...`)

  // Start upload
  const initRes = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'start',
      file_size: videoBuffer.length,
      access_token: FB_PAGE_ACCESS_TOKEN,
    }),
  })
  if (!initRes.ok) throw new Error(`Init: ${await initRes.text()}`)
  const { upload_session_id, video_id } = await initRes.json()
  console.log(`  📤 Session: ${upload_session_id}, Video ID: ${video_id}`)

  // Upload chunks (8MB each)
  const CHUNK_SIZE = 8 * 1024 * 1024
  let offset = 0
  while (offset < videoBuffer.length) {
    const chunk = videoBuffer.slice(offset, offset + CHUNK_SIZE)
    const form = new FormData()
    form.append('upload_phase', 'transfer')
    form.append('upload_session_id', upload_session_id)
    form.append('start_offset', offset.toString())
    form.append('access_token', FB_PAGE_ACCESS_TOKEN)
    form.append('video_file_chunk', new Blob([chunk]), 'chunk.mp4')

    const chunkRes = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/videos`, {
      method: 'POST',
      body: form,
    })
    if (!chunkRes.ok) throw new Error(`Chunk upload: ${await chunkRes.text()}`)
    const chunkData = await chunkRes.json()
    offset = parseInt(chunkData.start_offset || offset + chunk.length)
    console.log(`  📤 Uploaded ${Math.min(100, Math.floor(offset / videoBuffer.length * 100))}%`)
  }

  // Finish upload
  const finishBody = {
    upload_phase: 'finish',
    upload_session_id,
    title: caption.substring(0, 100),
    description: caption,
    access_token: FB_PAGE_ACCESS_TOKEN,
  }
  if (scheduledTime) {
    finishBody.published = false
    finishBody.scheduled_publish_time = Math.floor(scheduledTime.getTime() / 1000)
  }

  const finishRes = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finishBody),
  })
  if (!finishRes.ok) {
    // Retry without scheduling
    delete finishBody.published
    delete finishBody.scheduled_publish_time
    const retry = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finishBody),
    })
    if (!retry.ok) throw new Error(`Finish: ${await retry.text()}`)
    return await retry.json()
  }
  return await finishRes.json()
}

// ============================================================================
// CAPTION + SCHEDULING
// ============================================================================
function generateCaption(topic) {
  const sectionList = topic.sections.map((s, i) => `${i + 1}. ${s.heading}`).join('\n')
  const templates = [
    `📚 ${topic.title}\n\n${topic.hook}\n\nIn this video:\n${sectionList}\n\n💡 ${topic.takeaway}\n\n🔖 Save this and share with someone who needs it.`,
    `✏️ ${topic.title} — the complete guide, sketched in under 7 minutes.\n\n${topic.hook}\n\n${topic.takeaway}\n\nFollow Thrive Richly for weekly deep dives into financial freedom.`,
  ]
  return templates[topic.id % templates.length]
}

function getScheduleTime() {
  const t = new Date()
  t.setUTCHours(12 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0)
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
    console.log('✅ All long-form topics posted!')
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
  console.log('📚 Thrive Richly — Long-Form Financial Empowerment Video\n')
  console.log(`📱 Page ID: ${FB_PAGE_ID}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}\n`)

  const { data, topic, remaining } = getNextTopic()
  const schedTime = getScheduleTime()

  console.log(`📝 Topic: ${topic.title}`)
  console.log(`📂 Category: ${topic.category}`)
  console.log(`📊 Sections: ${topic.sections.length}`)
  console.log(`⏰ Scheduled: ${schedTime.toISOString()}\n`)

  fs.mkdirSync(TEMP_DIR, { recursive: true })
  const framesDir = path.join(FRAMES_DIR, `long-${topic.id}`)

  try {
    const { totalDuration } = generateFrames(topic, framesDir)
    const videoPath = path.join(TEMP_DIR, `long-${topic.id}.mp4`)
    assembleVideo(framesDir, videoPath, totalDuration)

    const caption = generateCaption(topic)
    console.log('\n  📤 Uploading to Facebook...')
    const result = await uploadVideo(videoPath, caption, schedTime)
    console.log(`  ✅ Published! ID: ${result.id || result.video_id || 'success'}`)

    markComplete(data, topic.id)
    console.log(`\n✅ "${topic.title}" posted`)
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`)
    process.exit(1)
  }

  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }) } catch (e) {}

  console.log('\n' + '='.repeat(50))
  console.log(`🎉 Long-form video published: "${topic.title}"`)
  console.log(`📊 Remaining: ${remaining}`)
  console.log(`📅 Days of content: ${remaining * 3.5} (2x per week)`)
  console.log('='.repeat(50))
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1) })
