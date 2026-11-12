# Beauty Atelier — Final Submission Checklist

## Project links
- **Live site:** https://hooda133.github.io/08-prj-loreal-chatbot/
- **Repository:** https://github.com/Hooda133/08-prj-loreal-chatbot
- **Worker source:** RESOURCE_cloudflare-worker.js (Cloudflare's live deployment is updated separately)

## Assignment acceptance checklist

| Requirement | Evidence in source | Hands-on acceptance check |
| --- | --- | --- |
| L’Oréal logo and styling | index.html / style.css | Brand wordmark, monochrome theme and independent-project disclaimer visible |
| System prompt and OpenAI connection | RESOURCE_cloudflare-worker.js / script.js | Ask for L’Oréal skincare advice and confirm a contextual response |
| L’Oréal-only scope | Cloudflare Worker scope validation | Ask about an unrelated topic; expect the polite L’Oréal-focused redirection |
| Secure Worker routing | script.js uses HTTPS Worker, secret only inside Cloudflare | Inspect browser Network tab: webpage never calls api.openai.com directly |
| Context and name recall | buildContextMessages(), nameFromIntroduction() in script.js | “My name is Emma. I have oily skin. Suggest a L’Oréal routine.” Ask several more relevant questions, then ask about your earlier preferences |
| Latest user question | #questionPreview in index.html; setQuestionPreview() in script.js | Submit a question → YOU ASKED appears. Start typing another question → prior preview clears. Submit → new preview appears |
| Conversational chat bubbles | .message.user / .message.ai in style.css | User dark/right, assistant ivory/left, speaker labels and readable lists |
| Accessible controls and motion | Accessibility styles / motionToggle | Navigate with keyboard and try Pause Motion or OS reduced-motion settings |
| Error recovery | AbortController and request reset in script.js | Connection failures restore the typed question; New chat cancels a pending reply |

## Automated quality gates

GitHub Actions checks on the final PR:
- **Chatbot interaction checks:** Node tests cover the frontend, Worker integration contract, scope restriction, name retention, preview, cancellation, errors and icons. Run locally with: node --test tests/chatbot-flow.test.mjs
- **Accessibility Lighthouse audit:** reports a numerical automated Accessibility score; a 100/100 score is not proof of full WCAG conformance.
- **Final pre-submission browser smoke test:** runs actual Chrome at desktop/mobile sizes with mocked Worker replies; checks visible bubbles, form input, question preview, reset behavior, motion and unintended horizontal scrolling. It uploads desktop/mobile screenshots.
- **Beauty visual preview:** screenshots editorial/product designs at desktop and mobile widths.

## Last manual checks before submitting

1. Merge the final review PR into main, then load the live GitHub Pages URL in a private tab and hard-refresh.
2. Verify the latest page shows the updated name-aware conversation and L’Oréal-specific input instructions.
3. Send an actual **on-topic** question, then a **follow-up** referring to an earlier skin preference.
4. Send an **off-topic** question and confirm the Worker returns the polite apology/redirection. If it doesn't, the Cloudflare-deployed Worker may be older than RESOURCE_cloudflare-worker.js; update it in Cloudflare without changing the secret or origin allowlist.
5. Verify the desktop/mobile appearance at your own screen size and check browser Developer Tools for unexpected errors.
6. Keep the branding disclaimer that this is an **independent student project**, not an official L’Oréal website.

**Privacy/limits:** Conversation memory is in the currently open page, not persistent storage. Questions are still sent to the Cloudflare Worker and OpenAI for processing. The API key is stored only as a Cloudflare secret, not in the public repo.
