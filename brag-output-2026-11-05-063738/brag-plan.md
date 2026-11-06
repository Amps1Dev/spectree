# Brag Plan: SPECTRE — Narrated Technical Walkthrough

## What is this app?
SPECTRE is an LLM-powered penetration-testing workspace that runs authorized Nmap and Nikto scans, saves structured findings by engagement and target, helps an operator interpret results, and generates a scoped Markdown report.

## The angle
This is a calm, evidence-first walkthrough rather than a launch teaser. Seven self-contained technical plates explain the workflow from a target file to a finished report. Each plate assembles quickly, then becomes completely still for live narration.

The visual thesis is: **targets become evidence; evidence guides the next test; verified findings become a report.**

## Accuracy boundary

- The current repository implements multi-target batches, serial per-target/per-tool execution, Nmap and Nikto output parsing, stored findings, LLM chat with explicit Nmap/Nikto tool calls, and LLM report writing.
- It does **not** currently implement a persisted vulnerability-chain model, an automatic chain planner, or a chain-graph UI.
- Scenes 4–6 therefore show an **illustrative, operator-guided reasoning chain**, not an autonomous exploitation trace. The graph will visibly distinguish observed evidence from proposed or unverified steps.
- The chat assistant is not automatically populated with saved engagement findings. The operator supplies the relevant context or explicitly requests a tool run.
- Every target, hostname, scan line, finding, engagement identifier, and report excerpt in the video is a fictional stand-in. No local or real engagement data will be used.

## Planning rubric

1. **What is the app?** An authorized scanning, interpretation, and reporting workspace built around Nmap, Nikto, Groq, and structured engagement storage.
2. **Most impressive claim:** A target list can become per-target findings and a scoped penetration-test report in one interface.
3. **Visual hook:** The dark SPECTRE interface with a batch target table, combined terminal log, evidence cards, and severity-coded report.
4. **Actual UI to show:** Target Management, AI Assistant/tool invocation, and Report Generator.
5. **Shortest satisfying video:** 120 seconds, explicitly overriding the normal `/brag` 15–25 second limit to support live narration.
6. **Tone:** Polished preset, refined as a serious dark technical briefing.
7. **Audio:** No music and no generated narration. Optional entry/transition sounds only; complete silence during holds.
8. **Share caption:** A two-minute walkthrough of how SPECTRE turns an authorized target batch into structured findings, guided follow-up, and a scoped report.
9. **User flow:** Upload targets → run selected scanners serially and save findings → interpret evidence and choose follow-up → generate a report for one engagement or all findings.

## Hook
The SPECTRE wordmark and a single system diagram assemble over the real dark palette: `TARGETS → SCANS → FINDINGS → LLM → REPORT`. The final headline holds: **“Authorized testing, from target list to report.”**

## Key moments

- A real `ip,label,notes` target-file format becomes a parsed batch with Pending, Scanning, Complete, and Failed states.
- Nmap and Nikto findings are shown as structured evidence: target, severity, service/port, description, remediation, and source tool.
- A finding is carried forward into an explicit follow-up request, then mapped into an illustrative attack-path graph with observed versus proposed edges.
- The final report is scoped by engagement and organized into Executive Summary, Scope, Findings by Severity, and Overall Recommendations.

## Outro
The seven-step story resolves to one frozen report frame with the line: **“Evidence in. A defensible report out.”**

## User flow worth showing
Upload a `.txt` or `.csv` target list → choose Nmap and/or Nikto and start the engagement → watch targets run serially while findings are saved → use the assistant to interpret evidence or explicitly run a follow-up tool → generate, copy, or download a report scoped to the engagement.

## Tone

- Preset: polished
- Creative direction: serious dark technical briefing
- Interpretation: precise diagrams, restrained typography, no hype language, no ambient motion, and long static frames designed for explanation.

## Format: landscape — 1920x1080
## Duration: 120 seconds

This duration intentionally overrides the normal `/brag` 15–25 second guidance.

## Timing contract

Scenes 1–6 are 17.0 seconds each; Scene 7 is 18.0 seconds. Total: **120.0 seconds**.

| Scene | Animate in | Completely still hold | Transition | Total |
|---|---:|---:|---:|---:|
| 1 | 2.5s | 13.8s | 0.7s | 17.0s |
| 2 | 2.5s | 13.8s | 0.7s | 17.0s |
| 3 | 2.5s | 13.8s | 0.7s | 17.0s |
| 4 | 2.5s | 13.8s | 0.7s | 17.0s |
| 5 | 2.5s | 13.8s | 0.7s | 17.0s |
| 6 | 2.5s | 13.8s | 0.7s | 17.0s |
| 7 | 2.5s | 15.5s | — | 18.0s |
| **Total** | **17.5s** | **98.3s** | **4.2s** | **120.0s** |

During every hold: no blinking cursor, pulsing status light, moving grain, scrolling terminal, floating particles, animated diagram edges, tickers, counters, or camera drift.

## Visual identity from the repository

- Background: `#2A2320`
- Secondary background: `#352B27`
- Card surface: `#3F332E`
- Border: `#4A3D37`
- Accent: `#C98D80`
- Primary text: `#F4E4DC`
- Secondary text: `#D9C4B5`
- Muted text: `#9C8278`
- High severity: `#E57368`
- Medium severity: `#D6A15F`
- Low severity / success: `#7FA8A8`
- Display/body font: system UI / Segoe UI
- Data font: SFMono-Regular / Menlo / Monaco / Consolas
- Strongest visual element: the Target Management batch table and combined engagement log, followed by the severity-grouped Generated Report.

## Fictional demonstration dataset

The target file shown on screen will be:

```csv
ip,label,notes
192.0.2.10,target-a.example,Public web edge
192.0.2.20,target-b.example,Application host
192.0.2.30,target-c.example,Admin service
```

All apparent results are explicitly marked `FICTIONAL DEMO DATA`. Documentation-range addresses and `.example` hostnames are used throughout.

## Audio direction

- Role: leave space for the operator's live narration.
- Music: none (`--no-music`).
- Generated voiceover: none; the user will record live narration.
- Music treatment: not applicable.
- Music cue guidance: not applicable.
- Audio-reactive treatment: none.
- SFX posture: extremely sparse; one subdued entry cue and one short transition cue are permissible, mixed low.
- Audio-coupled moments: initial diagram assembly and scene cuts only.
- Hold rule: absolute silence during all static narration holds.
- Restraint rule: no alarms, hacker effects, terminal typing loops, drones, impacts under speech, or recurring UI sounds.

## Storyboard

### Scene 1 — What SPECTRE is — 17.0s

**Timing:** 0.0–2.5s animate in; 2.5–16.3s still hold; 16.3–17.0s crossfade.

The SPECTRE name resolves above a compact five-node system diagram:

`TARGET LIST → AUTHORIZED SCANS → STRUCTURED FINDINGS → LLM ASSISTANCE → REPORT`

Large title: **“Authorized testing, from target list to report.”**

Small qualifier: `Nmap + Nikto • Groq-assisted interpretation • engagement-scoped reporting`

The finished frame uses generous empty space and no dashboard clutter.

**Suggested talking points:**

- SPECTRE is a penetration-testing workspace, not a scanner replacement.
- It coordinates authorized targets, tool execution, evidence, interpretation, and reporting.
- The current implementation uses Nmap and Nikto in batch engagements, with Groq assisting in chat and report drafting.
- Network actions can be disabled with the application's offline mode.

Sequential/interaction: five nodes draw in left to right, then freeze.

Audio intent: one restrained system-on cue, then silence.

Transition: 0.7s soft crossfade → Scene 2.

### Scene 2 — Multi-target input and queue — 17.0s

**Timing:** 0.0–2.5s animate in; 2.5–16.3s still hold; 16.3–17.0s crossfade.

Title: **“One file becomes a controlled batch.”**

Left panel: the fictional `targets.csv` shown above, with the accepted schema highlighted:

`ip, label, notes`

Right panel: a recreation of SPECTRE's **Batch Preview** with three rows and statuses set to `Pending`. A small queue diagram below it reads:

`Target 1: Nmap → Nikto`  
`Target 2: Nmap → Nikto`  
`Target 3: Nmap → Nikto`

Footer facts: `.txt or .csv` • `blank/comment lines ignored` • `up to 500 targets` • `serial target/tool execution`

**Suggested talking points:**

- SPECTRE accepts plain text or CSV; each row begins with an IP or hostname, with optional label and notes.
- A first-row header such as `ip`, `target`, `hostname`, or `host` is recognized and skipped.
- The batch preview lets the operator confirm parsed targets and choose Nmap, Nikto, or both.
- The API caps a batch at 500 targets and processes targets, then selected tools, in deterministic serial order.
- Progress is streamed back as newline-delimited JSON events.

Sequential/interaction: file appears, three rows populate, queue arrows draw, then everything freezes.

Audio intent: three quiet placement ticks during assembly only.

Transition: 0.7s clean slide/crossfade → Scene 3.

### Scene 3 — Recon and structured findings — 17.0s

**Timing:** 0.0–2.5s animate in; 2.5–16.3s still hold; 16.3–17.0s crossfade.

Title: **“Each target produces evidence, not just output.”**

The frame has three fixed columns:

1. **Execution** — `target-a.example` with Nmap Service followed by Nikto.
2. **Fictional output** — short stand-in lines such as `80/tcp open http` and `443/tcp open https`, visibly marked `FICTIONAL DEMO DATA`.
3. **Saved finding** — a structured card with fields: `Target`, `Severity`, `Service / Port`, `Description`, `Remediation`, `Tool`.

A small state rail shows: `Pending → Scanning → Complete · 3 findings`.

**Suggested talking points:**

- Nmap uses the Service profile in batch engagements; Nikto runs against the same selected target when enabled.
- Raw output is streamed live, then parsed into individual findings.
- Nmap open-port lines become service/port findings with rule-based severity and remediation.
- Nikto result lines become HTTP findings, with severity inferred from terms such as outdated version, injection, or code execution.
- Scans, findings, engagement IDs, and timestamps are persisted in SPECTRE's JSON-backed store.

Sequential/interaction: tool stages and evidence card assemble in order, then freeze.

Audio intent: two soft tool-stage cues and one evidence-lock cue, then silence.

Transition: 0.7s hard-clean evidence cut → Scene 4.

### Scene 4 — Vulnerability chaining, part 1 — 17.0s

**Timing:** 0.0–2.5s animate in; 2.5–16.3s still hold; 16.3–17.0s crossfade.

Title: **“A finding becomes the next question.”**

A three-step horizontal reasoning plate:

1. **Observed finding**  
   `192.0.2.10 • 80/tcp • HTTP service exposed`
2. **Operator-guided next step**  
   `Ask SPECTRE to run Nikto and prioritize the web exposure.`
3. **Follow-up evidence**  
   `Outdated server banner` + `missing security header` — both labeled fictional.

The central arrow is labeled: `explicit request → tool call → returned output`.

Bottom accuracy note: **“SPECTRE proposes and interprets follow-up work; it does not silently exploit or invent results.”**

**Suggested talking points:**

- Chaining begins by carrying a verified observation into a narrower follow-up question.
- In the current implementation, the operator explicitly requests the next scan in chat.
- The LLM may choose the `run_nmap` or `run_nikto` function, but the actual tool output is returned before the model interprets it.
- This keeps observed evidence separate from model suggestions.
- The example is fictional and demonstrates the reasoning pattern, not an actual compromise.

Sequential/interaction: the finding card, explicit request, and follow-up evidence appear in sequence, then freeze.

Audio intent: one cue per reasoning step, then silence.

Transition: 0.7s graph-expansion crossfade → Scene 5.

### Scene 5 — Vulnerability chaining, part 2 — 17.0s

**Timing:** 0.0–2.5s animate in; 2.5–16.3s still hold; 16.3–17.0s crossfade.

Title: **“From first exposure to an objective.”**

The whole frame is a labeled graph titled **“Illustrative reasoning graph — not an automated exploit trace.”**

Nodes:

`Public HTTP service` → `Version disclosure` → `Outdated component suspected` ⇢ `Admin surface to validate` ⇢ `Potential privileged application access`

Legend:

- Solid coral node/edge: `Observed evidence`
- Dashed amber node/edge: `LLM-proposed or unverified step`
- Teal terminal node: `Illustrative objective`

Each node carries a tiny source label such as `Nmap`, `Nikto`, `operator hypothesis`, or `requires validation`.

**Suggested talking points:**

- A chain is useful because it preserves why one test follows another.
- The early nodes are grounded in tool evidence; later nodes remain hypotheses until validated.
- The graph prevents a model suggestion from being mistaken for a confirmed finding.
- SPECTRE does not currently save this graph as a first-class object; this plate explains the intended operator reasoning over the evidence already stored.
- The final objective is illustrative and is never presented as achieved without validating output.

Sequential/interaction: nodes and labeled edges draw left to right, legend arrives, then freeze completely.

Audio intent: muted graph-node cues during construction only.

Transition: 0.7s clean wipe → Scene 6.

### Scene 6 — The LLM's role — 17.0s

**Timing:** 0.0–2.5s animate in; 2.5–16.3s still hold; 16.3–17.0s crossfade.

Title: **“Reason over evidence. Invoke tools explicitly.”**

Central decision diagram:

`Operator context` + `verified tool result` → `Groq model` → three outputs:

- `Interpret the finding`
- `Recommend the next validation step`
- `Call Nmap or Nikto when explicitly requested`

A guardrail strip below reads:

`No tool result → no claim that a tool ran`  
`Suggestion ≠ confirmed finding`  
`Returned output feeds the final answer`

Small implementation note: `openai/gpt-oss-20b • temperature 0.2 planning / 0.4 response`

**Suggested talking points:**

- The assistant's system instruction is to enumerate authorized targets, interpret real results, identify vulnerabilities, and plan remediation.
- Tool choice is available, but scans are only requested through explicit operator intent.
- The route performs a planning call, executes requested tools, and sends tool results back for the streamed final response.
- Chaining works when each next step is conditioned on verified output, reducing blind enumeration.
- Saved findings are not automatically injected into chat today; the operator supplies the relevant engagement context.

Sequential/interaction: inputs, model core, outputs, and guardrails arrive in four steps, then freeze.

Audio intent: one low decision cue, then silence.

Transition: 0.7s slow crossfade → Scene 7.

### Scene 7 — The result — 18.0s

**Timing:** 0.0–2.5s animate in; 2.5–18.0s still hold.

Title: **“Evidence in. A defensible report out.”**

Left rail: engagement scope selector with `target-a.example +2 · 7 findings` as fictional stand-in data.

Main panel: a readable recreation of **Generated Report** with the exact major sections requested by the report API:

1. `Executive Summary`
2. `Scope`
3. `Findings by Severity`
4. `Overall Recommendations`

A compact severity/target matrix shows HIGH, MEDIUM, LOW, and INFO grouped by target. The top-right actions read `Copy to Clipboard` and `Download as .txt`.

Footer: **“One engagement or all saved findings.”**

**Suggested talking points:**

- The operator can scope a report to one engagement or all saved findings.
- Before calling the LLM, SPECTRE groups findings by severity and target and passes structured evidence to the report writer.
- The prompt requires every tested target, affected service or port, description, and concrete remediation.
- The report writer is instructed not to invent findings or claim testing beyond the supplied data.
- The finished Markdown report can be copied or downloaded as a text file.

Sequential/interaction: scope selector, report frame, four section labels, and export actions assemble, then hold for the remainder of the video.

Audio intent: one quiet report-complete cue at 2.4s, then silence through 120.0s.

## Share copy draft
A two-minute walkthrough of SPECTRE: multi-target authorized scanning, structured findings, operator-guided follow-up, and evidence-scoped reporting.

## Approval gate

Do not create the Hyperframes composition, preview, or render until the user approves this plan. On approval, carry the timing contract and accuracy boundary into the composition brief unchanged.

