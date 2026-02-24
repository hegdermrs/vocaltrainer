# Voice Trainer

Real-time voice analysis and training tool that runs entirely in the browser (Next.js + Web Audio API).

## Features

- **Live microphone analysis**: pitch (Hz + note name + cents), stability, volume, breathiness proxy, sustain.
- **Target Trainer**: match a target note or a simple scale with a cents tolerance slider.
- **Session summaries**: saves max sustain, average stability, and tuning accuracy (localStorage).
- **Engine presets**: Quiet room / Noisy room / Whisper / Belting presets for quick tuning.
- **Vibrato metrics**: vibrato rate (Hz) and depth (cents) shown in the stability module.

## Requirements

- **Node.js**: 18+ recommended
- **Microphone access**: the browser will prompt for permission

## Getting started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm start          # run production server
npm run lint       # eslint
npm run typecheck  # TypeScript typecheck
```

## Deployment

### Netlify

This repo includes `netlify.toml` and uses the Netlify Next.js runtime/plugin.

Typical flow:

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from Git → select repo**.
3. Netlify will read `netlify.toml` automatically. (Build command: `npx next build`.)
4. Deploys happen automatically on every push to the connected branch.

### Self-host (Node server)

```bash
npm install
npm run build
npm start
```

## Notes / troubleshooting

- If the microphone fails to start, check browser permissions and try again.
- Session summaries are stored locally in the browser (not synced across devices).

