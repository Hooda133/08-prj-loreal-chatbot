# Project 8 — Beauty Atelier (L'Oréal-inspired AI Chatbot)

A responsive student project featuring a personalized beauty chat interface for skincare, makeup, haircare and fragrance. **Independent educational demo; not affiliated with L'Oréal.**

## Features
- Premium editorial homepage with animated original beauty still-life artwork
- Five custom-dimensional SVG icons, plus moving product orbits, a luxury announcement ticker, animated product cards and a cinematic beauty-ritual showroom
- Responsive high-end design with reduced-motion support and a footer pause/resume-motion control
- Four functional beauty-category prompts and a new personalized-routine CTA
- Dedicated beauty concierge panel with suggested prompts, subtle motion, and accessible status feedback
- Safe formatting of common AI response Markdown: bold text, headings, bullet/numbered lists (no HTML injection)
- Conversation history with Cloudflare message-length protection; user messages are removed on failed attempts so retries don't duplicate them
- Cloudflare Worker securely holds the OpenAI API key; the working endpoint is already configured in `script.js`

## Local preview
Run a static server or open `index.html` in Codespaces/VS Code Live Preview. There are no build tools or third-party JS libraries. The real AI backend is still the Cloudflare Worker configured in `script.js`. Your Cloudflare `ALLOWED_ORIGIN` variable must contain the exact preview origin to allow browser requests.

## Deploy the Worker
1. In Cloudflare Dashboard, create a new Worker and replace its code with `RESOURCE_cloudflare-worker.js`.
2. In **Settings → Variables and Secrets**, add **OPENAI_API_KEY** as a **secret** (never commit it).
3. Add **ALLOWED_ORIGIN** as a Text variable containing your allowed site origin(s). For GitHub Pages use `https://hooda133.github.io`. To support a Codespaces live preview **at the same time**, add a comma and the exact preview origin from your browser address bar, for example `https://hooda133.github.io,https://your-codespace-3000.app.github.dev`. Do **not** include paths or trailing slashes. Save the variable and deploy the updated Worker code. Change the Codespaces origin when its preview URL changes.
4. Deploy the Worker and copy its HTTPS `workers.dev` URL.
5. Paste the URL in `script.js` as `WORKER_URL`. This Worker URL is public; **the API key must remain secret**.
6. Deploy the static site using GitHub Pages (Settings → Pages → Deploy from branch, `main`, root) or another static host.

### Security notes
The Worker validates message shape and length, restricts browser CORS to explicitly listed origins, and keeps credentials server-side. **CORS is not authentication**: public Workers can still be called by non-browser clients. For real public deployment, configure Cloudflare rate limiting, spend limits and abuse protection before sharing the chatbot widely. Never store keys in `script.js` or GitHub.

### Test checklist
- Open the page on mobile and desktop; quick prompts and New chat work
- Before Worker setup, sending shows a useful configuration message
- After setup, ask for a skincare routine; see a response and send a follow-up
- Try an unavailable API service; errors are visible and input is restored
- Confirm Worker secret is never visible in browser/network response or repository

## Tech
HTML, CSS, vanilla JavaScript, Cloudflare Workers, OpenAI Chat Completions API (`gpt-4.1`). No npm dependencies.


## Accessibility and quality checks
- Semantic page regions, named beauty concierge section, keyboard skip link and native button controls.
- Explicit message labels, a screen-reader response announcement and a visible error status for failed requests.
- High-contrast small text, focus-visible outlines, readable fields and larger tap/click targets.
- Motion pause control, `prefers-reduced-motion` support and keyboard-safe scroll reveals.
- Pull requests run `.github/workflows/accessibility.yml`, which reports a Lighthouse Accessibility score from a local static server and uploads the JSON report.

**Important:** An automated Lighthouse score (including 100/100) is not proof of full WCAG compliance. Manually verify a keyboard-only chat, 200–400% zoom, screen-reader announcements, category shortcuts and the pause-motion behavior on desktop and mobile.

## Design credits
The hero and all four category product illustrations are original inline SVG artwork built for this student concept. The hero is a fictional beauty product still life rather than a photograph of a real model or a genuine product packshot. No third-party stock photo or model likeness is used in the page.

**This is an independent educational concept, not affiliated with or endorsed by L'Oréal.** Verify product recommendations through official product listings.
