# Buy or Bye

**Think before you spend.**

Live demo: [buyorbye.compare](https://buyorbye.compare)

## The problem

Most budgeting apps are reactive. They tell you where your money went *after* you've already spent it — you look at your budget at the end of the month and realize you spent way too much on clothes, but by then the decision that caused it is long gone. These tools build awareness, but they don't help you *implement change*, and there's almost no guidance in the actual moment of decision — when you're standing in a store, or looking at something online, asking yourself *should I actually buy this?*

That's the gap Buy or Bye is built to close: helping people make better decisions **before** the money is gone, not just understand it after.

## The solution

Buy or Bye acts like a quick, judgment-free purchasing consultant.

When you find something you want to buy, you describe it (or snap a photo). The app identifies what it is, checks it against your usual spending and your budget for that category, shows a few comparable alternatives, and asks one simple question: **do you really need this?**

- **Yes** → go straight to buying it.
- **Not sure / no** → the item is saved so you can come back to it later, instead of deciding under pressure in either direction.

Budgets are set the same way — a short back-and-forth conversation, category by category ("how much do you usually spend on dining each month?"), instead of a blank form asking for a number you don't actually know.

## Why this builds financial literacy, not just decisions

> **Awareness is the method. Habit is the mechanism. Financial literacy is the result.**

The pause before a purchase *is* the awareness. Repeating that pause every time someone shops turns it into a habit. Financial literacy is what grows out of that repeated habit — not from reading about budgeting, but from practicing small financial decisions in the moments they actually happen.

## How it works

- **Buy or Bye (Decide screen)** — describe or photograph an item; Gemini classifies it, matches it to your real budget category, surfaces live alternatives via SerpAPI, and asks a short reflective question before you decide.
- **Monthly budget** — an AI-guided setup conversation builds your budget category by category instead of defaulting to arbitrary numbers.
- **Expenses tracker** — a live, editable ledger showing what's been spent and how much of each category's budget remains, plus a conversational "log with assistant" flow for hands-free entry.
- **Purchase Pal** — an ongoing chat that weighs a potential purchase against your budget and recent spending, with photo support.

## Tools & tech

**AI / sponsor tools**
- [Gemini](https://ai.google.dev/) — item classification, budget-setup questions, nudge questions, and chat, via `gemini-3.6-flash`
- [Backboard](https://backboard.io/) — automatic fallback when Gemini is unavailable, plus persistent memory across conversations
- [Tiger Data](https://www.tigerdata.com/) (Timescale/Postgres) — stores Decide-screen purchase decisions
- [Vultr](https://www.vultr.com/) — hosts the live deployment

**Data & auth**
- [Supabase](https://supabase.com/) (via Lovable Cloud) — Google OAuth and the Postgres database backing budgets, categories, transactions, and chat history
- [SerpAPI](https://serpapi.com/) — real-time product search for purchase alternatives

**Frontend**
- [TanStack Start](https://tanstack.com/start) (React, SSR) + TypeScript
- Tailwind CSS, Radix UI
- Framer Motion, TanStack Query

**Backend**
- Node.js + Express
- `pg` (node-postgres) for the Tiger Data connection

The AI side isn't just "add a model" — each tool has a specific job in the purchasing flow, layered on top of a structured budgeting system underneath.

## Problems we ran into

**A chat feature that only worked inside its own website.** Purchase Pal and the tracker's logging assistant were originally built against Lovable's AI gateway, which needs a secret key that Lovable only injects into apps hosted on its own platform — it can't be obtained for local dev or any other host. Both got migrated to the same Gemini+Backboard pipeline as the rest of the app, including swapping out streaming chat for plain request/response and inventing a structured-output convention (`LOG_TRANSACTION: {...}`) to replace tool-calling that Gemini/Backboard don't support natively.

**Two data stores that never met.** Purchase decisions from the Decide screen were saved to Tiger Data, but the budget and tracker screens read spending from Supabase — so a "bought" decision never actually moved your budget-remaining number. Fixed by mirroring bought decisions into both.

**A silent deployment killer.** The frontend's build config secretly defaulted to targeting Cloudflare Workers instead of a real Node server, since that's how Lovable itself hosts the app. The built server exited immediately with zero output under plain Node — no error to follow, just silence, until we traced it back to that one config default.

## Development

You need Node.js. The app is two separate projects that run side by side:

```sh
git clone https://github.com/JadeJaguar/JackRice16.git
cd JackRice16

# Frontend
npm install
npm run dev          # http://localhost:8080

# Backend (separate terminal)
cd HackRice16
npm install
node server.js        # http://localhost:3000
```

Both need their own `.env` — see `HackRice16/.env.example` for the backend's required keys (Gemini, Backboard, SerpAPI, Tiger Data, Supabase). The frontend needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_URL` pointing at wherever the backend is running.

## What's next

- **Expand the budget taxonomy** — currently 6 categories; the full taxonomy behind the scenes covers 21 categories and dozens of subcategories, for much more personalized goals
- **Speech-to-text** — since the whole philosophy is a conversation with your financial assistant, being able to just talk to it is a natural extension
- **Receipt scanning** — image-to-text recognition to auto-document and categorize expenses instead of manual entry

All in service of the same goal: making financial awareness something that fits naturally into everyday life, not another task to remember.
