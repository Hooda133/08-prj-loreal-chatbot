# Project 8 — Beauty Atelier (L'Oréal-inspired AI Chatbot)

A responsive student project featuring a personalized beauty chat interface for skincare, makeup, haircare and fragrance. **Independent educational demo; not affiliated with L'Oréal.**

## Features
- Premium editorial styling, responsive layout, quick prompts and new chat
- Conversation history sent to the AI (last 12 messages)
- Safe DOM rendering, error feedback, and loading states
- Cloudflare Worker proxy keeps the OpenAI API key off the public website
- Beauty-focused system instructions that avoid inventing unverified product facts

## Local preview
Open `index.html` with a local preview extension, or in GitHub Codespaces. You can explore the interface immediately; AI replies require the Worker.

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
