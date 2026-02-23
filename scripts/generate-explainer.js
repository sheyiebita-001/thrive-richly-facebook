#!/usr/bin/env node

/**
 * Thrive Richly — Financial Concept Explainer Video Generator
 * 
 * Generates 60-90 second whiteboard-style explainer videos for financial
 * concepts and posts them as Facebook Reels.
 * 
 * Visual style: Clean whiteboard with hand-drawn diagrams
 * Sections: Title → Definition → Diagram → Example → Key Takeaway → Brand
 * 
 * Required env vars:
 *   FB_PAGE_ACCESS_TOKEN  — Page Access Token
 *   FB_PAGE_ID            — Facebook Page ID
 * 
 * Usage: FB_PAGE_ACCESS_TOKEN=... FB_PAGE_ID=... node scripts/generate-explainer.js
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
const CONCEPTS_FILE = path.join(__dirname, 'financial-concepts.json')
const TEMP_DIR = path.join(__dirname, '..', 'temp-explainer')
const FRAMES_DIR = path.join(TEMP_DIR, 'frames')
const MUSIC_DIR = path.join(__dirname, 'music')
const EXPLAINERS_PER_DAY = 1

// Video settings
const WIDTH = 1080
const HEIGHT = 1920
const FPS = 24

// Color palette — clean whiteboard aesthetic
const COLORS = {
  bg: '#F5F0E8',           // Warm cream/paper
  bgLine: '#E8E2D6',       // Subtle ruled lines
  title: '#1A1A2E',        // Deep navy
  body: '#2D2D3D',         // Dark charcoal
  accent: '#C49A2A',       // Thrive Richly gold
  accent2: '#2E8BE0',      // Diagram blue
  accent3: '#1EAA55',      // Success green
  accent4: '#CC3333',      // Warning red
  subtle: '#8A8A9A',       // Light gray
  highlight: '#FFF3D0',    // Yellow highlight
  diagramBg: '#FFFFFF',    // White for diagram area
  brand1: '#C49A2A',       // Gold
  brand2: '#E8C547',       // Light gold
}

if (!FB_PAGE_ACCESS_TOKEN) {
  console.error('❌ FB_PAGE_ACCESS_TOKEN environment variable is required')
  process.exit(1)
}

// ============================================================================
// UTILITY — Seeded random
// ============================================================================
function seededRandom(seed) {
  let s = seed
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ============================================================================
// TEXT HELPERS
// ============================================================================
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function drawTextWithHighlight(ctx, text, x, y, maxWidth, fontSize, color, lineHeight, alpha) {
  ctx.globalAlpha = alpha
  ctx.font = `${fontSize}px "Poppins", sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const lines = wrapText(ctx, text, maxWidth)
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight)
  }
  ctx.globalAlpha = 1.0
  return lines.length
}

// ============================================================================
// WHITEBOARD BACKGROUND
// ============================================================================
function drawWhiteboardBg(ctx) {
  // Warm paper background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Subtle ruled lines
  ctx.strokeStyle = COLORS.bgLine
  ctx.lineWidth = 0.5
  for (let y = 100; y < HEIGHT; y += 50) {
    ctx.beginPath()
    ctx.moveTo(60, y)
    ctx.lineTo(WIDTH - 60, y)
    ctx.stroke()
  }

  // Left margin line
  ctx.strokeStyle = '#D4C4A8'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(75, 50)
  ctx.lineTo(75, HEIGHT - 50)
  ctx.stroke()

  // Subtle paper texture dots
  const rand = seededRandom(42)
  ctx.fillStyle = 'rgba(0,0,0,0.02)'
  for (let i = 0; i < 300; i++) {
    ctx.beginPath()
    ctx.arc(rand() * WIDTH, rand() * HEIGHT, rand() * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ============================================================================
// DIAGRAM RENDERERS — Different visual styles per concept type
// ============================================================================

function drawGrowthCurve(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const padding = 30

  // Axes
  ctx.strokeStyle = COLORS.body
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + padding, y + h - padding)
  ctx.lineTo(x + padding, y + padding)
  ctx.moveTo(x + padding, y + h - padding)
  ctx.lineTo(x + w - padding, y + h - padding)
  ctx.stroke()

  // Labels
  ctx.font = '18px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.subtle
  ctx.textAlign = 'center'
  ctx.fillText('TIME →', x + w / 2, y + h - 5)
  ctx.save()
  ctx.translate(x + 12, y + h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('VALUE →', 0, 0)
  ctx.restore()

  // Exponential curve
  ctx.strokeStyle = COLORS.accent3
  ctx.lineWidth = 3
  ctx.beginPath()
  const points = Math.floor(progress * 50)
  for (let i = 0; i <= points; i++) {
    const t = i / 50
    const px = x + padding + t * (w - 2 * padding)
    const py = y + h - padding - Math.pow(t, 2.5) * (h - 2 * padding) * 0.9
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()

  // Dotted linear line for comparison
  if (progress > 0.3) {
    ctx.strokeStyle = COLORS.accent4
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    const linProg = Math.min(1, (progress - 0.3) / 0.7)
    const linPoints = Math.floor(linProg * 50)
    for (let i = 0; i <= linPoints; i++) {
      const t = i / 50
      const px = x + padding + t * (w - 2 * padding)
      const py = y + h - padding - t * (h - 2 * padding) * 0.35
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Legend
    if (progress > 0.6) {
      const la = Math.min(1, (progress - 0.6) / 0.2)
      ctx.globalAlpha = alpha * la
      ctx.font = '16px "Poppins", sans-serif'
      ctx.fillStyle = COLORS.accent3
      ctx.fillText('● Compound', x + w - 150, y + 30)
      ctx.fillStyle = COLORS.accent4
      ctx.fillText('● Linear', x + w - 150, y + 52)
    }
  }

  ctx.globalAlpha = 1.0
}

function drawTwoColumns(ctx, x, y, w, h, alpha, progress, labels) {
  ctx.globalAlpha = alpha
  const colW = (w - 40) / 2
  const leftLabel = (labels && labels[0]) || 'GOOD'
  const rightLabel = (labels && labels[1]) || 'BAD'
  const leftColor = COLORS.accent3
  const rightColor = COLORS.accent4

  // Left column header
  if (progress > 0.1) {
    const a = Math.min(1, (progress - 0.1) / 0.15)
    ctx.globalAlpha = alpha * a
    ctx.fillStyle = leftColor
    ctx.font = 'bold 22px "Poppins", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(leftLabel, x + colW / 2, y + 15)

    // Left box
    ctx.strokeStyle = leftColor
    ctx.lineWidth = 2
    ctx.strokeRect(x, y + 30, colW, h - 40)
  }

  // Right column header
  if (progress > 0.3) {
    const a = Math.min(1, (progress - 0.3) / 0.15)
    ctx.globalAlpha = alpha * a
    ctx.fillStyle = rightColor
    ctx.font = 'bold 22px "Poppins", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(rightLabel, x + colW + 40 + colW / 2, y + 15)

    ctx.strokeStyle = rightColor
    ctx.lineWidth = 2
    ctx.strokeRect(x + colW + 40, y + 30, colW, h - 40)
  }

  // Divider
  if (progress > 0.2) {
    ctx.strokeStyle = COLORS.bgLine
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.beginPath()
    ctx.moveTo(x + colW + 20, y + 10)
    ctx.lineTo(x + colW + 20, y + h - 10)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Check marks / X marks
  if (progress > 0.5) {
    const items = Math.min(3, Math.floor((progress - 0.5) / 0.15) + 1)
    ctx.font = '28px "Poppins", sans-serif'
    for (let i = 0; i < items; i++) {
      ctx.globalAlpha = alpha * Math.min(1, (progress - 0.5 - i * 0.15) / 0.1)
      ctx.fillStyle = leftColor
      ctx.textAlign = 'center'
      ctx.fillText('✓', x + colW / 2, y + 70 + i * 50)
      ctx.fillStyle = rightColor
      ctx.fillText('✗', x + colW + 40 + colW / 2, y + 70 + i * 50)
    }
  }

  ctx.globalAlpha = 1.0
}

function drawPieChart(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const cx = x + w / 2
  const cy = y + h / 2 - 20
  const r = Math.min(w, h) / 2 - 50

  const slices = [
    { pct: 0.50, color: COLORS.accent2, label: '50%' },
    { pct: 0.30, color: COLORS.accent, label: '30%' },
    { pct: 0.20, color: COLORS.accent3, label: '20%' },
  ]

  let startAngle = -Math.PI / 2
  const totalDraw = progress * Math.PI * 2

  for (const slice of slices) {
    const sliceAngle = slice.pct * Math.PI * 2
    const drawAngle = Math.min(sliceAngle, Math.max(0, totalDraw - (startAngle + Math.PI / 2)))

    if (drawAngle > 0) {
      ctx.fillStyle = slice.color
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, startAngle, startAngle + drawAngle)
      ctx.closePath()
      ctx.fill()

      // Label
      if (drawAngle >= sliceAngle * 0.5) {
        const midAngle = startAngle + sliceAngle / 2
        const lx = cx + (r * 0.6) * Math.cos(midAngle)
        const ly = cy + (r * 0.6) * Math.sin(midAngle)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 24px "Poppins", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(slice.label, lx, ly)
      }
    }

    startAngle += sliceAngle
  }

  // Legend below
  if (progress > 0.8) {
    const la = Math.min(1, (progress - 0.8) / 0.15)
    ctx.globalAlpha = alpha * la
    ctx.font = '18px "Poppins", sans-serif'
    ctx.textAlign = 'left'
    const legendY = cy + r + 30
    const labels = ['Needs', 'Wants', 'Savings']
    slices.forEach((s, i) => {
      ctx.fillStyle = s.color
      ctx.fillRect(x + 80 + i * 140, legendY, 16, 16)
      ctx.fillStyle = COLORS.body
      ctx.fillText(labels[i], x + 102 + i * 140, legendY + 13)
    })
  }

  ctx.globalAlpha = 1.0
}

function drawComparisonBars(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const barH = 45
  const gap = 25
  const maxBarW = w - 160

  const bars = [
    { label: 'Option A', pct: 0.85, color: COLORS.accent3 },
    { label: 'Option B', pct: 0.45, color: COLORS.accent4 },
  ]

  bars.forEach((bar, i) => {
    const by = y + 30 + i * (barH + gap)
    const barProg = Math.min(1, Math.max(0, (progress - i * 0.2) / 0.5))
    const barW = maxBarW * bar.pct * barProg

    // Label
    if (barProg > 0) {
      ctx.globalAlpha = alpha * Math.min(1, barProg / 0.3)
      ctx.font = '20px "Poppins", sans-serif'
      ctx.fillStyle = COLORS.body
      ctx.textAlign = 'left'
      ctx.fillText(bar.label, x, by + barH / 2 + 6)

      // Bar background
      ctx.fillStyle = COLORS.bgLine
      ctx.fillRect(x + 100, by, maxBarW, barH)

      // Bar fill
      ctx.fillStyle = bar.color
      ctx.fillRect(x + 100, by, barW, barH)

      // Percentage
      if (barProg > 0.5) {
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 20px "Poppins", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${Math.round(bar.pct * 100)}%`, x + 100 + barW / 2, by + barH / 2 + 7)
      }
    }
  })

  ctx.globalAlpha = 1.0
}

function drawBalanceScale(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const cx = x + w / 2
  const baseY = y + h - 40

  // Base triangle
  if (progress > 0.1) {
    ctx.fillStyle = COLORS.body
    ctx.beginPath()
    ctx.moveTo(cx - 20, baseY)
    ctx.lineTo(cx + 20, baseY)
    ctx.lineTo(cx, baseY - 30)
    ctx.closePath()
    ctx.fill()

    // Pole
    ctx.strokeStyle = COLORS.body
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx, baseY - 30)
    ctx.lineTo(cx, y + 60)
    ctx.stroke()
  }

  // Beam (tilts based on progress)
  if (progress > 0.3) {
    const tilt = Math.sin(progress * Math.PI) * 8
    const beamY = y + 60
    ctx.strokeStyle = COLORS.body
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx - 150, beamY + tilt)
    ctx.lineTo(cx + 150, beamY - tilt)
    ctx.stroke()

    // Left pan
    ctx.fillStyle = COLORS.accent3
    ctx.fillRect(cx - 170, beamY + tilt + 5, 60, 40)
    ctx.font = 'bold 16px "Poppins", sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.fillText('OWN', cx - 140, beamY + tilt + 31)

    // Right pan
    ctx.fillStyle = COLORS.accent4
    ctx.fillRect(cx + 110, beamY - tilt + 5, 60, 40)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('OWE', cx + 140, beamY - tilt + 31)
  }

  ctx.globalAlpha = 1.0
}

function drawShield(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const cx = x + w / 2
  const cy = y + h / 2 - 10
  const size = Math.min(w, h) * 0.3

  if (progress > 0.2) {
    const drawProg = Math.min(1, (progress - 0.2) / 0.4)

    // Shield shape
    ctx.fillStyle = COLORS.accent2
    ctx.beginPath()
    ctx.moveTo(cx, cy - size)
    ctx.lineTo(cx + size * 0.8, cy - size * 0.5)
    ctx.lineTo(cx + size * 0.8, cy + size * 0.2)
    ctx.lineTo(cx, cy + size * drawProg)
    ctx.lineTo(cx - size * 0.8, cy + size * 0.2)
    ctx.lineTo(cx - size * 0.8, cy - size * 0.5)
    ctx.closePath()
    ctx.fill()

    // Checkmark
    if (progress > 0.6) {
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - size * 0.25, cy)
      ctx.lineTo(cx - size * 0.05, cy + size * 0.2)
      ctx.lineTo(cx + size * 0.3, cy - size * 0.2)
      ctx.stroke()
    }

    // Label
    if (progress > 0.7) {
      ctx.font = 'bold 22px "Poppins", sans-serif'
      ctx.fillStyle = COLORS.body
      ctx.textAlign = 'center'
      ctx.fillText('PROTECTED', cx, cy + size + 40)
    }
  }

  ctx.globalAlpha = 1.0
}

function drawFlowArrows(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const boxW = 120
  const boxH = 50

  const boxes = [
    { label: 'EARN', color: COLORS.accent2 },
    { label: 'SAVE', color: COLORS.accent },
    { label: 'INVEST', color: COLORS.accent3 },
    { label: 'GROW', color: COLORS.accent3 },
  ]

  const totalW = boxes.length * boxW + (boxes.length - 1) * 40
  const startX = x + (w - totalW) / 2
  const midY = y + h / 2

  boxes.forEach((box, i) => {
    const bx = startX + i * (boxW + 40)
    const prog = Math.min(1, Math.max(0, (progress - i * 0.15) / 0.25))

    if (prog > 0) {
      ctx.globalAlpha = alpha * prog

      // Box
      ctx.fillStyle = box.color
      const rh = boxH * prog
      ctx.fillRect(bx, midY - rh / 2, boxW, rh)

      // Label
      if (prog > 0.5) {
        ctx.font = 'bold 18px "Poppins", sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.fillText(box.label, bx + boxW / 2, midY + 7)
      }

      // Arrow
      if (i < boxes.length - 1 && prog > 0.8) {
        ctx.fillStyle = COLORS.subtle
        const ax = bx + boxW + 5
        ctx.beginPath()
        ctx.moveTo(ax, midY - 8)
        ctx.lineTo(ax + 25, midY)
        ctx.lineTo(ax, midY + 8)
        ctx.closePath()
        ctx.fill()
      }
    }
  })

  ctx.globalAlpha = 1.0
}

function drawGaugeMeter(ctx, x, y, w, h, alpha, progress) {
  ctx.globalAlpha = alpha
  const cx = x + w / 2
  const cy = y + h / 2 + 20
  const r = Math.min(w, h) * 0.3

  // Arc background
  ctx.strokeStyle = COLORS.bgLine
  ctx.lineWidth = 20
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, 0)
  ctx.stroke()

  // Colored sections
  if (progress > 0.2) {
    const sections = [
      { start: Math.PI, end: Math.PI * 1.33, color: COLORS.accent4 },
      { start: Math.PI * 1.33, end: Math.PI * 1.67, color: COLORS.accent },
      { start: Math.PI * 1.67, end: Math.PI * 2, color: COLORS.accent3 },
    ]

    sections.forEach(s => {
      const drawEnd = Math.min(s.end, s.start + (s.end - s.start) * Math.min(1, progress * 2))
      ctx.strokeStyle = s.color
      ctx.lineWidth = 20
      ctx.beginPath()
      ctx.arc(cx, cy, r, s.start, drawEnd)
      ctx.stroke()
    })
  }

  // Needle
  if (progress > 0.5) {
    const needleAngle = Math.PI + progress * Math.PI * 0.7
    ctx.strokeStyle = COLORS.body
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + r * 0.8 * Math.cos(needleAngle), cy + r * 0.8 * Math.sin(needleAngle))
    ctx.stroke()

    // Center dot
    ctx.fillStyle = COLORS.body
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  // Labels
  if (progress > 0.7) {
    ctx.font = '16px "Poppins", sans-serif'
    ctx.fillStyle = COLORS.accent4
    ctx.textAlign = 'center'
    ctx.fillText('LOW', cx - r - 10, cy + 30)
    ctx.fillStyle = COLORS.accent3
    ctx.fillText('HIGH', cx + r + 10, cy + 30)
  }

  ctx.globalAlpha = 1.0
}

// Diagram dispatcher
function drawDiagram(ctx, type, x, y, w, h, alpha, progress, labels) {
  switch (type) {
    case 'growth_curve':
    case 'declining_curve':
      drawGrowthCurve(ctx, x, y, w, h, alpha, progress)
      break
    case 'two_columns':
      drawTwoColumns(ctx, x, y, w, h, alpha, progress, labels)
      break
    case 'pie_chart':
      drawPieChart(ctx, x, y, w, h, alpha, progress)
      break
    case 'comparison_bars':
    case 'bar_chart':
    case 'percentage_bar':
    case 'shifting_bars':
    case 'shrinking_bar':
    case 'parallel_lines':
    case 'speed_ranking':
      drawComparisonBars(ctx, x, y, w, h, alpha, progress)
      break
    case 'balance_scale':
    case 'lever_fulcrum':
      drawBalanceScale(ctx, x, y, w, h, alpha, progress)
      break
    case 'shield':
    case 'gate_lock':
    case 'reset_button':
      drawShield(ctx, x, y, w, h, alpha, progress)
      break
    case 'flow_arrows':
    case 'funnel':
    case 'milestone_path':
    case 'timeline':
    case 'stacking_blocks':
    case 'splitting_blocks':
      drawFlowArrows(ctx, x, y, w, h, alpha, progress)
      break
    case 'gauge_meter':
      drawGaugeMeter(ctx, x, y, w, h, alpha, progress)
      break
    case 'up_down_arrows':
    case 'crossing_lines':
    case 'zigzag_line':
    case 'crash_line':
    case 'dip_recovery':
    case 'stagnant_pool':
    case 'widening_gap':
    case 'fork_path':
    case 'pyramid':
    case 'grid_boxes':
    case 'size_comparison':
      drawGrowthCurve(ctx, x, y, w, h, alpha, progress)
      break
    default:
      drawComparisonBars(ctx, x, y, w, h, alpha, progress)
  }
}

// ============================================================================
// SECTION RENDERERS — Each section of the explainer
// ============================================================================

function renderTitleCard(ctx, concept, alpha) {
  // Category label
  ctx.globalAlpha = alpha * 0.7
  ctx.font = 'bold 20px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'center'
  ctx.fillText(concept.category.toUpperCase(), WIDTH / 2, 280)

  // Gold underline
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  const catW = ctx.measureText(concept.category.toUpperCase()).width
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - catW / 2 - 10, 290)
  ctx.lineTo(WIDTH / 2 + catW / 2 + 10, 290)
  ctx.stroke()

  // Term title
  ctx.globalAlpha = alpha
  ctx.font = 'bold 56px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.title
  ctx.textAlign = 'center'

  // Wrap title if needed
  const titleLines = wrapText(ctx, concept.term, WIDTH - 160)
  titleLines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, 340 + i * 70)
  })

  // Decorative marker circle (like hand-drawn)
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(WIDTH / 2, 500 + (titleLines.length - 1) * 70, 40, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '36px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent
  ctx.fillText('💡', WIDTH / 2 - 2, 515 + (titleLines.length - 1) * 70)

  ctx.globalAlpha = 1.0
}

function renderDefinition(ctx, text, alpha, revealProgress) {
  // Section header
  ctx.globalAlpha = alpha
  ctx.font = 'bold 26px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.fillText('WHAT IS IT?', 100, 250)

  // Underline
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(100, 280)
  ctx.lineTo(270, 280)
  ctx.stroke()

  // Definition text — reveal word by word
  ctx.font = '32px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.body
  const allWords = text.split(' ')
  const wordsToShow = Math.floor(revealProgress * allWords.length)
  const visibleText = allWords.slice(0, wordsToShow).join(' ')

  if (visibleText) {
    const lines = wrapText(ctx, visibleText, WIDTH - 200)
    lines.forEach((line, i) => {
      ctx.fillText(line, 100, 320 + i * 50)
    })
  }

  ctx.globalAlpha = 1.0
}

function renderDiagramSection(ctx, concept, alpha, progress) {
  // Section header
  ctx.globalAlpha = alpha
  ctx.font = 'bold 26px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent2
  ctx.textAlign = 'left'
  ctx.fillText('HOW IT WORKS', 100, 250)

  ctx.strokeStyle = COLORS.accent2
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(100, 280)
  ctx.lineTo(310, 280)
  ctx.stroke()

  // Diagram area — white rounded rect
  ctx.fillStyle = COLORS.diagramBg
  ctx.beginPath()
  const dx = 80, dy = 310, dw = WIDTH - 160, dh = 500
  ctx.moveTo(dx + 15, dy)
  ctx.arcTo(dx + dw, dy, dx + dw, dy + dh, 15)
  ctx.arcTo(dx + dw, dy + dh, dx, dy + dh, 15)
  ctx.arcTo(dx, dy + dh, dx, dy, 15)
  ctx.arcTo(dx, dy, dx + dw, dy, 15)
  ctx.fill()

  // Border
  ctx.strokeStyle = COLORS.bgLine
  ctx.lineWidth = 1
  ctx.stroke()

  // Draw the actual diagram
  drawDiagram(ctx, concept.diagram, dx + 20, dy + 20, dw - 40, dh - 40, alpha, progress)

  ctx.globalAlpha = 1.0
}

function renderExample(ctx, text, alpha, revealProgress) {
  // Section header
  ctx.globalAlpha = alpha
  ctx.font = 'bold 26px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent3
  ctx.textAlign = 'left'
  ctx.fillText('REAL EXAMPLE', 100, 250)

  ctx.strokeStyle = COLORS.accent3
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(100, 280)
  ctx.lineTo(300, 280)
  ctx.stroke()

  // Example text
  ctx.font = '30px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.body
  const allWords = text.split(' ')
  const wordsToShow = Math.floor(revealProgress * allWords.length)
  const visibleText = allWords.slice(0, wordsToShow).join(' ')

  if (visibleText) {
    const lines = wrapText(ctx, visibleText, WIDTH - 200)
    lines.forEach((line, i) => {
      ctx.fillText(line, 100, 320 + i * 48)
    })
  }

  ctx.globalAlpha = 1.0
}

function renderKeyTakeaway(ctx, text, alpha, revealProgress) {
  // Gold highlight box
  ctx.globalAlpha = alpha * 0.3
  ctx.fillStyle = COLORS.highlight
  ctx.fillRect(60, 280, WIDTH - 120, 350)

  ctx.globalAlpha = alpha
  // Left accent bar
  ctx.fillStyle = COLORS.accent
  ctx.fillRect(60, 280, 6, 350)

  // Header
  ctx.font = 'bold 28px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent
  ctx.textAlign = 'left'
  ctx.fillText('🎯 KEY TAKEAWAY', 100, 320)

  // Takeaway text
  ctx.font = 'bold 34px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.title
  const allWords = text.split(' ')
  const wordsToShow = Math.floor(revealProgress * allWords.length)
  const visibleText = allWords.slice(0, wordsToShow).join(' ')

  if (visibleText) {
    const lines = wrapText(ctx, visibleText, WIDTH - 220)
    lines.forEach((line, i) => {
      ctx.fillText(line, 100, 380 + i * 52)
    })
  }

  ctx.globalAlpha = 1.0
}

function renderBrandCard(ctx, alpha) {
  ctx.globalAlpha = alpha

  // Logo area
  ctx.font = 'bold 42px "Poppins", sans-serif'
  ctx.textAlign = 'center'

  const t1 = 'THRIVE '
  const t2 = 'RICHLY'
  const t1w = ctx.measureText(t1).width
  const t2w = ctx.measureText(t2).width
  const totalW = t1w + t2w
  const bx = (WIDTH - totalW) / 2

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.brand1
  ctx.fillText(t1, bx, HEIGHT / 2 - 40)
  ctx.fillStyle = COLORS.brand2
  ctx.fillText(t2, bx + t1w, HEIGHT / 2 - 40)

  // Tagline
  ctx.font = '22px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.subtle
  ctx.textAlign = 'center'
  ctx.fillText('Financial concepts explained simply', WIDTH / 2, HEIGHT / 2 + 20)

  // Follow CTA
  ctx.font = 'bold 24px "Poppins", sans-serif'
  ctx.fillStyle = COLORS.accent
  ctx.fillText('Follow for daily financial wisdom', WIDTH / 2, HEIGHT / 2 + 80)

  ctx.globalAlpha = 1.0
}

// ============================================================================
// FRAME GENERATION — Full video with all sections
// ============================================================================
function generateFrames(concept, framesDir) {
  console.log('  🎨 Generating whiteboard frames...')

  // Timeline (in seconds)
  const SECTIONS = [
    { name: 'title', duration: 4 },
    { name: 'definition', duration: 18 },
    { name: 'diagram', duration: 16 },
    { name: 'example', duration: 18 },
    { name: 'takeaway', duration: 12 },
    { name: 'brand', duration: 4 },
  ]

  // Transition time between sections
  const TRANSITION = 0.8

  const totalDuration = SECTIONS.reduce((sum, s) => sum + s.duration, 0) + TRANSITION * (SECTIONS.length - 1)
  const totalFrames = Math.ceil(totalDuration * FPS)

  console.log(`  📐 ${SECTIONS.length} sections, ${totalDuration.toFixed(1)}s, ${totalFrames} frames`)

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  fs.mkdirSync(framesDir, { recursive: true })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS

    // Draw whiteboard background
    drawWhiteboardBg(ctx)

    // Determine which section we're in
    let elapsed = 0
    for (let si = 0; si < SECTIONS.length; si++) {
      const section = SECTIONS[si]
      const sectionStart = elapsed
      const sectionEnd = elapsed + section.duration
      const nextTransStart = sectionEnd - TRANSITION / 2

      if (t >= sectionStart && t < sectionEnd + TRANSITION / 2) {
        // Calculate alpha (fade in/out)
        let alpha = 1.0
        if (t < sectionStart + TRANSITION / 2) {
          alpha = Math.min(1, (t - sectionStart) / (TRANSITION / 2))
        }
        if (t > nextTransStart) {
          alpha = Math.max(0, 1 - (t - nextTransStart) / (TRANSITION / 2))
        }

        // Progress within section (0 to 1)
        const sectionT = (t - sectionStart) / section.duration

        // Render section
        switch (section.name) {
          case 'title':
            renderTitleCard(ctx, concept, alpha)
            break
          case 'definition':
            renderDefinition(ctx, concept.definition, alpha, Math.min(1, sectionT * 1.3))
            break
          case 'diagram':
            renderDiagramSection(ctx, concept, alpha, Math.min(1, sectionT * 1.2))
            break
          case 'example':
            renderExample(ctx, concept.example, alpha, Math.min(1, sectionT * 1.3))
            break
          case 'takeaway':
            renderKeyTakeaway(ctx, concept.keyTakeaway, alpha, Math.min(1, sectionT * 1.5))
            break
          case 'brand':
            renderBrandCard(ctx, alpha)
            break
        }

        // Only render the active section (no overlap)
        if (alpha > 0) break
      }

      elapsed += section.duration + TRANSITION
    }

    // Always draw THRIVE RICHLY watermark at bottom
    ctx.globalAlpha = 0.4
    ctx.font = 'bold 16px "Poppins", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.subtle
    ctx.fillText('THRIVE RICHLY', WIDTH / 2, HEIGHT - 40)
    ctx.globalAlpha = 1.0

    // Save frame
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.90 })
    const frameNum = String(frame).padStart(5, '0')
    fs.writeFileSync(path.join(framesDir, `frame_${frameNum}.jpg`), buffer)

    if (frame % (FPS * 4) === 0) {
      console.log(`  🎞️  Rendered ${frame}/${totalFrames} frames (${t.toFixed(1)}s / ${totalDuration.toFixed(1)}s)`)
    }
  }

  console.log(`  ✅ All ${totalFrames} frames rendered`)
  return { totalDuration, totalFrames }
}

// ============================================================================
// VIDEO ASSEMBLY — Same approach as Reels generator
// ============================================================================
function assembleVideo(framesDir, outputPath, duration) {
  console.log('  🎬 Assembling video...')

  // Check for custom music
  let musicPath = null
  if (fs.existsSync(MUSIC_DIR)) {
    const musicFiles = fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.aac') || f.endsWith('.m4a') || f.endsWith('.wav'))
    if (musicFiles.length > 0) {
      musicPath = path.join(MUSIC_DIR, musicFiles[Math.floor(Math.random() * musicFiles.length)])
      console.log(`  🎵 Using music: ${path.basename(musicPath)}`)
    }
  }

  if (musicPath) {
    const fadeOutStart = Math.max(0, duration - 2)
    try {
      execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" -i "${musicPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -af "afade=t=in:d=1.5,afade=t=out:st=${fadeOutStart}:d=2,volume=0.3" -pix_fmt yuv420p -t ${duration} -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
      const stats = fs.statSync(outputPath)
      console.log(`  ✅ Video ready (with music): ${(stats.size / 1024 / 1024).toFixed(1)}MB`)
      return
    } catch (err) {
      console.log('  ⚠️  Music mux failed, falling back to silent...')
    }
  }

  // Step 1: Video from frames
  const videoOnly = outputPath.replace('.mp4', '_noaudio.mp4')
  console.log('  🎬 Step 1: Encoding video...')
  execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${videoOnly}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })

  // Step 2: Add silent audio
  console.log('  🎬 Step 2: Adding silent audio track...')
  try {
    execSync(`ffmpeg -y -i "${videoOnly}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -shortest -movflags +faststart "${outputPath}" 2>&1`, { maxBuffer: 5 * 1024 * 1024 })
  } catch (e) {
    fs.copyFileSync(videoOnly, outputPath)
  }

  try { fs.unlinkSync(videoOnly) } catch (e) {}

  const stats = fs.statSync(outputPath)
  console.log(`  ✅ Video ready: ${(stats.size / 1024 / 1024).toFixed(1)}MB`)
}

// ============================================================================
// FACEBOOK REELS UPLOAD
// ============================================================================
async function uploadReel(videoPath, caption, scheduledTime = null) {
  const videoBuffer = fs.readFileSync(videoPath)
  const fileSize = videoBuffer.length

  // Step 1: Initialize
  console.log('  📤 Initializing upload...')
  const initResponse = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'start',
      access_token: FB_PAGE_ACCESS_TOKEN,
    }),
  })

  if (!initResponse.ok) {
    throw new Error(`Init failed ${initResponse.status}: ${await initResponse.text()}`)
  }

  const initData = await initResponse.json()
  const videoId = initData.video_id
  const uploadUrl = initData.upload_url

  console.log(`  📤 Video ID: ${videoId}, uploading ${(fileSize / 1024 / 1024).toFixed(1)}MB...`)

  // Step 2: Upload binary
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${FB_PAGE_ACCESS_TOKEN}`,
      'offset': '0',
      'file_size': fileSize.toString(),
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed ${uploadResponse.status}: ${await uploadResponse.text()}`)
  }

  // Step 3: Publish
  console.log('  📤 Publishing...')
  const finishBody = {
    upload_phase: 'finish',
    video_id: videoId,
    title: caption.substring(0, 100),
    description: caption,
    access_token: FB_PAGE_ACCESS_TOKEN,
  }

  if (scheduledTime) {
    finishBody.video_state = 'SCHEDULED'
    finishBody.scheduled_publish_time = Math.floor(scheduledTime.getTime() / 1000)
  }

  const finishResponse = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finishBody),
  })

  if (!finishResponse.ok) {
    // Try without scheduling
    if (scheduledTime) {
      console.log('  ⚠️  Scheduling failed, posting immediately...')
      delete finishBody.video_state
      delete finishBody.scheduled_publish_time
      const retryResponse = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finishBody),
      })
      if (!retryResponse.ok) {
        throw new Error(`Publish failed: ${await retryResponse.text()}`)
      }
      return await retryResponse.json()
    }
    throw new Error(`Finish failed: ${await finishResponse.text()}`)
  }

  return await finishResponse.json()
}

// ============================================================================
// CAPTION GENERATION
// ============================================================================
function generateCaption(concept) {
  const captions = [
    `💡 ${concept.term} — explained in 60 seconds.\n\n${concept.keyTakeaway}\n\n🔖 Save this for later. Share with someone who needs to hear it.`,
    `Do you know what "${concept.term}" really means?\n\nMost people don't — and it's costing them money. 💸\n\n${concept.keyTakeaway}\n\n📌 Save & share.`,
    `🧠 Financial jargon, decoded: ${concept.term}\n\n${concept.keyTakeaway}\n\nFollow Thrive Richly for daily financial wisdom. 📈`,
    `"${concept.term}" sounds complicated.\n\nIt's not. Here's everything you need to know in 60 seconds. ⏱️\n\n${concept.keyTakeaway}`,
  ]

  const hash = concept.term.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return captions[hash % captions.length]
}

// ============================================================================
// CONCEPT MANAGEMENT
// ============================================================================
function getNextConcept() {
  const data = JSON.parse(fs.readFileSync(CONCEPTS_FILE, 'utf-8'))
  const pending = data.concepts.filter(c => c.status === 'pending')

  if (pending.length === 0) {
    console.log('✅ All concepts have been published! Add more to financial-concepts.json.')
    process.exit(0)
  }

  const next = pending[0]
  console.log(`📋 Next concept: "${next.term}" (${pending.length - 1} remaining)\n`)
  return { data, concept: next }
}

function markConceptComplete(data, conceptId) {
  const concept = data.concepts.find(c => c.id === conceptId)
  if (concept) {
    concept.status = 'posted'
    concept.postedAt = new Date().toISOString().split('T')[0]
  }
  fs.writeFileSync(CONCEPTS_FILE, JSON.stringify(data, null, 2))
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('📚 Thrive Richly — Financial Concept Explainer Generator\n')
  console.log(`📱 Page ID: ${FB_PAGE_ID}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`)
  console.log(`📖 Explainers per day: ${EXPLAINERS_PER_DAY}\n`)

  // Get next concept
  const { data, concept } = getNextConcept()

  // Schedule for peak afternoon time
  const scheduledTime = new Date()
  scheduledTime.setUTCHours(12 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0)
  if (scheduledTime <= new Date()) {
    scheduledTime.setDate(scheduledTime.getDate() + 1)
  }
  const minTime = new Date(Date.now() + 15 * 60 * 1000)
  if (scheduledTime < minTime) {
    scheduledTime.setTime(minTime.getTime())
  }

  console.log(`📝 Term: ${concept.term}`)
  console.log(`📂 Category: ${concept.category}`)
  console.log(`🎨 Diagram: ${concept.diagram}`)
  console.log(`⏰ Scheduled: ${scheduledTime.toISOString()}\n`)

  // Create temp dirs
  fs.mkdirSync(TEMP_DIR, { recursive: true })
  const framesDir = path.join(FRAMES_DIR, `concept-${concept.id}`)

  try {
    // Generate frames
    const { totalDuration } = generateFrames(concept, framesDir)

    // Assemble video
    const videoPath = path.join(TEMP_DIR, `explainer-${concept.id}.mp4`)
    assembleVideo(framesDir, videoPath, totalDuration)

    // Generate caption
    const caption = generateCaption(concept)

    // Upload
    console.log('\n  📤 Uploading to Facebook...')
    const result = await uploadReel(videoPath, caption, scheduledTime)
    console.log(`  ✅ Published! ID: ${result.id || result.video_id || 'success'}`)

    // Mark complete
    markConceptComplete(data, concept.id)
    console.log(`\n✅ Marked "${concept.term}" as posted`)

  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`)
    process.exit(1)
  }

  // Cleanup
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }) } catch (e) {}

  // Summary
  const remaining = data.concepts.filter(c => c.status === 'pending').length
  console.log('\n' + '='.repeat(50))
  console.log(`🎉 Explainer published: "${concept.term}"`)
  console.log(`📊 Remaining concepts: ${remaining}`)
  console.log(`📅 Days of content: ${remaining}`)
  console.log('='.repeat(50))
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
