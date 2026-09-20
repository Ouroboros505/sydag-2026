# Pitch outline

Presentations are Sunday 12:30. Assume **5 minutes and a skeptical agronomist**.
Build these slides Saturday, not Sunday morning.

## Slides

1. **The problem** — one grower, one specific pain. A name and a number beats a category.
2. **Why it's unsolved** — what people do today and why it falls short.
3. **Our approach** — one diagram. No architecture astronautics.
4. **The demo** — live, 90 seconds, rehearsed. This is the slide that wins or loses it.
5. **Does it work** — one honest validation number, plus the baseline it beats.
6. **Impact** — $/acre, bushels, gallons of water, hours saved. Show the arithmetic.
7. **What's next** — what a real deployment needs. Shows you know what you didn't build.

## Harden the demo before you rehearse it

Judges repeatedly name a stalled demo as the thing that sinks good projects. Remove every
place it can stall:

- **Pre-fill every input.** No typing on stage, no empty forms.
- **Never call a live API in the demo path.** Cache the response to disk and read that.
- **Pre-compute anything slow.** If a model takes 40 seconds to run, run it beforehand and
  load the result. Nobody is grading you on doing it live.
- **No live internet dependency.** Assume the venue wifi fails, because sometimes it does.
- **One browser tab, one window, notifications off.**

## Rules

- **Show something working inside 90 seconds.** If the demo runs long, cut features, not
  the explanation of the problem.
- Rehearse out loud at least twice. Time it.
- **Record a screen capture of the demo working** by Saturday night. If the live demo
  breaks on stage, you play the video and keep talking.
- Judges are industry. Lead with the agronomic outcome, not the model.
- State one limitation before they find it. It buys enormous credibility.

## Mentor check-in (Sat 9 AM – 1 PM)

Mandatory, and the mentors are effectively pre-judges. Walk in with:
- the problem in one sentence
- what the data actually supports
- one specific question you want their help on
