#!/usr/bin/env node

/**
 * Thrive Richly — Automated Facebook Reels Generator
 * 
 * Generates animated quote videos (Gold Grunge style) and posts them
 * as Facebook Reels via the Graph API.
 * 
 * Each Reel features:
 *   - 1080x1920 portrait video (9:16 Reels format)
 *   - Same Gold Grunge background with colored glow
 *   - Quote text revealing line by line with fade animation
 *   - Author attribution fade-in
 *   - THRIVE RICHLY watermark
 *   - Ambient motivational audio bed
 *   - 15-20 seconds duration
 * 
 * Required env vars:
 *   FB_PAGE_ACCESS_TOKEN  — Page Access Token
 *   FB_PAGE_ID            — Facebook Page ID
 * 
 * Usage: FB_PAGE_ACCESS_TOKEN=... FB_PAGE_ID=... node scripts/generate-reels.js
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
const QUOTES_FILE = path.join(__dirname, 'quotes.json')
const REELS_PER_DAY = 3
const TEMP_DIR = path.join(__dirname, '..', 'temp-reels')
const FRAMES_DIR = path.join(TEMP_DIR, 'frames')
const MUSIC_DIR = path.join(__dirname, 'music')

// Video settings
const WIDTH = 1080
const HEIGHT = 1920
const FPS = 24

if (!FB_PAGE_ACCESS_TOKEN) {
  console.error('❌ FB_PAGE_ACCESS_TOKEN environment variable is required')
  process.exit(1)
}

// ============================================================================
// COLOR THEMES — Same as image posts
// ============================================================================
const THEMES = {
  gold: {
    name: 'Gold',
    glow: [196, 154, 42],
    brand1: '#C49A2A',
    brand2: '#E8C547',
    scratch: [40, 35, 15],
  },
  crimson: {
    name: 'Crimson',
    glow: [180, 30, 30],
    brand1: '#CC3333',
    brand2: '#FF5555',
    scratch: [40, 15, 15],
  },
  electric_blue: {
    name: 'Electric Blue',
    glow: [20, 100, 200],
    brand1: '#2E8BE0',
    brand2: '#50AAFF',
    scratch: [15, 25, 40],
  },
  emerald: {
    name: 'Emerald',
    glow: [20, 160, 80],
    brand1: '#1EAA55',
    brand2: '#2EDD6E',
    scratch: [15, 35, 20],
  },
  violet: {
    name: 'Violet',
    glow: [130, 40, 200],
    brand1: '#9B40D0',
    brand2: '#C070FF',
    scratch: [30, 15, 40],
  },
}

const THEME_ORDER = ['gold', 'crimson', 'electric_blue', 'emerald', 'violet']

// ============================================================================
// SEEDED RANDOM — Consistent results per quote
// ============================================================================
function seededRandom(seed) {
  let s = seed
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ============================================================================
// BACKGROUND GENERATION — Same grunge style, 1080x1920 portrait
// ============================================================================
function generateBackground(quoteText, themeKey) {
  const theme = THEMES[themeKey]
  const [gr, gg, gb] = theme.glow
  const [sr, sg, sb] = theme.scratch

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const seed = quoteText.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rand = seededRandom(seed)

  // --- LAYER 1: Deep black base with subtle grain ---
  const imageData = ctx.createImageData(WIDTH, HEIGHT)
  const data = imageData.data

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4
      const base = Math.floor(rand() * 12) + 8
      data[i] = base
      data[i + 1] = base
      data[i + 2] = base + 1
      data[i + 3] = 255
    }
  }

  // --- LAYER 2: Colored ambient glow spots (more for taller canvas) ---
  const glowCenters = [
    [Math.floor(rand() * 300) + 100, Math.floor(rand() * 250) + 80],
    [Math.floor(rand() * 300) + 680, Math.floor(rand() * 250) + 150],
    [Math.floor(rand() * 300) + 100, Math.floor(rand() * 300) + 750],
    [Math.floor(rand() * 300) + 680, Math.floor(rand() * 300) + 650],
    [Math.floor(rand() * 300) + 350, Math.floor(rand() * 300) + 400],
    [Math.floor(rand() * 300) + 200, Math.floor(rand() * 350) + 1300],
    [Math.floor(rand() * 300) + 700, Math.floor(rand() * 350) + 1400],
  ]

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4
      let totalInfluence = 0

      for (const [cx, cy] of glowCenters) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        let influence = Math.max(0, 1 - d / 350)
        influence = Math.pow(influence, 2.5)
        totalInfluence += influence
      }
      totalInfluence = Math.min(totalInfluence, 1.0)

      const noise = Math.floor(rand() * 16) - 8
      data[i] = Math.min(180, Math.max(0, data[i] + Math.floor(totalInfluence * (gr * 0.5 + noise))))
      data[i + 1] = Math.min(180, Math.max(0, data[i + 1] + Math.floor(totalInfluence * (gg * 0.5 + noise * 0.7))))
      data[i + 2] = Math.min(180, Math.max(0, data[i + 2] + Math.floor(totalInfluence * (gb * 0.5 + noise * 0.5))))

      const grain = Math.floor(rand() * 8) - 4
      data[i] = Math.min(180, Math.max(0, data[i] + grain))
      data[i + 1] = Math.min(180, Math.max(0, data[i + 1] + grain))
      data[i + 2] = Math.min(180, Math.max(0, data[i + 2] + grain))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // --- LAYER 3: Grunge scratches ---
  const scratchRand = seededRandom(42)
  ctx.lineWidth = 1

  for (let i = 0; i < 40; i++) {
    const sx = Math.floor(scratchRand() * WIDTH)
    const sy = Math.floor(scratchRand() * HEIGHT)
    const length = Math.floor(scratchRand() * 350) + 80
    const angle = scratchRand() * 0.8 - 0.4
    const ex = sx + Math.floor(length * Math.cos(angle))
    const ey = sy + Math.floor(length * Math.sin(angle))
    const c = Math.floor(scratchRand() * 20) + 20
    ctx.strokeStyle = `rgb(${sr + c}, ${sg + c}, ${sb + c})`
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }

  // Dust particles
  for (let i = 0; i < 200; i++) {
    const px = Math.floor(scratchRand() * WIDTH)
    const py = Math.floor(scratchRand() * HEIGHT)
    const size = Math.floor(scratchRand() * 2) + 1
    const c = Math.floor(scratchRand() * 20) + 30
    ctx.fillStyle = `rgb(${sr + c}, ${sg + c}, ${sb + c})`
    ctx.beginPath()
    ctx.arc(px, py, size, 0, Math.PI * 2)
    ctx.fill()
  }

  // Read back the complete background (including scratches/dust)
  return ctx.getImageData(0, 0, WIDTH, HEIGHT)
}

// ============================================================================
// TEXT WRAPPING — Calculate line breaks using canvas metrics
// ============================================================================
function getWrappedLines(text, fontSize, maxWidth) {
  const canvas = createCanvas(1, 1)
  const ctx = canvas.getContext('2d')
  ctx.font = `bold ${fontSize}px "Poppins", sans-serif`

  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines
}

// ============================================================================
// FRAME GENERATION — Render each frame with text at current animation state
// ============================================================================
function generateFrames(quoteText, author, themeKey, framesDir) {
  const theme = THEMES[themeKey]
  const fontSize = 52
  const lineHeight = 76
  const maxWidth = WIDTH - 140

  console.log('  🎨 Generating background...')
  const bgImageData = generateBackground(quoteText, themeKey)

  const lines = getWrappedLines(quoteText, fontSize, maxWidth)
  const authorLine = author ? `— ${author}` : ''

  // --- Animation timeline ---
  const INTRO_DURATION = 1.5          // Background only
  const LINE_FADE_DURATION = 0.6      // Each line fades in
  const LINE_HOLD_DURATION = 0.6      // Hold after each line appears
  const AUTHOR_FADE_DURATION = 0.7    // Author fades in
  const FULL_HOLD_DURATION = 5.0      // All text visible
  const OUTRO_FADE_DURATION = 1.5     // Fade to black

  const totalLineDuration = lines.length * (LINE_FADE_DURATION + LINE_HOLD_DURATION)
  const authorDuration = authorLine ? (AUTHOR_FADE_DURATION + 0.5) : 0
  const totalDuration = INTRO_DURATION + totalLineDuration + authorDuration + FULL_HOLD_DURATION + OUTRO_FADE_DURATION
  const totalFrames = Math.ceil(totalDuration * FPS)

  console.log(`  📐 ${lines.length} lines, ${authorLine ? 'with' : 'no'} author, ${totalDuration.toFixed(1)}s, ${totalFrames} frames`)

  // Calculate text vertical positioning (centered in middle zone)
  const totalTextHeight = lines.length * lineHeight + (authorLine ? 60 : 0)
  const textStartY = (HEIGHT / 2) - (totalTextHeight / 2) - 40

  // Create reusable canvas
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  fs.mkdirSync(framesDir, { recursive: true })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS // Current time in seconds

    // Restore background
    ctx.putImageData(bgImageData, 0, 0)

    // Calculate global fade (outro)
    const outroStart = totalDuration - OUTRO_FADE_DURATION
    let globalAlpha = 1.0
    if (t >= outroStart) {
      globalAlpha = Math.max(0, 1 - (t - outroStart) / OUTRO_FADE_DURATION)
    }

    // --- Draw brand watermark (always visible, affected by outro) ---
    ctx.globalAlpha = globalAlpha * 0.9
    const brandY = HEIGHT - 120
    ctx.font = 'bold 22px "Poppins", sans-serif'

    // Separator line
    ctx.strokeStyle = theme.brand1
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(WIDTH / 2 - 60, brandY - 20)
    ctx.lineTo(WIDTH / 2 + 60, brandY - 20)
    ctx.stroke()

    // Brand text
    const t1 = 'THRIVE '
    const t2 = 'RICHLY'
    const t1Width = ctx.measureText(t1).width
    const t2Width = ctx.measureText(t2).width
    const totalBrandWidth = t1Width + t2Width
    const brandX = (WIDTH - totalBrandWidth) / 2

    ctx.textAlign = 'left'
    ctx.fillStyle = theme.brand1
    ctx.fillText(t1, brandX, brandY)
    ctx.fillStyle = theme.brand2
    ctx.fillText(t2, brandX + t1Width, brandY)

    // --- Draw quote lines with fade-in animation ---
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    for (let li = 0; li < lines.length; li++) {
      const lineAppearTime = INTRO_DURATION + li * (LINE_FADE_DURATION + LINE_HOLD_DURATION)
      const lineEndFade = lineAppearTime + LINE_FADE_DURATION

      let lineAlpha = 0
      if (t >= lineAppearTime && t < lineEndFade) {
        lineAlpha = (t - lineAppearTime) / LINE_FADE_DURATION
      } else if (t >= lineEndFade) {
        lineAlpha = 1.0
      }

      if (lineAlpha > 0) {
        const y = textStartY + li * lineHeight

        ctx.globalAlpha = lineAlpha * globalAlpha

        // Shadow
        ctx.font = `bold ${fontSize}px "Poppins", sans-serif`
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillText(lines[li], WIDTH / 2 + 2, y + 2)

        // Main text
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(lines[li], WIDTH / 2, y)
      }
    }

    // --- Draw author with fade-in ---
    if (authorLine) {
      const authorAppearTime = INTRO_DURATION + totalLineDuration
      const authorEndFade = authorAppearTime + AUTHOR_FADE_DURATION

      let authorAlpha = 0
      if (t >= authorAppearTime && t < authorEndFade) {
        authorAlpha = (t - authorAppearTime) / AUTHOR_FADE_DURATION
      } else if (t >= authorEndFade) {
        authorAlpha = 1.0
      }

      if (authorAlpha > 0) {
        const authorY = textStartY + lines.length * lineHeight + 25
        ctx.globalAlpha = authorAlpha * globalAlpha * 0.6
        ctx.font = 'italic 28px "Poppins", sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(authorLine, WIDTH / 2, authorY)
      }
    }

    // Reset alpha
    ctx.globalAlpha = 1.0

    // Save frame
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.88 })
    const frameNum = String(frame).padStart(5, '0')
    fs.writeFileSync(path.join(framesDir, `frame_${frameNum}.jpg`), buffer)

    // Progress log every 2 seconds of video
    if (frame % (FPS * 2) === 0) {
      console.log(`  🎞️  Rendered ${frame}/${totalFrames} frames (${(t).toFixed(1)}s / ${totalDuration.toFixed(1)}s)`)
    }
  }

  console.log(`  ✅ All ${totalFrames} frames rendered`)
  return { totalDuration, totalFrames }
}

// ============================================================================
// AUDIO GENERATION — Ambient motivational pad using FFmpeg synthesis
// ============================================================================
function generateAudio(duration, outputPath) {
  // Check for user-provided music files first
  if (fs.existsSync(MUSIC_DIR)) {
    const musicFiles = fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.aac') || f.endsWith('.m4a'))
    if (musicFiles.length > 0) {
      const picked = musicFiles[Math.floor(Math.random() * musicFiles.length)]
      const musicPath = path.join(MUSIC_DIR, picked)
      console.log(`  🎵 Using custom music: ${picked}`)

      execSync(`ffmpeg -y -i "${musicPath}" -t ${duration} -af "afade=t=in:d=1.5,afade=t=out:st=${duration - 2}:d=2,volume=0.4" -c:a aac -b:a 128k "${outputPath}"`)
      return
    }
  }

  // Generate ambient audio with FFmpeg synthesis
  console.log('  🎵 Generating ambient audio...')

  // Create a warm ambient pad: layered sine waves + filtered pink noise
  // A major chord: A2 (110Hz), E3 (164.81Hz), A3 (220Hz), C#4 (277.18Hz)
  const fadeOutStart = Math.max(0, duration - 3)
  const filterComplex = `[0]lowpass=f=250,volume=0.12[noise];[1]volume=0.08[a2];[2]volume=0.06[e3];[3]volume=0.05[a3];[4]volume=0.03[cs4];[noise][a2][e3][a3][cs4]amix=inputs=5:duration=longest,aecho=0.8:0.88:500|700:0.25|0.2,lowpass=f=3000,afade=t=in:d=2,afade=t=out:st=${fadeOutStart}:d=3`

  try {
    execSync(`ffmpeg -y -f lavfi -i "anoisesrc=c=pink:r=44100:d=${duration}" -f lavfi -i "sine=f=110:d=${duration}" -f lavfi -i "sine=f=164.81:d=${duration}" -f lavfi -i "sine=f=220:d=${duration}" -f lavfi -i "sine=f=277.18:d=${duration}" -filter_complex "${filterComplex}" -t ${duration} -c:a aac -b:a 128k "${outputPath}" 2>&1`)
    console.log('  ✅ Audio generated (ambient pad)')
  } catch (err) {
    // Fallback: simple sine tone if complex filter fails
    console.log('  ⚠️  Complex audio failed, using simple tone...')
    try {
      execSync(`ffmpeg -y -f lavfi -i "sine=f=174.61:d=${duration}" -af "volume=0.06,lowpass=f=800,afade=t=in:d=2,afade=t=out:st=${fadeOutStart}:d=3" -t ${duration} -c:a aac -b:a 128k "${outputPath}" 2>&1`)
      console.log('  ✅ Audio generated (simple tone)')
    } catch (err2) {
      // Last resort: silent audio track
      console.log('  ⚠️  Tone failed, generating silent audio...')
      execSync(`ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${duration} -c:a aac -b:a 128k "${outputPath}" 2>&1`)
      console.log('  ✅ Silent audio generated')
    }
  }
}

// ============================================================================
// VIDEO ASSEMBLY — Combine frames + audio into MP4
// ============================================================================
function assembleVideo(framesDir, audioPath, outputPath, duration) {
  console.log('  🎬 Assembling video...')

  const cmd = [
    'ffmpeg -y',
    `-framerate ${FPS}`,
    `-i "${framesDir}/frame_%05d.jpg"`,
    `-i "${audioPath}"`,
    '-c:v libx264 -preset medium -crf 23',
    '-c:a aac -b:a 128k',
    '-pix_fmt yuv420p',
    '-shortest',
    '-movflags +faststart',
    `"${outputPath}"`,
    '2>&1'
  ].join(' ')

  execSync(cmd)

  const stats = fs.statSync(outputPath)
  console.log(`  ✅ Video assembled: ${path.basename(outputPath)} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`)
}

// ============================================================================
// FACEBOOK REELS UPLOAD — 3-step process via Graph API
// ============================================================================
async function uploadReel(videoPath, caption, scheduledTime = null) {
  const videoBuffer = fs.readFileSync(videoPath)
  const fileSize = videoBuffer.length

  // Step 1: Initialize upload
  console.log('  📤 Initializing Reel upload...')
  const initResponse = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'start',
      access_token: FB_PAGE_ACCESS_TOKEN,
    }),
  })

  if (!initResponse.ok) {
    const err = await initResponse.text()
    throw new Error(`Reel init failed ${initResponse.status}: ${err}`)
  }

  const initData = await initResponse.json()
  const videoId = initData.video_id
  const uploadUrl = initData.upload_url

  console.log(`  📤 Video ID: ${videoId}, uploading ${(fileSize / 1024 / 1024).toFixed(1)}MB...`)

  // Step 2: Upload the video binary
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
    const err = await uploadResponse.text()
    throw new Error(`Reel upload failed ${uploadResponse.status}: ${err}`)
  }

  console.log('  📤 Upload complete, publishing...')

  // Step 3: Publish or schedule
  const finishBody = {
    upload_phase: 'finish',
    video_id: videoId,
    title: caption.substring(0, 100),
    description: caption,
    access_token: FB_PAGE_ACCESS_TOKEN,
  }

  if (scheduledTime) {
    const unixTime = Math.floor(scheduledTime.getTime() / 1000)
    finishBody.video_state = 'SCHEDULED'
    finishBody.scheduled_publish_time = unixTime
  }

  const finishResponse = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finishBody),
  })

  if (!finishResponse.ok) {
    const err = await finishResponse.text()

    // If scheduling fails, try publishing immediately
    if (scheduledTime && finishResponse.status === 400) {
      console.log('  ⚠️  Scheduling failed, posting immediately...')
      delete finishBody.video_state
      delete finishBody.scheduled_publish_time

      const retryResponse = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/video_reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finishBody),
      })

      if (!retryResponse.ok) {
        const retryErr = await retryResponse.text()
        throw new Error(`Reel publish failed ${retryResponse.status}: ${retryErr}`)
      }

      const retryData = await retryResponse.json()
      return { ...retryData, scheduled: false }
    }

    throw new Error(`Reel finish failed ${finishResponse.status}: ${err}`)
  }

  const finishData = await finishResponse.json()
  return { ...finishData, scheduled: !!scheduledTime }
}

// ============================================================================
// CAPTION GENERATION — Reel-specific captions (shorter, punchier)
// ============================================================================
function generateReelCaption(quote, author) {
  const authorStr = author ? ` — ${author}` : ''

  const styles = [
    `"${quote}"${authorStr}\n\n🔥 Save this.`,
    `"${quote}"${authorStr}\n\n💡 Let it sink in.`,
    `"${quote}"${authorStr}\n\n⚡ Share with someone who needs this.`,
    `"${quote}"${authorStr}\n\n🌟 Read. That. Again.`,
    `"${quote}"${authorStr}\n\n🎯 Which line hit different?`,
    `"${quote}"${authorStr}\n\n🧠 This changes everything.`,
  ]

  const hash = quote.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return styles[hash % styles.length]
}

// ============================================================================
// SCHEDULING — 3 time windows for Reels
// ============================================================================
function generateReelTimes(count) {
  const windows = [
    { start: 8, end: 10 },    // Morning
    { start: 14, end: 16 },   // Afternoon
    { start: 19, end: 21 },   // Evening
  ]

  const today = new Date()
  const times = []

  for (let i = 0; i < count; i++) {
    const window = windows[i % windows.length]
    const hour = window.start + Math.floor(Math.random() * (window.end - window.start))
    const minute = Math.floor(Math.random() * 60)

    const postTime = new Date(today)
    postTime.setUTCHours(hour, minute, 0, 0)

    if (postTime <= new Date()) {
      postTime.setDate(postTime.getDate() + 1)
    }

    const minTime = new Date(Date.now() + 15 * 60 * 1000)
    if (postTime < minTime) {
      postTime.setTime(minTime.getTime() + i * 10 * 60 * 1000)
    }

    times.push(postTime)
  }

  return times.sort((a, b) => a - b)
}

// ============================================================================
// QUOTE MANAGEMENT — Picks from END of array for mix with image posts
// ============================================================================
function getNextReelQuotes(count) {
  const data = JSON.parse(fs.readFileSync(QUOTES_FILE, 'utf-8'))

  // Pick quotes without reelStatus (not yet posted as Reel)
  // Start from the END of the array for natural mix with image posts
  const available = data.quotes.filter(q => q.reelStatus !== 'posted').reverse()

  if (available.length === 0) {
    console.log('✅ All quotes have been posted as Reels! Add more to quotes.json.')
    process.exit(0)
  }

  const batch = available.slice(0, count)
  console.log(`📋 Selected ${batch.length} quotes for Reels (${available.length - batch.length} remaining)\n`)
  return { data, batch }
}

function markReelsPosted(data, quoteIds) {
  const today = new Date().toISOString().split('T')[0]
  for (const id of quoteIds) {
    const quote = data.quotes.find(q => q.id === id)
    if (quote) {
      quote.reelStatus = 'posted'
      quote.reelPostedAt = today
    }
  }
  fs.writeFileSync(QUOTES_FILE, JSON.stringify(data, null, 2))
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('🎬 Thrive Richly — Facebook Reels Generator\n')
  console.log(`📱 Page ID: ${FB_PAGE_ID}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`)
  console.log(`🎞️  Reels per day: ${REELS_PER_DAY}\n`)

  // 1. Get next batch of quotes
  const { data, batch } = getNextReelQuotes(REELS_PER_DAY)

  // 2. Create temp directories
  fs.mkdirSync(TEMP_DIR, { recursive: true })

  // 3. Generate schedule times
  const reelTimes = generateReelTimes(batch.length)

  // 4. Process each quote
  const postedIds = []
  let successCount = 0

  for (let i = 0; i < batch.length; i++) {
    const quote = batch[i]
    const scheduledTime = reelTimes[i]
    const themeKey = quote.theme || THEME_ORDER[i % THEME_ORDER.length]

    console.log(`\n${'='.repeat(50)}`)
    console.log(`🎬 Reel ${i + 1}/${batch.length}`)
    console.log(`📝 "${quote.text.substring(0, 60)}..."`)
    console.log(`🎨 Theme: ${THEMES[themeKey].name}`)
    console.log(`⏰ Scheduled: ${scheduledTime.toISOString()}`)

    try {
      // Create unique frames directory for this reel
      const reelFramesDir = path.join(FRAMES_DIR, `reel-${quote.id}`)

      // Generate frames
      const { totalDuration } = generateFrames(quote.text, quote.author, themeKey, reelFramesDir)

      // Generate audio
      const audioPath = path.join(TEMP_DIR, `audio-${quote.id}.aac`)
      generateAudio(totalDuration, audioPath)

      // Assemble video
      const videoPath = path.join(TEMP_DIR, `reel-${quote.id}.mp4`)
      assembleVideo(reelFramesDir, audioPath, videoPath, totalDuration)

      // Generate caption
      const caption = generateReelCaption(quote.text, quote.author)

      // Upload to Facebook
      console.log('  📤 Uploading Reel to Facebook...')
      const result = await uploadReel(videoPath, caption, scheduledTime)
      const status = result.scheduled ? 'scheduled' : 'published'
      console.log(`  ✅ Reel ${status}! ID: ${result.id || result.video_id || 'success'}`)

      postedIds.push(quote.id)
      successCount++

      // Clean up frames to save disk space
      fs.rmSync(reelFramesDir, { recursive: true, force: true })

      // Delay between uploads
      if (i < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`)
    }
  }

  // 5. Mark successful reels
  if (postedIds.length > 0) {
    markReelsPosted(data, postedIds)
    console.log(`\n✅ Marked ${postedIds.length} quotes as Reel-posted`)
  }

  // 6. Cleanup
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  } catch (e) {}

  // 7. Summary
  const remainingReels = data.quotes.filter(q => q.reelStatus !== 'posted').length
  console.log('\n' + '='.repeat(50))
  console.log(`🎉 Done! ${successCount}/${batch.length} Reels created`)
  console.log(`📊 Remaining for Reels: ${remainingReels}`)
  console.log(`📅 Days of Reel content: ${Math.floor(remainingReels / REELS_PER_DAY)}`)
  console.log('='.repeat(50))
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
