#!/usr/bin/env node

/**
 * Remotion Financial Explainer Generator
 *
 * Full pipeline: Claude script → ElevenLabs voiceover (optional) → Remotion render → Facebook post.
 * If ELEVENLABS_API_KEY is not set, renders text-only video with estimated timing.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY       — Claude API (writes the video script)
 *   FB_PAGE_ACCESS_TOKEN    — Facebook Graph API
 *   FB_PAGE_ID              — Facebook Page ID
 *
 * Optional env vars:
 *   ELEVENLABS_API_KEY      — ElevenLabs TTS (voiceover). Falls back to text-only if missing.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ============================================================================
// CONFIG
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FB_PAGE_ID = process.env.FB_PAGE_ID

if (!ANTHROPIC_API_KEY) { console.error('❌ ANTHROPIC_API_KEY required'); process.exit(1) }
if (!FB_PAGE_ACCESS_TOKEN || !FB_PAGE_ID) { console.error('❌ FB_PAGE_ACCESS_TOKEN and FB_PAGE_ID required'); process.exit(1) }

const TOPICS_FILE = path.join(__dirname, 'remotion-topics.json')
const CONCEPTS_FILE = path.join(__dirname, 'financial-concepts.json')
const REMOTION_DIR = path.join(__dirname, '..', 'remotion-explainer')
const SCRIPT_OUTPUT = path.join(REMOTION_DIR, 'public', 'current-script.json')
const VOICEOVER_DIR = path.join(REMOTION_DIR, 'public', 'voiceover', 'current')
const VIDEO_OUTPUT = path.join(REMOTION_DIR, 'out', 'explainer.mp4')

const ELEVENLABS_VOICE_ID = 'pNInz6obpgDQGcFmaJgB' // Adam — professional male

// ============================================================================
// HELPERS
// ============================================================================

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callClaude(prompt, maxTokens = 8000) {
  const MAX_RETRIES = 5
  const BASE_DELAY = 10000 // 10 seconds
  const MODELS = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001']

  for (const model of MODELS) {
    console.log(`  🔄 Trying model: ${model}`)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        // Retry on overloaded (529) or server errors (500, 502, 503)
        if (response.status === 529 || response.status >= 500) {
          const delayMs = BASE_DELAY * Math.pow(2, attempt - 1) // 10s, 20s, 40s, 80s, 160s
          console.warn(`  ⚠️ ${model} — ${response.status} (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delayMs / 1000}s...`)
          if (attempt === MAX_RETRIES) break // try next model
          await sleep(delayMs)
          continue
        }

        // Retry on rate limit (429) with longer delay
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after')
          const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : BASE_DELAY * Math.pow(2, attempt)
          console.warn(`  ⚠️ ${model} — rate limited (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delayMs / 1000}s...`)
          if (attempt === MAX_RETRIES) break // try next model
          await sleep(delayMs)
          continue
        }

        // Non-retryable error (e.g. 401 bad key, 400 bad request)
        if (!response.ok) {
          const err = await response.text()
          throw new Error(`Claude API error ${response.status}: ${err}`)
        }

        const data = await response.json()
        console.log(`  ✅ Success with ${model} on attempt ${attempt}`)
        return data.content[0].text

      } catch (err) {
        // If it's a non-retryable API error, throw immediately
        if (err.message && err.message.startsWith('Claude API error')) throw err

        // Network errors — retry
        const delayMs = BASE_DELAY * Math.pow(2, attempt - 1)
        console.warn(`  ⚠️ Network error (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`)
        if (attempt === MAX_RETRIES) break // try next model
        await sleep(delayMs)
        continue
      }
    }
    console.warn(`  ❌ ${model} failed all ${MAX_RETRIES} attempts, trying next model...`)
  }

  throw new Error('All Claude models failed after retries — API may be down or key may be invalid')
}

function getNextTopic() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'))
  const pending = topics.topics.find(t => t.status === 'pending')
  if (!pending) {
    console.log('✅ All Remotion topics rendered! Add more to scripts/remotion-topics.json.')
    process.exit(0)
  }
  return { topics, pending }
}

function markTopicComplete(topics, slug) {
  const topic = topics.topics.find(t => t.slug === slug)
  if (topic) {
    topic.status = 'complete'
    topic.completedAt = new Date().toISOString().split('T')[0]
  }
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2))
}

// Estimate scene duration from word count (when no voiceover)
function estimateNarrationSeconds(text) {
  const words = text.trim().split(/\s+/).length
  return Math.max(8, Math.ceil(words / 2.5)) // ~150 wpm speaking rate
}

// ============================================================================
// STAGE 1: GENERATE SCRIPT VIA CLAUDE
// ============================================================================

async function generateScript(topic) {
  console.log('🤖 Generating script with Claude...')

  // Check if we have a matching concept in financial-concepts.json for richer context
  let conceptContext = ''
  try {
    const concepts = JSON.parse(fs.readFileSync(CONCEPTS_FILE, 'utf-8'))
    const match = concepts.concepts.find(c =>
      topic.toLowerCase().includes(c.term.toLowerCase()) ||
      c.term.toLowerCase().includes(topic.toLowerCase().split(':')[0].trim())
    )
    if (match) {
      conceptContext = `\n\nEXISTING CONCEPT DATA (use as a starting point — expand significantly for this longer format):
Term: ${match.term}
Category: ${match.category}
Definition: ${match.definition}
Example: ${match.example}
Key Takeaway: ${match.keyTakeaway}`
      console.log(`📖 Found matching concept: "${match.term}" — using as context`)
    }
  } catch {}

  const prompt = `You are a financial education video scriptwriter for the "Thrive Richly" channel. Create a detailed video script for an animated explainer about: "${topic}"

This video has animated on-screen visuals. If voiceover is available, the narration drives timing. Otherwise text appears on screen.${conceptContext}

REQUIREMENTS:
- 5-10 minutes long. Each scene narration: 30-60 seconds (75-150 words). 12-18 scenes total.
- Tone: clear, engaging, educational — friendly finance teacher. Speak to a general audience aged 22-45.
- No jargon without explanation. Use specific numbers, percentages, and real-world examples.
- Narration and on-screen text COMPLEMENT each other — don't repeat the same words verbatim.

ON-SCREEN TEXT RULES (concise — viewer reads while listening):
- headline: max 6 words
- subheadline: max 12 words
- bodyText: max 2 short sentences
- bulletPoints: max 8 words each, 3-5 items
- quoteText: max 20 words

SCENE TYPES (use the right fields for each type):
- "intro": Hook with question or stat. headline + subheadline. Narration: 15-30s.
- "concept": Core explanation. headline + subheadline + bodyText. Narration: 30-50s.
- "example": Real scenario with numbers. bigNumber + bigNumberLabel + bodyText. Narration: 25-45s.
- "comparison": Two sides. comparisonLeft + comparisonRight (each has title, 3-4 points, color as hex). Narration: 35-55s.
- "chart": Data viz. chartType (bar/line/pie) + chartData (4-8 items with label, value, optional color hex) + chartTitle. Narration: 30-50s.
- "keypoints": 3-5 bulletPoints. headline. Narration: 30-50s.
- "quote": quoteText + quoteAuthor. Narration: 15-25s.
- "recap": 3-5 bulletPoints as takeaways. headline. Narration: 25-40s.
- "outro": CTA. headline + subheadline + bodyText. Narration: 10-20s.

STRUCTURE: intro → 10-14 middle scenes (varied types, never same type back to back) → recap → outro

COLOR SCHEME: Dark backgrounds (#0a0a0a to #1a1a2e). Use blue/green/gold accents. White text.

CRITICAL: Return ONLY valid JSON (no markdown fences, no backticks, no explanation):
{
  "topic": "string",
  "description": "One sentence description",
  "targetDurationMinutes": number,
  "colorScheme": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "muted": "#hex" },
  "scenes": [
    {
      "id": "scene-01-intro",
      "type": "intro",
      "title": "Scene title",
      "narration": "Full voiceover text for this scene...",
      "onScreenText": { "headline": "...", "subheadline": "..." },
      "transitionToNext": "fade"
    }
  ]
}

Scene IDs must follow the pattern: scene-01-intro, scene-02-concept, scene-03-example, etc.
transitionToNext must be one of: "fade", "slide", "wipe", "none".`

  const rawResponse = await callClaude(prompt)

  // Clean response (remove markdown fences if present)
  let cleaned = rawResponse.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  cleaned = cleaned.trim()

  const script = JSON.parse(cleaned)
  console.log(`✅ Script: ${script.scenes.length} scenes for "${script.topic}"`)
  return script
}

// ============================================================================
// STAGE 2: GENERATE VOICEOVER (OPTIONAL)
// ============================================================================

async function generateVoiceover(script) {
  if (!ELEVENLABS_API_KEY) {
    console.log('⏭️  No ELEVENLABS_API_KEY — skipping voiceover (text-only mode)')
    return false
  }

  console.log(`🎙️  Generating voiceover for ${script.scenes.length} scenes...`)
  fs.mkdirSync(VOICEOVER_DIR, { recursive: true })

  let successCount = 0

  for (const scene of script.scenes) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: scene.narration,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.2 },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`  ✗ ${scene.id}: ElevenLabs ${response.status} — ${errorText}`)
        continue
      }

      const buf = Buffer.from(await response.arrayBuffer())
      fs.writeFileSync(path.join(VOICEOVER_DIR, `${scene.id}.mp3`), buf)
      console.log(`  ✓ ${scene.id} (${(buf.byteLength / 1024).toFixed(0)} KB)`)
      successCount++

      // Rate limit pause
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error(`  ✗ ${scene.id}: ${err.message}`)
    }
  }

  const hasVoiceover = successCount === script.scenes.length
  if (!hasVoiceover) {
    console.warn(`⚠️ Only ${successCount}/${script.scenes.length} voiceovers generated — falling back to text-only`)
  } else {
    console.log(`✅ All ${successCount} voiceovers generated`)
  }

  return hasVoiceover
}

// ============================================================================
// STAGE 3: RENDER WITH REMOTION
// ============================================================================

function renderVideo(script, hasVoiceover) {
  console.log('🎬 Rendering video with Remotion...')
  console.log(`   Mode: ${hasVoiceover ? 'voiceover' : 'text-only'}`)

  // Save script with voiceover flag for Remotion to read
  const renderProps = { ...script, hasVoiceover }
  fs.mkdirSync(path.dirname(SCRIPT_OUTPUT), { recursive: true })
  fs.writeFileSync(SCRIPT_OUTPUT, JSON.stringify(renderProps, null, 2))

  // Create output directory
  fs.mkdirSync(path.dirname(VIDEO_OUTPUT), { recursive: true })

  try {
    execSync(
      `npx remotion render FinancialExplainer "${VIDEO_OUTPUT}" --props="public/current-script.json" --concurrency=2 --gl=angle --timeout=120000`,
      {
        stdio: 'inherit',
        cwd: REMOTION_DIR,
      }
    )
    console.log(`✅ Video rendered: ${VIDEO_OUTPUT}`)
    return true
  } catch (err) {
    console.error('❌ Remotion render failed')
    return false
  }
}

// ============================================================================
// STAGE 4: POST TO FACEBOOK
// ============================================================================

async function postToFacebook(script) {
  console.log('📤 Posting video to Facebook...')

  const videoBuffer = fs.readFileSync(VIDEO_OUTPUT)
  const videoSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(1)
  console.log(`   Video size: ${videoSizeMB} MB`)

  // Build caption
  const caption = `💡 ${script.topic}\n\n${script.description}\n\n🔔 Follow Thrive Richly for weekly financial education!\n\n#ThriveRichly #FinancialEducation #WealthMindset #MoneyTips`

  // Step 1: Start upload session
  const startRes = await fetch(
    `https://graph.facebook.com/v21.0/${FB_PAGE_ID}/videos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: FB_PAGE_ACCESS_TOKEN,
        upload_phase: 'start',
        file_size: videoBuffer.byteLength,
      }),
    }
  )

  if (!startRes.ok) {
    const errText = await startRes.text()
    throw new Error(`FB start upload failed: ${startRes.status} — ${errText}`)
  }

  const startData = await startRes.json()
  const { upload_session_id, video_id } = startData
  console.log(`   Upload session: ${upload_session_id}`)

  // Step 2: Upload video chunks
  const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
  let offset = 0

  while (offset < videoBuffer.byteLength) {
    const chunk = videoBuffer.subarray(offset, offset + CHUNK_SIZE)
    const form = new FormData()
    form.append('access_token', FB_PAGE_ACCESS_TOKEN)
    form.append('upload_phase', 'transfer')
    form.append('upload_session_id', upload_session_id)
    form.append('start_offset', String(offset))
    form.append('video_file_chunk', new Blob([chunk]), 'chunk.mp4')

    const transferRes = await fetch(
      `https://graph.facebook.com/v21.0/${FB_PAGE_ID}/videos`,
      { method: 'POST', body: form }
    )

    if (!transferRes.ok) {
      const errText = await transferRes.text()
      throw new Error(`FB chunk upload failed at offset ${offset}: ${errText}`)
    }

    const transferData = await transferRes.json()
    offset = parseInt(transferData.start_offset, 10)
    console.log(`   Uploaded: ${Math.min(100, Math.round(offset / videoBuffer.byteLength * 100))}%`)
  }

  // Step 3: Finish upload
  const finishRes = await fetch(
    `https://graph.facebook.com/v21.0/${FB_PAGE_ID}/videos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: FB_PAGE_ACCESS_TOKEN,
        upload_phase: 'finish',
        upload_session_id,
        title: script.topic,
        description: caption,
      }),
    }
  )

  if (!finishRes.ok) {
    const errText = await finishRes.text()
    throw new Error(`FB finish upload failed: ${errText}`)
  }

  const finishData = await finishRes.json()
  console.log(`✅ Posted to Facebook! Video ID: ${finishData.video_id || video_id}`)
  return true
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Starting Remotion Financial Explainer pipeline...\n')

  // 1. Get next topic
  const { topics, pending } = getNextTopic()
  console.log(`📝 Topic: ${pending.title}`)
  console.log(`🔗 Slug: ${pending.slug}\n`)

  // 2. Generate script via Claude
  const script = await generateScript(pending.title)

  // 3. Generate voiceover (optional)
  const hasVoiceover = await generateVoiceover(script)

  // If no voiceover, add estimated durations to script for Remotion
  if (!hasVoiceover) {
    script.sceneDurations = script.scenes.map(s => estimateNarrationSeconds(s.narration))
  }

  // 4. Render video with Remotion
  const rendered = renderVideo(script, hasVoiceover)
  if (!rendered) {
    console.error('❌ Render failed — aborting')
    process.exit(1)
  }

  // 5. Post to Facebook
  try {
    await postToFacebook(script)
  } catch (err) {
    console.error(`❌ Facebook post failed: ${err.message}`)
    console.log('⚠️ Video was rendered but not posted. Check FB token.')
  }

  // 6. Mark topic complete
  markTopicComplete(topics, pending.slug)
  console.log(`✅ Marked "${pending.slug}" as complete`)

  // Cleanup temp files
  try {
    fs.rmSync(VOICEOVER_DIR, { recursive: true, force: true })
    fs.rmSync(VIDEO_OUTPUT, { force: true })
  } catch {}

  console.log('\n🎉 Done!')
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
