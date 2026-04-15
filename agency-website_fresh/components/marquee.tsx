"use client";

import Link from "next/link";
import * as React from "react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SCRAMBLE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function scrambleTo(text: string, revealCount: number) {
	const out: string[] = [];
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (i < revealCount || ch === " ") {
			out.push(ch);
			continue;
		}
		out.push(SCRAMBLE_ALPHABET[Math.floor(Math.random() * SCRAMBLE_ALPHABET.length)]);
	}
	return out.join("");
}

function ScrambleText({
	text,
	className,
}: {
	text: string;
	className?: string;
}) {
	const [display, setDisplay] = React.useState(text);
	const runningRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		return () => {
			if (runningRef.current) window.clearInterval(runningRef.current);
		};
	}, []);

	function onHover() {
		if (runningRef.current) window.clearInterval(runningRef.current);
		let step = 0;
		const maxSteps = Math.max(12, text.length * 2);

		runningRef.current = window.setInterval(() => {
			step += 1;
			const reveal = Math.floor((step / maxSteps) * text.length);
			setDisplay(scrambleTo(text, reveal));

			if (step >= maxSteps) {
				if (runningRef.current) window.clearInterval(runningRef.current);
				runningRef.current = null;
				setDisplay(text);
			}
		}, 24);
	}

	return (
		<span className={cn("font-mono", className)} onMouseEnter={onHover}>
			{display}
		</span>
	);
}

function usePointerParallax(containerRef: React.RefObject<HTMLElement | null>) {
	React.useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let targetX = 0;
		let targetY = 0;
		let raf = 0;

		const onMove = (e: PointerEvent) => {
			const nx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
			const ny = e.clientY / Math.max(1, window.innerHeight) - 0.5;
			targetX = nx * 28;
			targetY = ny * 28;

			if (raf) return;
			raf = window.requestAnimationFrame(() => {
				raf = 0;
				el.style.setProperty("--parallax-x", `${targetX.toFixed(2)}px`);
				el.style.setProperty("--parallax-y", `${targetY.toFixed(2)}px`);
			});
		};

		window.addEventListener("pointermove", onMove, { passive: true });
		return () => {
			window.removeEventListener("pointermove", onMove);
			if (raf) window.cancelAnimationFrame(raf);
		};
	}, [containerRef]);
}

function RevolvingRing({
	size,
	characters,
	durationSeconds,
	direction,
	className,
}: {
	size: number;
	characters: string;
	durationSeconds: number;
	direction: "normal" | "reverse";
	className?: string;
}) {
	const radius = size / 2;
	const glyphs = React.useMemo(() => {
		const count = Math.max(48, characters.length * 6);
		return Array.from({ length: count }, (_, i) => characters[i % characters.length]);
	}, [characters]);

	return (
		<div
			className={cn(
				"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
				"animate-spin",
				className,
			)}
			style={{
				width: size,
				height: size,
				animationDuration: `${durationSeconds}s`,
				animationDirection: direction,
			}}
			aria-hidden
		>
			{glyphs.map((ch, i) => {
				const angle = (i / glyphs.length) * 360;
				return (
					<span
						key={i}
						className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-foreground/12"
						style={{
							transform: `rotate(${angle}deg) translateY(-${radius}px) rotate(${-angle}deg)`,
						}}
					>
						{ch}
					</span>
				);
			})}
		</div>
	);
}

function CryptoBackdrop() {
	const ref = React.useRef<HTMLDivElement | null>(null);
	usePointerParallax(ref);

	return (
		<div
			ref={ref}
			className="pointer-events-none absolute inset-0 overflow-hidden"
			style={{
				transform: "translate3d(var(--parallax-x, 0px), var(--parallax-y, 0px), 0)",
			}}
			aria-hidden
		>
			<div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" />

			<RevolvingRing
				size={520}
				characters="0123456789ABCDEF"
				durationSeconds={28}
				direction="normal"
				className="opacity-80"
			/>
			<RevolvingRing
				size={760}
				characters="01A9F3C7D5E8B2"
				durationSeconds={44}
				direction="reverse"
				className="opacity-60"
			/>
			<RevolvingRing
				size={1040}
				characters="0123456789"
				durationSeconds={68}
				direction="normal"
				className="opacity-40"
			/>

			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_35%,hsl(var(--background))_70%)]" />
		</div>
	);
}

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => setMounted(true), []);

	if (!mounted) {
		return (
			<Button variant="ghost" className="text-muted-foreground hover:text-foreground" disabled>
				<span className="font-mono text-xs">THEME</span>
			</Button>
		);
	}

	const isDark = resolvedTheme === "dark";
	const nextTheme = isDark ? "light" : "dark";

	return (
		<Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setTheme(nextTheme)}>
			<ScrambleText text={isDark ? "DARK" : "LIGHT"} />
		</Button>
	);
}

export default function Marquee() {
	return (
		<main className="relative min-h-screen overflow-hidden">
			<CryptoBackdrop />

			<div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8">
				<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<Link href="/" className="flex items-center gap-3">
						<div className="bg-foreground/10 text-foreground inline-flex size-10 items-center justify-center rounded-lg border">
							<span className="font-mono text-xs">01</span>
						</div>
						<div className="flex flex-col">
							<div className="text-sm font-semibold tracking-tight">Agency</div>
							<div className="text-muted-foreground text-xs">Cryptographic template</div>
						</div>
					</Link>

					<nav className="flex flex-wrap items-center gap-4">
						<Link href="#services" className="text-muted-foreground hover:text-foreground text-sm">
							<ScrambleText text="SERVICES" />
						</Link>
						<Link href="#work" className="text-muted-foreground hover:text-foreground text-sm">
							<ScrambleText text="WORK" />
						</Link>
						<Link href="#process" className="text-muted-foreground hover:text-foreground text-sm">
							<ScrambleText text="PROCESS" />
						</Link>
						<ThemeToggle />
					</nav>
				</header>

				<section className="flex flex-col gap-6 pt-6">
					<Badge variant="secondary" className="w-fit">
						<ScrambleText text="SECURE • FAST • CLEAN" className="text-[11px]" />
					</Badge>

					<div className="flex flex-col gap-4">
						<h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
							<ScrambleText text="CRYPTOGRAPHIC" className="text-foreground" />
							<span className="block text-muted-foreground">motion-first agency template.</span>
						</h1>
						<p className="text-muted-foreground max-w-2xl text-lg">
							Revolving numeric backdrops, pointer-driven motion, and hover scramble text effects—spread across the page.
						</p>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row">
						<Button size="lg" className="font-mono">
							<ScrambleText text="GET_STARTED" />
						</Button>
						<Button size="lg" variant="outline" className="font-mono">
							<ScrambleText text="VIEW_WORK" />
						</Button>
					</div>
				</section>

				<Separator className="bg-border/60" />

				<section id="services" className="grid gap-4 md:grid-cols-3">
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="BRANDING" />
							</CardTitle>
							<CardDescription>Identity systems that feel inevitable.</CardDescription>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm">
							Strategy, typography, and motion tokens designed for dark and light contexts.
						</CardContent>
					</Card>
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="WEB" />
							</CardTitle>
							<CardDescription>App-router, component-first builds.</CardDescription>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm">
							Tailwind + shadcn primitives with interactive micro-effects.
						</CardContent>
					</Card>
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="SYSTEMS" />
							</CardTitle>
							<CardDescription>Design systems with real constraints.</CardDescription>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm">
							Tokens, variants, and accessible motion that stays performant.
						</CardContent>
					</Card>
				</section>

				<section id="work" className="grid gap-4 md:grid-cols-2">
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="CASE_STUDY_01" />
							</CardTitle>
							<CardDescription>Hover text scrambles. Background digits revolve.</CardDescription>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm">
							The effect layers are subtle: low-opacity typography, parallax transforms, and token-driven color.
						</CardContent>
					</Card>
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="CASE_STUDY_02" />
							</CardTitle>
							<CardDescription>Mouse movement shifts the whole backdrop.</CardDescription>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm">
							No re-render on pointer move—CSS variables update via requestAnimationFrame.
						</CardContent>
					</Card>
				</section>

				<section id="process" className="grid gap-4 md:grid-cols-3">
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="DISCOVER" />
							</CardTitle>
							<CardDescription>Find constraints before visuals.</CardDescription>
						</CardHeader>
					</Card>
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="DESIGN" />
							</CardTitle>
							<CardDescription>Token-first, motion-aware UI.</CardDescription>
						</CardHeader>
					</Card>
					<Card className="bg-card/70 backdrop-blur">
						<CardHeader>
							<CardTitle>
								<ScrambleText text="SHIP" />
							</CardTitle>
							<CardDescription>Fast, accessible, stable builds.</CardDescription>
						</CardHeader>
					</Card>
				</section>

				<footer className="text-muted-foreground flex flex-col gap-2 border-t pt-6 text-xs">
					<div>
						<ScrambleText text="©_2026_AGENCY_TEMPLATE" />
					</div>
					<div className="font-mono">Pointer + hover effects are client-side.</div>
				</footer>
			</div>
		</main>
	);
}
