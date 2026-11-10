# Project 8 — Beauty Atelier (L'Oréal-inspired AI Chatbot)

A responsive student project featuring a personalized beauty chat interface for skincare, makeup, haircare and fragrance. **Independent educational demo; not affiliated with L'Oréal.**

## Features
- Luxury editorial layout with original vector still-life artwork, refined typography, accessible navigation, and responsive design
- Original dimensional SVG beauty illustrations throughout the interface, from product-category cards to concierge and quick-action icons
- Dedicated beauty concierge panel with starter prompts, subtle entrance motion, and accessible status feedback
- Safe formatting of common AI response Markdown: bold text, headings, bullet/numbered lists (no HTML injection)
- Conversation history with Cloudflare message-length protection; user messages are removed on failed attempts so retries don't duplicate them
- Cloudflare Worker securely holds the OpenAI API key; the working endpoint is already configured in `script.js`

## Local preview
Run a static server or open `index.html` in Codespaces/VS Code Live Preview. The real AI backend is still the Cloudflare Worker configured in `script.js`. Your Cloudflare `ALLOWED_ORIGIN` variable must contain the exact preview origin to allow browser requests.

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


## Design credits
The hero and all four category product illustrations are original inline SVG artwork built for this student concept. The hero is a fictional beauty product still life rather than a photograph of a real model or a genuine product packshot. No third-party stock photo or model likeness is used in the page.

**This is an independent educational concept, not affiliated with or endorsed by L'Oréal.** Verify product recommendations through official product listings.
