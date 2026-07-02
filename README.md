# thrive-richly-facebook
Automated daily motivational quote posting to Thrive Richly Facebook Page

## thrive-social — AI social media manager (Blotato)

A Claude Code skill that drafts on-brand content (Reels-first), generates video via the Blotato API, publishes with human approval, and logs every post with its live URL. It is additive — the existing workflows above are untouched.

**Invoke locally:** open a Claude Code session in this repo folder and run `/thrive-social` (skill lives at `.claude/skills/thrive-social/SKILL.md`).

**Invoke via GitHub Actions:** Actions tab → "Thrive Social (Blotato AI Manager)" → Run workflow. Choose the format and type `yes` in `approve_publish` to publish live; anything else is a dry-run that prints the draft without posting. The cron schedule stays commented out in `.github/workflows/thrive-social.yml` until 10 posts have published cleanly.

**API key:** set `BLOTATO_API_KEY` as an environment variable or in a local `.env` (never committed — see `.gitignore`). For Actions, add repo secrets `BLOTATO_API_KEY` and `ANTHROPIC_API_KEY`. A missing key fails loudly; the key value is never printed or logged.

**Approval / dry-run flow:** every post is dry-run first (`scripts/thrive-social/blotato.js publish ... --dry-run` shows the exact payload). Until `published-log.jsonl` contains 10 published posts, every live publish requires explicit human approval of the exact caption + visual.

**Log:** `published-log.jsonl` is append-only, one JSON line per published post: `timestamp`, `format`, `hook`, `caption`, `mediaUrl`, `postSubmissionId`, `publicUrl`, `status`.

**Voice:** `brand-voice.md` is the single source of voice truth — edit it to change how every post sounds.
