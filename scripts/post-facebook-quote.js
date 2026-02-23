#!/usr/bin/env node

/**
 * Thrive Richly — Automated Facebook Quote Poster
 * 
 * Picks the next 5 pending quotes from quotes.json,
 * generates branded quote images (Gold Grunge style with 5-color rotation),
 * and posts them to the Thrive Richly Facebook Page via Graph API.
 * 
 * Posts are scheduled at randomized times throughout the day to feel organic.
 * 
 * Required env vars:
 *   FB_PAGE_ACCESS_TOKEN  — Page Access Token (never-expiring, from System User)
 *   FB_PAGE_ID            — Facebook Page ID (216309642249176)
 * 
 * Usage: FB_PAGE_ACCESS_TOKEN=... FB_PAGE_ID=... node scripts/post-facebook-quote.js
 */

const fs = require('fs')
const path = require('path')
const { createCanvas, registerFont } = require('canvas')

// ============================================================================
// CONFIG
// ============================================================================
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FB_PAGE_ID = process.env.FB_PAGE_ID || '216309642249176'
const QUOTES_FILE = path.join(__dirname, 'quotes.json')
const POSTS_PER_DAY = 5
const TEMP_DIR = path.join(__dirname, '..', 'temp-images')

if (!FB_PAGE_ACCESS_TOKEN) {
  console.error('❌ FB_PAGE_ACCESS_TOKEN environment variable is required')
  process.exit(1)
}

// ============================================================================
// COLOR THEMES — 5-color rotation matching the approved designs
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
// IMAGE GENERATION — Gold Grunge style with themed color glow
// ============================================================================
const WIDTH = 1080
const HEIGHT = 1350

function seededRandom(seed) {
  let s = seed
  return function () {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateQuoteImage(quoteText, author, themeKey, outputPath) {
  const theme = THEMES[themeKey]
  const [gr, gg, gb] = theme.glow
  const [sr, sg, sb] = theme.scratch

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // Use a unique seed per quote for variety
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

  // --- LAYER 2: Colored ambient glow spots ---
  const glowCenters = [
    [Math.floor(rand() * 250) + 100, Math.floor(rand() * 220) + 80],
    [Math.floor(rand() * 280) + 700, Math.floor(rand() * 250) + 100],
    [Math.floor(rand() * 250) + 150, Math.floor(rand() * 300) + 950],
    [Math.floor(rand() * 300) + 650, Math.floor(rand() * 350) + 850],
    [Math.floor(rand() * 250) + 400, Math.floor(rand() * 300) + 500],
  ]

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4
      let totalInfluence = 0

      for (const [cx, cy] of glowCenters) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        let influence = Math.max(0, 1 - d / 320)
        influence = Math.pow(influence, 2.5)
        totalInfluence += influence
      }
      totalInfluence = Math.min(totalInfluence, 1.0)

      const noise = Math.floor(rand() * 16) - 8
      data[i] = Math.min(180, Math.max(0, data[i] + Math.floor(totalInfluence * (gr * 0.5 + noise))))
      data[i + 1] = Math.min(180, Math.max(0, data[i + 1] + Math.floor(totalInfluence * (gg * 0.5 + noise * 0.7))))
      data[i + 2] = Math.min(180, Math.max(0, data[i + 2] + Math.floor(totalInfluence * (gb * 0.5 + noise * 0.5))))

      // Grain
      const grain = Math.floor(rand() * 8) - 4
      data[i] = Math.min(180, Math.max(0, data[i] + grain))
      data[i + 1] = Math.min(180, Math.max(0, data[i + 1] + grain))
      data[i + 2] = Math.min(180, Math.max(0, data[i + 2] + grain))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // --- LAYER 3: Grunge scratches ---
  const scratchRand = seededRandom(42) // Fixed seed for consistent texture
  ctx.lineWidth = 1

  for (let i = 0; i < 30; i++) {
    const sx = Math.floor(scratchRand() * WIDTH)
    const sy = Math.floor(scratchRand() * HEIGHT)
    const length = Math.floor(scratchRand() * 290) + 60
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
  for (let i = 0; i < 150; i++) {
    const px = Math.floor(scratchRand() * WIDTH)
    const py = Math.floor(scratchRand() * HEIGHT)
    const size = Math.floor(scratchRand() * 2) + 1
    const c = Math.floor(scratchRand() * 20) + 30
    ctx.fillStyle = `rgb(${sr + c}, ${sg + c}, ${sb + c})`
    ctx.beginPath()
    ctx.arc(px, py, size, 0, Math.PI * 2)
    ctx.fill()
  }

  // --- LAYER 4: Quote text ---
  const fontSize = 54
  const lineHeight = 78
  ctx.font = `bold ${fontSize}px "Poppins", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // Word wrap
  const maxWidth = WIDTH - 120
  const words = quoteText.split(' ')
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

  // Add author line if present
  const authorLine = author ? `— ${author}` : ''

  const totalTextH = lines.length * lineHeight + (authorLine ? 50 : 0)
  let startY = (HEIGHT / 2) - (totalTextH / 2) - 30

  for (const line of lines) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillText(line, WIDTH / 2 + 2, startY + 2)
    // Main text
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(line, WIDTH / 2, startY)
    startY += lineHeight
  }

  // Author attribution
  if (authorLine) {
    ctx.font = 'italic 28px "Poppins", sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fillText(authorLine, WIDTH / 2, startY + 20)
  }

  // --- LAYER 5: Brand watermark ---
  const brandY = HEIGHT - 85
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

  // Save
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 })
  fs.writeFileSync(outputPath, buffer)
  console.log(`  ✅ Image generated: ${path.basename(outputPath)} (${theme.name}, ${Math.round(buffer.length / 1024)}KB)`)
  return buffer
}

// ============================================================================
// CAPTION GENERATION — Engaging captions with emojis, no hashtags
// ============================================================================
function generateCaption(quote, author) {
  const authorStr = author ? `\n\n— ${author}` : ''

  // Rotate between caption styles
  const styles = [
    `"${quote}"${authorStr}\n\n💡 Let this sink in.`,
    `"${quote}"${authorStr}\n\n🔥 Save this for when you need it.`,
    `"${quote}"${authorStr}\n\n💪 Tag someone who needs to hear this today.`,
    `"${quote}"${authorStr}\n\n🌟 Read that again.`,
    `"${quote}"${authorStr}\n\n✨ Which word hit hardest? Drop it below.`,
    `"${quote}"${authorStr}\n\n🧠 Your mindset shapes your reality.`,
    `"${quote}"${authorStr}\n\n⚡ This one's different. Share it.`,
    `"${quote}"${authorStr}\n\n🎯 Simple truth. Powerful impact.`,
  ]

  // Use quote text hash to pick consistent style
  const hash = quote.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return styles[hash % styles.length]
}

// ============================================================================
// FACEBOOK POSTING — Graph API photo upload
// ============================================================================

async function postPhotoToFacebook(imageBuffer, caption, scheduledTime = null) {
  const url = `https://graph.facebook.com/v25.0/${FB_PAGE_ID}/photos`

  // Build multipart form data manually
  const boundary = '----FormBoundary' + Date.now().toString(36)
  const parts = []

  // Access token
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${FB_PAGE_ACCESS_TOKEN}`)

  // Caption/message
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${caption}`)

  // Scheduling (if provided)
  if (scheduledTime) {
    const unixTime = Math.floor(scheduledTime.getTime() / 1000)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="scheduled_publish_time"\r\n\r\n${unixTime}`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="published"\r\n\r\nfalse`)
  }

  // Image file
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="quote.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`)

  // Assemble body
  const textParts = parts.join('\r\n') + '\r\n'
  const textBuffer = Buffer.from(textParts, 'utf-8')
  const endBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
  const body = Buffer.concat([textBuffer, imageBuffer, endBuffer])

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Facebook API error ${response.status}: ${err}`)
  }

  const result = await response.json()
  return result
}

// ============================================================================
// SCHEDULING — Generate random times throughout the day
// ============================================================================

function generatePostTimes(count) {
  // Posting windows (UTC hours) — adjust for your audience timezone
  // These map to roughly 7AM-10PM in common timezones
  const windows = [
    { start: 7, end: 9 },    // Morning
    { start: 11, end: 13 },   // Midday
    { start: 15, end: 17 },   // Afternoon
    { start: 18, end: 20 },   // Evening
    { start: 21, end: 23 },   // Late evening
  ]

  const today = new Date()
  const times = []

  for (let i = 0; i < count; i++) {
    const window = windows[i % windows.length]
    const hour = window.start + Math.floor(Math.random() * (window.end - window.start))
    const minute = Math.floor(Math.random() * 60)

    const postTime = new Date(today)
    postTime.setUTCHours(hour, minute, 0, 0)

    // If the time is in the past, schedule for tomorrow
    if (postTime <= new Date()) {
      postTime.setDate(postTime.getDate() + 1)
    }

    // Facebook requires scheduled time to be at least 10 mins in the future
    const minTime = new Date(Date.now() + 15 * 60 * 1000)
    if (postTime < minTime) {
      postTime.setTime(minTime.getTime() + i * 5 * 60 * 1000)
    }

    times.push(postTime)
  }

  return times.sort((a, b) => a - b)
}

// ============================================================================
// TOPIC/QUOTE MANAGEMENT
// ============================================================================

function getNextQuotes(count) {
  const data = JSON.parse(fs.readFileSync(QUOTES_FILE, 'utf-8'))
  const pending = data.quotes.filter(q => q.status === 'pending')

  if (pending.length === 0) {
    console.log('✅ All quotes have been posted! Add more to quotes.json.')
    process.exit(0)
  }

  const batch = pending.slice(0, count)
  console.log(`📋 Selected ${batch.length} quotes (${pending.length - batch.length} remaining)\n`)
  return { data, batch }
}

function markQuotesPosted(data, quoteIds) {
  const today = new Date().toISOString().split('T')[0]
  for (const id of quoteIds) {
    const quote = data.quotes.find(q => q.id === id)
    if (quote) {
      quote.status = 'posted'
      quote.postedAt = today
    }
  }
  fs.writeFileSync(QUOTES_FILE, JSON.stringify(data, null, 2))
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Thrive Richly — Facebook Quote Poster\n')
  console.log(`📱 Page ID: ${FB_PAGE_ID}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`)
  console.log(`📊 Posts per day: ${POSTS_PER_DAY}\n`)

  // 1. Get next batch of quotes
  const { data, batch } = getNextQuotes(POSTS_PER_DAY)

  // 2. Create temp directory for images
  fs.mkdirSync(TEMP_DIR, { recursive: true })

  // 3. Generate schedule times
  const postTimes = generatePostTimes(batch.length)

  // 4. Process each quote
  const postedIds = []
  let successCount = 0

  for (let i = 0; i < batch.length; i++) {
    const quote = batch[i]
    const scheduledTime = postTimes[i]
    const themeKey = quote.theme || THEME_ORDER[i % THEME_ORDER.length]

    console.log(`\n--- Quote ${i + 1}/${batch.length} ---`)
    console.log(`📝 "${quote.text.substring(0, 60)}..."`)
    console.log(`🎨 Theme: ${THEMES[themeKey].name}`)
    console.log(`⏰ Scheduled: ${scheduledTime.toISOString()}`)

    try {
      // Generate image
      const imagePath = path.join(TEMP_DIR, `quote-${quote.id}.jpg`)
      const imageBuffer = generateQuoteImage(quote.text, quote.author, themeKey, imagePath)

      // Generate caption
      const caption = generateCaption(quote.text, quote.author)

      // Post to Facebook
      console.log('  📤 Posting to Facebook...')
      const result = await postPhotoToFacebook(imageBuffer, caption, scheduledTime)
      console.log(`  ✅ Posted! ID: ${result.id || result.post_id || 'scheduled'}`)

      postedIds.push(quote.id)
      successCount++

      // Small delay between API calls to be respectful
      if (i < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`)
      // Continue with remaining quotes
    }
  }

  // 5. Mark successful posts as posted
  if (postedIds.length > 0) {
    markQuotesPosted(data, postedIds)
    console.log(`\n✅ Marked ${postedIds.length} quotes as posted`)
  }

  // 6. Cleanup temp images
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  } catch (e) {}

  // 7. Summary
  console.log('\n' + '='.repeat(50))
  console.log(`🎉 Done! ${successCount}/${batch.length} posts scheduled`)
  console.log(`📊 Remaining quotes: ${data.quotes.filter(q => q.status === 'pending').length}`)
  console.log(`📅 Days of content left: ${Math.floor(data.quotes.filter(q => q.status === 'pending').length / POSTS_PER_DAY)}`)
  console.log('='.repeat(50))
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
