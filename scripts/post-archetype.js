#!/usr/bin/env node

/**
 * Thrive Richly — Archetype Post (Single Post Per Run)
 * 
 * Called 5x/day by separate GitHub Actions cron triggers.
 * Each run: picks ONE pending post with a pre-generated caption →
 * generates a branded background → posts to Facebook Graph API.
 * 
 * 5 unique background styles rotate with the 5 brand colors.
 * No external APIs needed except Facebook.
 * 
 * Env vars: FB_PAGE_ACCESS_TOKEN, FB_PAGE_ID
 * Packages: sharp
 */

const fs = require('fs');
const path = require('path');

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;

const TOPICS_FILE = path.join(__dirname, 'archetype-topics.json');
const IMAGES_DIR = path.join(__dirname, '..', 'images', 'archetype-posts');

if (!FB_PAGE_ACCESS_TOKEN) { console.error('❌ FB_PAGE_ACCESS_TOKEN required'); process.exit(1); }
if (!FB_PAGE_ID) { console.error('❌ FB_PAGE_ID required'); process.exit(1); }

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// ============================================================================
// BRAND COLORS + BACKGROUND STYLES
// ============================================================================
const THEMES = {
  gold: {
    accent: [196, 154, 42],
    text: [245, 245, 245],
    // Diagonal gradient — dark to warm
    bg: (S) => `
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(18,16,12)"/>
          <stop offset="60%" style="stop-color:rgb(28,24,14)"/>
          <stop offset="100%" style="stop-color:rgb(42,36,16)"/>
        </linearGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="url(#bg)"/>
      <rect x="0" y="${S-4}" width="${S}" height="4" fill="rgb(196,154,42)" opacity="0.6"/>
      <circle cx="${S-120}" cy="120" r="200" fill="rgb(196,154,42)" opacity="0.04"/>
      <circle cx="${S-80}" cy="160" r="120" fill="rgb(196,154,42)" opacity="0.03"/>
    `,
  },
  crimson: {
    accent: [204, 51, 51],
    text: [245, 245, 245],
    // Radial glow — bottom right
    bg: (S) => `
      <defs>
        <radialGradient id="bg" cx="85%" cy="85%" r="60%">
          <stop offset="0%" style="stop-color:rgb(50,14,14)"/>
          <stop offset="100%" style="stop-color:rgb(14,10,10)"/>
        </radialGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="url(#bg)"/>
      <line x1="0" y1="${S}" x2="${S}" y2="0" stroke="rgb(204,51,51)" stroke-width="0.5" opacity="0.08"/>
      <line x1="0" y1="${S-200}" x2="${S-200}" y2="0" stroke="rgb(204,51,51)" stroke-width="0.5" opacity="0.06"/>
      <rect x="0" y="${S-4}" width="${S}" height="4" fill="rgb(204,51,51)" opacity="0.6"/>
    `,
  },
  electric_blue: {
    accent: [46, 139, 224],
    text: [245, 245, 245],
    // Grid pattern — tech/data feel
    bg: (S) => {
      let grid = '';
      for (let i = 0; i < S; i += 60) {
        grid += `<line x1="${i}" y1="0" x2="${i}" y2="${S}" stroke="rgb(46,139,224)" stroke-width="0.5" opacity="0.04"/>`;
        grid += `<line x1="0" y1="${i}" x2="${S}" y2="${i}" stroke="rgb(46,139,224)" stroke-width="0.5" opacity="0.04"/>`;
      }
      return `
        <rect width="${S}" height="${S}" fill="rgb(10,14,22)"/>
        ${grid}
        <rect x="0" y="${S-4}" width="${S}" height="4" fill="rgb(46,139,224)" opacity="0.6"/>
        <circle cx="540" cy="540" r="400" fill="rgb(46,139,224)" opacity="0.02"/>
      `;
    },
  },
  emerald: {
    accent: [30, 170, 85],
    text: [245, 245, 245],
    // Vertical gradient — forest depth
    bg: (S) => `
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(8,18,12)"/>
          <stop offset="50%" style="stop-color:rgb(12,22,14)"/>
          <stop offset="100%" style="stop-color:rgb(16,30,18)"/>
        </linearGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="url(#bg)"/>
      <rect x="0" y="${S-4}" width="${S}" height="4" fill="rgb(30,170,85)" opacity="0.6"/>
      <rect x="${S-60}" y="0" width="2" height="${S}" fill="rgb(30,170,85)" opacity="0.06"/>
      <rect x="${S-120}" y="0" width="1" height="${S}" fill="rgb(30,170,85)" opacity="0.04"/>
    `,
  },
  violet: {
    accent: [155, 64, 208],
    text: [245, 245, 245],
    // Corner glow — top left + bottom right
    bg: (S) => `
      <defs>
        <radialGradient id="g1" cx="10%" cy="10%" r="50%">
          <stop offset="0%" style="stop-color:rgb(32,14,42)"/>
          <stop offset="100%" style="stop-color:rgba(14,10,18,0)"/>
        </radialGradient>
        <radialGradient id="g2" cx="90%" cy="90%" r="50%">
          <stop offset="0%" style="stop-color:rgb(28,12,38)"/>
          <stop offset="100%" style="stop-color:rgba(14,10,18,0)"/>
        </radialGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="rgb(14,10,18)"/>
      <rect width="${S}" height="${S}" fill="url(#g1)"/>
      <rect width="${S}" height="${S}" fill="url(#g2)"/>
      <rect x="0" y="${S-4}" width="${S}" height="4" fill="rgb(155,64,208)" opacity="0.6"/>
    `,
  },
};

// ============================================================================
// BRANDED IMAGE — 1080x1080 via Sharp + SVG
// ============================================================================
async function createPostImage(caption, theme, postId) {
  const sharp = require('sharp');
  const SIZE = 1080;
  const t = THEMES[theme] || THEMES.gold;
  const [aR, aG, aB] = t.accent;
  const [tR, tG, tB] = t.text;

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // Word-wrap first 5 lines of caption for image
  const lines = caption.split('\n').filter(l => l.trim()).slice(0, 5);
  const wrapped = [];
  for (const line of lines) {
    const words = line.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).length > 30 && cur) { wrapped.push(cur); cur = w; }
      else { cur = cur ? cur + ' ' + w : w; }
    }
    if (cur) wrapped.push(cur);
    wrapped.push('');
  }

  let y = 180;
  let svgText = '';
  for (const line of wrapped) {
    if (!line) { y += 14; continue; }
    svgText += `<text x="80" y="${y}" font-family="Poppins,Helvetica,Arial,sans-serif" font-weight="bold" font-size="40" fill="rgb(${tR},${tG},${tB})">${esc(line)}</text>\n`;
    y += 50;
  }

  const bgSvg = typeof t.bg === 'function' ? t.bg(SIZE) : '';

  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    ${bgSvg}
    <rect x="60" y="60" width="6" height="80" fill="rgb(${aR},${aG},${aB})"/>
    ${svgText}
    <rect x="80" y="${Math.min(y + 20, 780)}" width="200" height="3" fill="rgb(${aR},${aG},${aB})"/>
    <rect x="60" y="${SIZE - 100}" width="${SIZE - 120}" height="1" fill="rgb(55,55,55)"/>
    <text x="80" y="${SIZE - 58}" font-family="Poppins,Helvetica,Arial,sans-serif" font-weight="bold" font-size="22" fill="rgb(${aR},${aG},${aB})">THRIVE RICHLY</text>
    <text x="80" y="${SIZE - 32}" font-family="Poppins,Arial,sans-serif" font-size="17" fill="rgb(130,130,130)">Build wealth. Live free.</text>
  </svg>`;

  const result = await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer();

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const imgPath = path.join(IMAGES_DIR, `post-${postId}.jpg`);
  fs.writeFileSync(imgPath, result);
  console.log(`  🖼️ ${Math.round(result.length / 1024)}KB`);
  return imgPath;
}

// ============================================================================
// FACEBOOK GRAPH API — Photo post (same as post-facebook-quote.js)
// ============================================================================
async function postPhotoToFacebook(imageBuffer, caption) {
  const url = `https://graph.facebook.com/v25.0/${FB_PAGE_ID}/photos`;

  const formData = new FormData();
  formData.append('access_token', FB_PAGE_ACCESS_TOKEN);
  formData.append('message', caption);

  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('source', blob, 'archetype-post.jpg');

  const response = await fetch(url, { method: 'POST', body: formData });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Facebook API ${response.status}: ${err}`);
  }

  return await response.json();
}

// ============================================================================
// MAIN — Single post per run, caption pre-generated
// ============================================================================
async function main() {
  console.log('🚀 Thrive Richly — Archetype Post');
  console.log(`📅 ${new Date().toISOString()}\n`);

  const data = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  const ready = data.posts.filter(p => p.status === 'pending' && p.caption);
  const posted = data.posts.filter(p => p.status === 'posted').length;
  const noCaptions = data.posts.filter(p => p.status === 'pending' && !p.caption).length;

  if (!ready.length) {
    if (noCaptions > 0) {
      console.log(`⚠️ ${noCaptions} posts need captions. Run generate-archetype-captions.js first.`);
    } else {
      console.log('✅ All 1000 posts complete!');
    }
    process.exit(0);
  }

  console.log(`📊 ${posted}/${data.totalPosts} posted | ${ready.length} ready | ${noCaptions} need captions\n`);

  const post = ready[0];
  console.log(`📋 ${post.archetypeName} (${post.earning})`);
  console.log(`💡 "${post.topic}"`);
  console.log(`🎨 ${post.theme} | 🗣️ "${post.cta}"\n`);
  console.log(`📝 Caption: ${post.caption.length} chars (pre-generated)\n`);

  // 1. Create branded image
  console.log('🎨 Creating image...');
  const imgPath = await createPostImage(post.caption, post.theme, post.id);

  // 2. Post to Facebook
  console.log('📤 Posting to Facebook...');
  const imageBuffer = fs.readFileSync(imgPath);
  const fbResult = await postPhotoToFacebook(imageBuffer, post.caption);
  const fbId = fbResult?.id || fbResult?.post_id || 'unknown';
  console.log(`  ✅ FB ID: ${fbId}\n`);

  // 3. Update status
  const orig = data.posts.find(p => p.id === post.id);
  if (orig) {
    orig.status = 'posted';
    orig.postedAt = new Date().toISOString();
    orig.postId = fbId;
  }
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(data, null, 2));

  // 4. Cleanup
  try { if (fs.existsSync(IMAGES_DIR)) fs.rmSync(IMAGES_DIR, { recursive: true }); } catch {}

  const nowPosted = posted + 1;
  console.log(`🎉 Done — ${nowPosted}/${data.totalPosts} | ~${Math.ceil((data.totalPosts - nowPosted) / 5)} days remaining`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
