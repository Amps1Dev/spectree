'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Cpu,
  FileText,
  Github,
  MessageSquare,
  Radar,
  ScanLine,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const INTRO_STORAGE_KEY = 'spectre-intro-seen';
const BOOT_LINES = [
  '> initialising SPECTRE…',
  '> loading modules: nmap, nikto…',
  '> LLM agent online',
  '> ready.',
];

type IntroPhase = 'checking' | 'boot' | 'wordmark' | 'content';

const workflow = [
  {
    icon: MessageSquare,
    title: 'Chat or command',
    text: 'Describe the authorised target and the security objective in plain language.',
  },
  {
    icon: Bot,
    title: 'Agent selects tools',
    text: 'The LLM plans the task and chooses the appropriate reconnaissance workflow.',
  },
  {
    icon: Radar,
    title: 'Scan and parse',
    text: 'SPECTRE runs nmap or Nikto and turns raw output into structured findings.',
  },
  {
    icon: FileText,
    title: 'Generate report',
    text: 'Evidence is grouped by target and severity into a professional assessment report.',
  },
];

const stack = [
  'Next.js',
  'TypeScript',
  'Node.js',
  'LangGraph',
  'Groq · openai/gpt-oss-20b',
  'Kali Linux tools',
];

export default function AboutPage() {
  const [phase, setPhase] = useState<IntroPhase>('checking');
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const timerRef = useRef<number>();
  const finishedRef = useRef(false);

  const finishIntro = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } catch {
      // The intro still completes if storage is unavailable.
    }
    setPhase('content');
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(INTRO_STORAGE_KEY) === 'true';
    } catch {
      // Treat unavailable storage as a new session.
    }

    if (seen || reducedMotion.matches) {
      finishIntro();
      return;
    }

    finishedRef.current = false;
    setPhase('boot');
    let lineIndex = 0;
    let characterIndex = 0;

    const typeNextCharacter = () => {
      if (finishedRef.current) return;
      const line = BOOT_LINES[lineIndex];

      if (characterIndex < line.length) {
        characterIndex += 1;
        setCurrentLine(line.slice(0, characterIndex));
        timerRef.current = window.setTimeout(typeNextCharacter, 34);
        return;
      }

      setCompletedLines((current) => [...current, line]);
      setCurrentLine('');
      lineIndex += 1;
      characterIndex = 0;

      if (lineIndex < BOOT_LINES.length) {
        timerRef.current = window.setTimeout(typeNextCharacter, 220);
        return;
      }

      setPhase('wordmark');
      timerRef.current = window.setTimeout(finishIntro, 1450);
    };

    const reduceMotion = () => {
      if (reducedMotion.matches) finishIntro();
    };
    reducedMotion.addEventListener('change', reduceMotion);
    timerRef.current = window.setTimeout(typeNextCharacter, 260);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      reducedMotion.removeEventListener('change', reduceMotion);
    };
  }, [finishIntro]);

  const contentReady = phase === 'content';

  return (
    <div className="relative min-h-full overflow-hidden bg-spectre-bg">
      {phase !== 'content' && (
        <div
          className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center bg-spectre-bg p-6"
          onClick={finishIntro}
          role="presentation"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              finishIntro();
            }}
            className="absolute right-6 top-6 rounded border border-spectre-border bg-spectre-card px-3 py-1.5 text-xs text-spectre-muted hover:border-spectre-accent hover:text-spectre-accent"
          >
            Skip
          </button>

          {(phase === 'checking' || phase === 'boot') && (
            <div className="spectre-intro-terminal w-full max-w-2xl rounded-xl border border-spectre-border bg-spectre-card p-6 font-mono shadow-2xl">
              <div className="mb-5 flex items-center gap-2 border-b border-spectre-border pb-3 text-xs text-spectre-muted">
                <Terminal size={15} className="text-spectre-accent" />
                spectre://boot
              </div>
              <div className="min-h-40 space-y-3 text-sm text-spectre-text sm:text-base">
                {completedLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {currentLine && (
                  <p>
                    {currentLine}
                    <span className="spectre-terminal-cursor" aria-hidden="true" />
                  </p>
                )}
              </div>
              <p className="mt-5 text-xs text-spectre-muted">
                Click anywhere to continue
              </p>
            </div>
          )}

          {phase === 'wordmark' && (
            <div className="spectre-wordmark-intro text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-spectre-muted">
                System ready
              </p>
              <h1 className="mt-4 text-6xl font-black tracking-[0.16em] text-spectre-text sm:text-8xl">
                SPECTRE
              </h1>
              <span className="spectre-wordmark-underline mx-auto mt-5 block h-1 rounded-full bg-spectre-accent" />
            </div>
          )}
        </div>
      )}

      <main
        className={`mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16 ${
          contentReady ? 'spectre-about-ready opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!contentReady}
      >
        <section className="spectre-about-item grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-spectre-accent/50 bg-spectre-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-spectre-accent">
              <ScanLine size={14} /> Security orchestration
            </div>
            <h1 className="text-5xl font-black tracking-[0.12em] sm:text-7xl">
              SPECTRE
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-spectre-text-secondary sm:text-2xl">
              LLM-powered penetration testing framework
            </p>
            <p className="mt-6 max-w-2xl leading-7 text-spectre-muted">
              Plan authorised assessments, run real reconnaissance tools, preserve
              evidence, and turn findings into clear reports from one focused
              workspace.
            </p>
            <Link
              href="/chat"
              className="spectre-btn-primary mt-8 inline-flex items-center gap-2"
            >
              Open Chat <ArrowRight size={17} />
            </Link>
          </div>

          <div className="spectre-card relative overflow-hidden p-7">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-spectre-accent/10" />
            <ShieldCheck size={44} className="relative text-spectre-accent" />
            <p className="relative mt-8 font-mono text-xs uppercase tracking-[0.18em] text-spectre-muted">
              Mission profile
            </p>
            <p className="relative mt-2 text-lg font-semibold">
              Observe. Understand. Report.
            </p>
            <div className="relative mt-6 grid grid-cols-3 gap-2 text-center text-xs">
              {['Recon', 'Assess', 'Explain'].map((item) => (
                <span
                  key={item}
                  className="rounded border border-spectre-border bg-spectre-surface px-2 py-3 text-spectre-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="spectre-about-item mt-20 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spectre-accent">
              About the project
            </p>
            <h2 className="mt-3 text-3xl font-bold">An agent for the full testing loop</h2>
          </div>
          <div className="space-y-5 leading-8 text-spectre-text-secondary">
            <p>
              SPECTRE is an AI-assisted penetration testing framework that helps
              security practitioners plan and execute reconnaissance and
              vulnerability scans against authorised targets.
            </p>
            <p>
              Its agent selects and runs tools such as nmap and Nikto, streams the
              real command output, and parses the evidence into structured findings
              tagged by target, service, severity, and engagement.
            </p>
            <p>
              Those findings become the source of truth for professional,
              AI-generated penetration test reports with practical remediation
              guidance—without replacing the judgement of the human operator.
            </p>
          </div>
        </section>

        <section className="spectre-about-item mt-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spectre-accent">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-bold">From intent to evidence</h2>
            </div>
            <Cpu className="hidden text-spectre-muted sm:block" size={34} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="spectre-card relative p-5">
                  <span className="absolute right-4 top-4 font-mono text-xs text-spectre-muted">
                    0{index + 1}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-spectre-accent/10 text-spectre-accent">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-spectre-muted">
                    {step.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="spectre-about-item mt-20 grid gap-6 lg:grid-cols-2">
          <div className="spectre-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spectre-accent">
              Tech stack
            </p>
            <h2 className="mt-3 text-2xl font-bold">Built for real tool execution</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {stack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-spectre-border bg-spectre-surface px-3 py-1.5 text-sm text-spectre-text-secondary"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="spectre-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spectre-accent">
              Built by
            </p>
            <h2 className="mt-3 text-2xl font-bold">Sir Amps</h2>
            <p className="mt-1 text-sm text-spectre-text-secondary">
              Mwamba Mwila · Final-year Computer Engineering student
            </p>
            <p className="mt-1 text-sm text-spectre-muted">
              DMI St. Eugene University
            </p>
            <p className="mt-5 leading-7 text-spectre-text-secondary">
              A security-focused builder exploring how AI agents can make technical
              assessment workflows more transparent, repeatable, and useful.
            </p>
            <a
              href="https://github.com/Amps1Dev"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-spectre-accent hover:text-spectre-accent-hover"
            >
              <Github size={17} /> github.com/Amps1Dev
            </a>
          </div>
        </section>

        <section className="spectre-about-item mt-12 flex flex-col items-start justify-between gap-5 rounded-xl border border-spectre-warning/60 bg-spectre-warning/10 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-spectre-warning" size={21} />
            <div>
              <h2 className="font-semibold">Authorised use only</h2>
              <p className="mt-1 text-sm text-spectre-text-secondary">
                Only scan systems you own or have explicit written permission to test.
              </p>
            </div>
          </div>
          <Link
            href="/chat"
            className="inline-flex shrink-0 items-center gap-2 font-medium text-spectre-accent hover:text-spectre-accent-hover"
          >
            Start an engagement <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    </div>
  );
}
