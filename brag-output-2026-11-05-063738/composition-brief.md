# Hyperframes Composition Brief: SPECTRE — Narrated Technical Walkthrough

## Objective
Create a 120-second, seven-scene technical walkthrough of SPECTRE for a live, user-recorded voiceover. The finished video must favor readable diagrams and accurate product UI over teaser pacing.

## Output
- Composition directory: `/home/mwamba/Documents/spectree/brag-output-2026-11-05-063738/composition/`
- Rendered video: `/home/mwamba/Documents/spectree/brag-output-2026-11-05-063738/brag.mp4`
- Format: landscape — 1920x1080 at 30 fps
- Duration: exactly 120 seconds

The user's explicit duration override supersedes the normal `/brag` 15–25 second guideline.

## Source Material
- Project root: `/home/mwamba/Documents/spectree`
- Primary files read: `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, `app/targets/page.tsx`, `app/api/engagement/route.ts`, `lib/store.ts`, `app/chat/page.tsx`, `app/api/chat/route.ts`, `components/context-panel.tsx`, `app/reports/page.tsx`, `app/api/report/route.ts`, `components/sidebar.tsx`, `lib/tools.ts`
- Product name: SPECTRE
- Repository description: `Professional LLM-powered penetration testing platform`
- Strongest grounded claim: an authorized target list becomes per-target scan findings and an engagement-scoped report in one interface
- Key real UI moments to recreate:
  - Target Management upload and Batch Preview
  - Combined Engagement Log and per-target status badges
  - AI Assistant explicit Nmap/Nikto tool-call reasoning
  - Report Generator scope selector and Generated Report
- Copy that should appear verbatim where used:
  - `Target Management`
  - `Batch Preview`
  - `Start Engagement`
  - `Combined Engagement Log`
  - `AI Assistant`
  - `Session Context`
  - `Report Generator`
  - `Generated Report`
  - `Executive Summary`
  - `Scope`
  - `Findings by Severity`
  - `Overall Recommendations`

## Accuracy Boundary
- SPECTRE implements serial multi-target/per-tool execution for Nmap and Nikto, finding parsing, JSON-backed persistence, an LLM chat route with explicit tool calls, and LLM report generation.
- SPECTRE does not currently persist or automatically execute a vulnerability-chain graph.
- Scenes 4–6 must visibly label the chain as illustrative and operator-guided.
- Solid connectors mean observed evidence. Dashed connectors mean LLM-proposed, operator-hypothesized, or unverified steps.
- Never imply that a proposed final objective was achieved without validating tool output.
- The saved engagement store is not automatically injected into chat; the operator supplies relevant context or explicitly requests a scan.
- All targets, findings, scan lines, engagement IDs, report excerpts, and hostnames are fictional stand-ins.

## Fictional Dataset
Use only:

```csv
ip,label,notes
192.0.2.10,target-a.example,Public web edge
192.0.2.20,target-b.example,Application host
192.0.2.30,target-c.example,Admin service
```

Every frame containing apparent results must include a visible but unobtrusive `FICTIONAL DEMO DATA` label.

## Creative Direction
- Tone preset: polished
- Creative direction: serious dark technical briefing
- Interpretation: controlled 2.5-second assemblies followed by long, completely static narration holds; precise diagrams; restrained typography; no hype or hacker clichés
- Angle: targets become evidence, evidence guides the next validation step, and verified findings become a report
- Hook: `TARGET LIST → AUTHORIZED SCANS → STRUCTURED FINDINGS → LLM ASSISTANCE → REPORT`
- Outro: `Evidence in. A defensible report out.`
- Avoid:
  - generic SaaS claims
  - code rain, neon blue, hooded figures, glitch spam, sirens, or fake exploitation footage
  - motion during narration holds
  - automated-chain claims not supported by the repository
  - real environment data or copied local scan results

## Visual Identity
- LOOK: dark technical operations briefing — warm charcoal canvas `#2A2320`, darker secondary plane `#352B27`, card surfaces `#3F332E`, 2px video-scale borders `#4A3D37`, cream text `#F4E4DC`, coral evidence accent `#C98D80`, amber hypothesis accent `#D6A15F`, teal verified/result accent `#7FA8A8`; Inter 700 for titles, Inter 400 for body, IBM Plex Mono 400/700 for data; no gradients except small local radial glows at 18–22% opacity; 28px minimum body text, 52–66px scene titles, 88–112px hero title
- Background: `#2A2320`
- Secondary background: `#352B27`
- Card surface: `#3F332E`
- Border: `#4A3D37`
- Text: `#F4E4DC`
- Muted text: `#D9C4B5` for readable secondary copy; reserve `#9C8278` for large labels only
- Accent: `#C98D80`
- High severity: `#E57368`
- Medium / proposed: `#D6A15F`
- Low / verified result: `#7FA8A8`
- Display font: Inter 700/900
- Body font: Inter 400/700
- Data font: IBM Plex Mono 400/700
- Visual references from the project: warm dark theme, SPECTRE coral wordmark, navigation rail, bordered batch table, mono terminal output, status/severity badges, report panels

## Timing Contract
Use one linked sub-composition per scene. The root duration is exactly 120 seconds.

| Scene | Root start | Duration | Animate in | Static hold | Transition |
|---|---:|---:|---:|---:|---:|
| 1 | 0.0s | 17.0s | 0.0–2.5 | 2.5–16.3 | 16.3–17.0 |
| 2 | 17.0s | 17.0s | 0.0–2.5 | 2.5–16.3 | 16.3–17.0 |
| 3 | 34.0s | 17.0s | 0.0–2.5 | 2.5–16.3 | 16.3–17.0 |
| 4 | 51.0s | 17.0s | 0.0–2.5 | 2.5–16.3 | 16.3–17.0 |
| 5 | 68.0s | 17.0s | 0.0–2.5 | 2.5–16.3 | 16.3–17.0 |
| 6 | 85.0s | 17.0s | 0.0–2.5 | 2.5–16.3 | 16.3–17.0 |
| 7 | 102.0s | 18.0s | 0.0–2.5 | 2.5–18.0 | none |

Each scene must contain a full-frame `data-hold` element spanning its narration hold. Once the scene reaches 2.5 seconds, no visual property changes until the outgoing transition begins. No cursor blink, pulse, grain movement, terminal scroll, camera drift, or looping decoration.

## Storyboard
Use `/home/mwamba/Documents/spectree/brag-output-2026-11-05-063738/brag-plan.md` as the creative contract.

Scene summary:
1. **What SPECTRE is** — 17s — five-node system diagram and one-line definition.
2. **Multi-target input** — 17s — fictional CSV, Batch Preview, and serial queue diagram.
3. **Recon and findings** — 17s — Nmap/Nikto execution, fictional output, structured evidence card.
4. **Chaining part 1** — 17s — observed finding → explicit operator request → returned follow-up evidence.
5. **Chaining part 2** — 17s — complete observed/proposed graph from initial exposure to illustrative objective.
6. **The LLM's role** — 17s — context + verified output → interpretation, next-step recommendation, explicit tool call.
7. **The result** — 18s — engagement-scoped Generated Report with severity/target structure and export actions.

## Audio
- Audio role: sparse professional entry/transition accents that leave the narration holds empty
- Audio arc: one low warm cue during each 2.5-second assembly, optional tiny transition cue at each seam, silence throughout every hold
- Music: none (`--no-music`)
- Generated narration: none; the user will record their own voiceover live
- Music cue guidance: not applicable
- Audio-reactive treatment: none
- Audio-coupled moments:
  - Scene 1 system diagram — one low reveal cue
  - Scenes 2–6 assembly — one or two low-risk placement cues only
  - Scene 7 report completion — one soft confirmation cue before the final hold
- SFX selection guidance: use only warm low-HF-risk bundled SFX, such as `impactSoft_medium` and `interface/bong`; keep peaks low and never repeat under the hold
- SFX analysis guidance: `/home/mwamba/.codex/plugins/cache/brag/brag/0.5.0/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: choose after the visual pass, with no more than 10–12 brief sounds across the entire 120 seconds
- Audio files: copy only chosen SFX into `composition/assets/sfx/`

## Hyperframes Instructions
- Scaffold a blank landscape project using Hyperframes 0.9.14 and keep all runtime assets local.
- Use current Hyperframes composition conventions: root `index.html`, one scene per file in `compositions/`, deterministic paused GSAP timelines, unique IDs, `class="clip"` timing, title-safe layout, and local asset paths.
- Search the registry before hand-building diagrams or UI primitives. Suitable references may include `flowchart`, `constellation-hub`, `grid-card-assemble`, and `titlecard-lockup`; adapt only if their mechanics fit the strict static-hold requirement and SPECTRE brand.
- Prioritize actual SPECTRE UI language and structure over generic registry styling.
- Mark intentional holds with `data-hold`; craft warnings about dead stretches should recognize the holds as deliberate.
- Mark decorative full-bleed layers with the narrowest appropriate layout exemption.
- Keep all readable body text at least 28px at 1080p; titles at least 52px.
- Use motion sidecars to assert that each title appears by 1.0s, the primary diagram/panel appears by 2.4s, and all primary elements remain in-frame.
- Run `npx hyperframes@0.9.14 lint` after the first pass.
- Run `npx hyperframes@0.9.14 check --json --snapshots --samples 21 --at-transitions` as the final gate and fix every error.
- Capture and inspect settled frames at approximately 8.5, 25.5, 42.5, 59.5, 76.5, 93.5, and 111 seconds.
- Start the HyperFrames desktop-app preview before delivery rendering and verify the project URL answers successfully.
- Render locally with delivery quality to `../brag.mp4` only after the check passes.

## Delivery Expectations
- `brag.mp4`: 1920x1080, 30 fps, 120.0 seconds, H.264/AAC if SFX are retained
- `brag.jpg`: strongest settled frame, likely Scene 5's complete chain graph or Scene 7's report frame
- Bake the chosen poster into frame 0 of the MP4
- `share-copy.txt`: one short project-specific caption, noting this is a two-minute walkthrough

