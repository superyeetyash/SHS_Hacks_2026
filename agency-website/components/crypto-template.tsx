"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYBOARD_GLYPHS = "!@#$%^&*()_+-=[]{}|;:,.<>?/\\~";
const SCRAMBLE_ALPHABET = `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789${KEYBOARD_GLYPHS}`;
const CRYPTO_GLYPHS = `0123456789ABCDEF${KEYBOARD_GLYPHS}`;

// NOTE: Rotating backdrop rings are intentionally disabled right now.
// (Can be re-enabled by setting this flag to true.)
const ROTATING_RINGS_ENABLED = false;

function randomGlyph() {
	return CRYPTO_GLYPHS[Math.floor(Math.random() * CRYPTO_GLYPHS.length)];
}

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

type ScrambleTrigger = "hover" | "click" | "none";

function hoverCryptoEnabled(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return true;
	if (target.closest('[data-crypto-hover="on"]')) return true;
	if (target.closest('[data-crypto-hover="off"]')) return false;
	return true;
}

export function ScrambleText({
	text,
	className,
	trigger = "hover",
}: {
	text: string;
	className?: string;
	trigger?: ScrambleTrigger;
}) {
	const [display, setDisplay] = React.useState(text);
	const runningRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		return () => {
			if (runningRef.current) window.clearInterval(runningRef.current);
		};
	}, []);

	React.useEffect(() => {
		if (runningRef.current) window.clearInterval(runningRef.current);
		runningRef.current = null;
		setDisplay(text);
	}, [text]);

	function runScramble() {
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
		<span
			className={cn("font-mono", className)}
			onMouseEnter={
				trigger === "hover"
					? (e) => {
						if (!hoverCryptoEnabled(e.currentTarget)) return;
						runScramble();
					}
					: undefined
			}
			onClick={trigger === "click" ? runScramble : undefined}
		>
			{display}
		</span>
	);
}

export function DecryptText({
	text,
	className,
	trigger = "hover",
}: {
	text: string;
	className?: string;
	trigger?: ScrambleTrigger;
}) {
	const [display, setDisplay] = React.useState(() => scrambleTo(text, 0));
	const runningRef = React.useRef<number | null>(null);
	const revealedRef = React.useRef(false);

	React.useEffect(() => {
		if (runningRef.current) window.clearInterval(runningRef.current);
		revealedRef.current = false;

		setDisplay(scrambleTo(text, 0));
		let step = 0;
		const maxSteps = Math.max(16, text.length * 2);

		runningRef.current = window.setInterval(() => {
			step += 1;
			const reveal = Math.floor((step / maxSteps) * text.length);
			setDisplay(scrambleTo(text, reveal));

			if (step >= maxSteps) {
				if (runningRef.current) window.clearInterval(runningRef.current);
				runningRef.current = null;
				revealedRef.current = true;
				setDisplay(text);
			}
		}, 24);

		return () => {
			if (runningRef.current) window.clearInterval(runningRef.current);
		};
	}, [text]);

	function runScramble() {
		if (!revealedRef.current) return;
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
		<span
			className={cn(className)}
			onMouseEnter={
				trigger === "hover"
					? (e) => {
						if (!hoverCryptoEnabled(e.currentTarget)) return;
						runScramble();
					}
					: undefined
			}
			onClick={trigger === "click" ? runScramble : undefined}
		>
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
		let currentX = 0;
		let currentY = 0;
		let raf = 0;

		const maxMove = 14;
		const smooth = 0.08;
		const eps = 0.02;

		const animate = () => {
			currentX += (targetX - currentX) * smooth;
			currentY += (targetY - currentY) * smooth;
			el.style.setProperty("--parallax-x", `${currentX.toFixed(2)}px`);
			el.style.setProperty("--parallax-y", `${currentY.toFixed(2)}px`);

			if (Math.abs(targetX - currentX) > eps || Math.abs(targetY - currentY) > eps) {
				raf = window.requestAnimationFrame(animate);
				return;
			}
			raf = 0;
		};

		const onMove = (e: PointerEvent) => {
			const nx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
			const ny = e.clientY / Math.max(1, window.innerHeight) - 0.5;
			targetX = nx * maxMove;
			targetY = ny * maxMove;

			if (raf) return;
			raf = window.requestAnimationFrame(animate);
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

type ScatterGlyph = {
	id: number;
	x: number;
	y: number;
	size: number;
	opacity: number;
	char: string;
};

function makeScatterGlyphs(count: number): ScatterGlyph[] {
	return Array.from({ length: count }, (_, i) => {
		const size = 11 + Math.random() * 22;
		return {
			id: i,
			x: Math.random() * 100,
			y: Math.random() * 100,
			size,
			opacity: 0.12 + Math.random() * 0.38,
			char: randomGlyph(),
		};
	});
}

function CryptoScatter({ count = 90 }: { count?: number }) {
	const [glyphs, setGlyphs] = React.useState<ScatterGlyph[]>(() => makeScatterGlyphs(count));

	React.useEffect(() => {
		const interval = window.setInterval(() => {
			setGlyphs((prev) =>
				prev.map((g) => {
					if (Math.random() < 0.35) return { ...g, char: randomGlyph() };
					return g;
				}),
			);
		}, 120);

		return () => window.clearInterval(interval);
	}, []);

	return (
		<div className="absolute inset-0" aria-hidden>
			{glyphs.map((g) => (
				<span
					key={g.id}
					className="absolute font-mono text-foreground"
					style={{
						left: `${g.x}%`,
						top: `${g.y}%`,
						fontSize: `${g.size.toFixed(1)}px`,
						opacity: g.opacity,
					}}
				>
					{g.char}
				</span>
			))}
		</div>
	);
}

export function CryptoBackdrop({
	scatter = true,
	rings = ROTATING_RINGS_ENABLED,
}: {
	scatter?: boolean;
	rings?: boolean;
} = {}) {
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
			{scatter ? <CryptoScatter /> : null}

			{rings ? (
				<>
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
				</>
			) : null}

			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_35%,hsl(var(--background))_70%)]" />
		</div>
	);
}

export function ThemeToggle({ trigger = "click" }: { trigger?: ScrambleTrigger } = {}) {
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
			<ScrambleText text={isDark ? "DARK" : "LIGHT"} trigger={trigger} />
		</Button>
	);
}
