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
| Real product imagery | product-photography.js / routine-builder.js | Every one of the 23 catalog items shows its own packshot; missing photos show a fallback |
| Concise responses | RESOURCE_cloudflare-worker.js / script.js | Simple fragrance questions get a short response; long replies have Show full answer |
| Product controls | routine-builder.js / atelier-redesign.css | Official links and Save / Ask AI are readable and keyboard/touch accessible |

## Automated quality gates

GitHub Actions checks on the final PR:
- **Chatbot + security checks:** Node tests cover frontend-to-Worker routing, server-only OpenAI authorization, scope restriction, conversation context, errors, CSP connect-src and credential leak patterns. Run locally with: `node --test tests/chatbot-flow.test.mjs tests/routine-builder.test.mjs tests/security-boundary.test.mjs`
- **Accessibility Lighthouse audit:** reports a numerical automated Accessibility score; a 100/100 score is not proof of full WCAG conformance.
- **Final pre-submission browser smoke test:** runs actual Chrome at desktop/mobile sizes with mocked Worker replies; checks visible bubbles, form input, question preview, reset behavior, motion and unintended horizontal scrolling. It uploads desktop/mobile screenshots.
- **Beauty visual preview:** screenshots editorial/product designs at desktop and mobile widths.

## Last manual checks before submitting

1. Merge the final review PR into main, then load the live GitHub Pages URL in a private tab and hard-refresh.
2. Verify the page has the real-product photo hero, 23 catalog cards and a balanced Beauty Concierge; check for missing or broken image thumbnails.
3. Send an actual **on-topic** question, then a **follow-up** referring to an earlier skin preference.
4. Ask a simple **fragrance** question and confirm the reply is short with no more than one follow-up question. Test **Show full answer** on a longer reply. Ask an **off-topic** question and confirm the Worker returns a polite beauty-specific redirection. If the Worker still writes essays or accepts unrelated topics, deploy the latest RESOURCE_cloudflare-worker.js in Cloudflare (the GitHub merge alone does not update it).
5. Open browser DevTools → Network and ask about a L'Oréal product: confirm the browser POST targets only `loreal-beauty-advisor.elshamandy133.workers.dev`, without an Authorization header or API key. Verify the **live Cloudflare Worker** still has `OPENAI_API_KEY` configured as a secret and `ALLOWED_ORIGIN` set to the site origin; deployment is independent of GitHub.
6. Verify the desktop/mobile appearance, button focus outlines, official-product links, selected-product thumbnails and saved state after refresh. In Developer Tools, check for image 404s or blocked requests.
7. Keep the branding disclaimer that this is an **independent student project**, not an official L’Oréal website.

**Privacy/limits:** Conversation memory is in the currently open page, not persistent storage. Questions are still sent to the Cloudflare Worker and OpenAI for processing. The API key is stored only as a Cloudflare secret, not in the public repo.

**Image rights:** This is a student demo, not an official L’Oréal site. Packshots are externally hosted and remain copyrighted. Confirm permission before commercial or long-term public redistribution.
