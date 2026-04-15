"use client";

import * as React from "react";

import { CryptoBackdrop, ScrambleText } from "@/components/crypto-template";
import { Spinner } from "@/components/ui/spinner";

const HELIX_GLYPHS = "0123456789ABCDEF!@#$%^&*()_+-=[]{}|;:,.<>?/\\~";

function randGlyph() {
	return HELIX_GLYPHS[Math.floor(Math.random() * HELIX_GLYPHS.length)];
}

function mod(n: number, m: number) {
	return ((n % m) + m) % m;
}

function readForegroundHsl(): { h: number; s: string; l: string } | null {
	if (typeof window === "undefined") return null;
	const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
	if (!raw) return null;
	const parts = raw.split(/\s+/).filter(Boolean);
	if (parts.length < 3) return null;
	const h = Number(parts[0]);
	if (!Number.isFinite(h)) return null;
	return { h, s: parts[1], l: parts[2] };
}

function clamp01(n: number) {
	return Math.min(1, Math.max(0, n));
}

function linearToSrgb(v: number) {
	if (v <= 0.0031308) return 12.92 * v;
	return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function oklchToRgba(raw: string): string | null {
	const m = raw.trim().match(/^oklch\((.*)\)$/i);
	if (!m) return null;
	const inner = m[1].trim();
	const [beforeSlash, alphaRaw] = inner.split("/").map((s) => s.trim());
	const parts = beforeSlash.split(/\s+/).filter(Boolean);
	if (parts.length < 3) return null;

	const lRaw = parts[0];
	const cRaw = parts[1];
	const hRaw = parts[2];

	let L = Number.parseFloat(lRaw);
	if (!Number.isFinite(L)) return null;
	if (lRaw.endsWith("%")) L /= 100;
	const C = Number.parseFloat(cRaw);
	if (!Number.isFinite(C)) return null;
	const H = Number.parseFloat(hRaw);
	if (!Number.isFinite(H)) return null;
	const a = C * Math.cos((H * Math.PI) / 180);
	const b = C * Math.sin((H * Math.PI) / 180);

	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;

	const l = l_ * l_ * l_;
	const m2 = m_ * m_ * m_;
	const s = s_ * s_ * s_;

	let rLin = 4.0767416621 * l - 3.3077115913 * m2 + 0.2309699292 * s;
	let gLin = -1.2684380046 * l + 2.6097574011 * m2 - 0.3413193965 * s;
	let bLin = -0.0041960863 * l - 0.7034186147 * m2 + 1.707614701 * s;

	rLin = clamp01(rLin);
	gLin = clamp01(gLin);
	bLin = clamp01(bLin);

	const r = Math.round(clamp01(linearToSrgb(rLin)) * 255);
	const g = Math.round(clamp01(linearToSrgb(gLin)) * 255);
	const bb = Math.round(clamp01(linearToSrgb(bLin)) * 255);

	let alpha = 1;
	if (alphaRaw) {
		alpha = Number.parseFloat(alphaRaw);
		if (!Number.isFinite(alpha)) alpha = 1;
		alpha = Math.min(1, Math.max(0, alpha));
	}

	if (alpha < 1) return `rgba(${r}, ${g}, ${bb}, ${alpha.toFixed(3)})`;
	return `rgb(${r}, ${g}, ${bb})`;
}

function toCanvasColor(raw: string): string | null {
	const value = raw.trim();
	if (!value) return null;
	if (
		value.startsWith("rgb(") ||
		value.startsWith("rgba(") ||
		value.startsWith("#") ||
		value.startsWith("hsl(") ||
		value.startsWith("hsla(")
	)
		return value;
	if (value.toLowerCase().startsWith("oklch(")) return oklchToRgba(value);
	return value;
}

type HelixPoint = {
	x: number;
	y: number;
	char: string;
	size: number;
	a: number;
};

type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	char: string;
	size: number;
	a: number;
};

export function HelixGate({
	onComplete,
	mode = "gate",
}: {
	onComplete?: () => void;
	mode?: "gate" | "loading";
}) {
	const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
	const clickRef = React.useRef<HTMLDivElement | null>(null);
	const colorProbeRef = React.useRef<HTMLSpanElement | null>(null);
	const interactive = mode === "gate";

	const phaseRef = React.useRef<"idle" | "explode">("idle");
	const particlesRef = React.useRef<Particle[]>([]);
	const lastPointsRef = React.useRef<HelixPoint[]>([]);
	const explosionStartRef = React.useRef<number>(0);
	const finishedRef = React.useRef(false);

	const pointerRef = React.useRef({ x: 0, y: 0 });
	const pointerRafRef = React.useRef<number>(0);

	React.useEffect(() => {
		if (!interactive) return;
		const onMove = (e: PointerEvent) => {
			pointerRef.current.x = e.clientX;
			pointerRef.current.y = e.clientY;

			if (pointerRafRef.current) return;
			pointerRafRef.current = window.requestAnimationFrame(() => {
				pointerRafRef.current = 0;
				const el = clickRef.current;
				if (!el) return;
				el.style.transform = `translate3d(${(pointerRef.current.x + 14).toFixed(1)}px, ${(pointerRef.current.y + 14).toFixed(1)}px, 0)`;
			});
		};

		window.addEventListener("pointermove", onMove, { passive: true });
		return () => {
			window.removeEventListener("pointermove", onMove);
			if (pointerRafRef.current) window.cancelAnimationFrame(pointerRafRef.current);
		};
	}, [interactive]);

	const handleClick = React.useCallback(() => {
		if (!interactive) return;
		if (phaseRef.current !== "idle") return;
		phaseRef.current = "explode";
		explosionStartRef.current = performance.now();
		if (clickRef.current) clickRef.current.style.display = "none";

		const points = lastPointsRef.current;
		const maxParticles = 900;
		const stride = Math.max(1, Math.ceil(points.length / maxParticles));
		const sampled = points.filter((_, i) => i % stride === 0);
		const canvas = canvasRef.current;
		const rect = canvas ? canvas.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
		const cx = rect.width / 2;
		const cy = rect.height / 2;

		particlesRef.current = sampled.map((p) => {
			const dx = p.x - cx;
			const dy = p.y - cy;
			const mag = Math.max(1, Math.hypot(dx, dy));
			const nx = dx / mag;
			const ny = dy / mag;
			const speed = 320 + Math.random() * 520;
			return {
				x: p.x,
				y: p.y,
				vx: nx * speed + (Math.random() - 0.5) * 240,
				vy: ny * speed + (Math.random() - 0.5) * 240,
				char: p.char,
				size: p.size,
				a: 1,
			};
		});
	}, [interactive]);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let dpr = Math.max(1, window.devicePixelRatio || 1);

		function resize() {
			const rect = canvas.getBoundingClientRect();
			dpr = Math.max(1, window.devicePixelRatio || 1);
			canvas.width = Math.floor(rect.width * dpr);
			canvas.height = Math.floor(rect.height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
		}

		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);

		let raf = 0;
		let prevNow = performance.now();
		let fill = "rgb(255, 255, 255)";
		let lastFill = "";
		let nextFillCheckAt = 0;

		function syncFill(now: number) {
			if (now < nextFillCheckAt) return;
			nextFillCheckAt = now + 200;
			const probe = colorProbeRef.current;
			const fromProbeRaw = probe ? window.getComputedStyle(probe).color : "";
			const fromProbe = fromProbeRaw ? toCanvasColor(fromProbeRaw) : null;
			if (fromProbe && fromProbe !== lastFill) {
				lastFill = fromProbe;
				fill = fromProbe;
				return;
			}

			const fgRaw = window.getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
			const fg = fgRaw ? toCanvasColor(fgRaw) : null;
			if (fg && fg !== lastFill) {
				lastFill = fg;
				fill = fg;
				return;
			}

			const hsl = readForegroundHsl();
			const fallback = hsl ? `hsl(${hsl.h}, ${hsl.s}, ${hsl.l})` : "rgb(255, 255, 255)";
			if (fallback !== lastFill) {
				lastFill = fallback;
				fill = fallback;
			}
		}

		function drawHelix(now: number, w: number, h: number) {
			syncFill(now);
			const t = now / 1000;
			const centerX = w / 2;
			const spacing = 12;
			const margin = spacing * 4;
			const speedY = 104;
			const wrapH = h + margin * 2;

			const baseAmp = Math.min(w * 0.34, 340);
			const amp = baseAmp * (0.78 + 0.22 * Math.sin(t * 1.1));
			const period = 72;
			const phase = t * 2.2;

			const points: HelixPoint[] = [];

			for (let i = 0; i < Math.ceil(wrapH / spacing) + 1; i += 1) {
				const yy = -margin + i * spacing;
				const y = mod(yy + t * speedY, wrapH) - margin;
				const angle = y / period + phase;
				const xOff = Math.sin(angle) * amp;
				const halfWidth = Math.max(22, Math.abs(xOff));
				const span = halfWidth * 2;
				const cols = Math.max(3, Math.min(32, Math.round(span / 14)));

				const sizeBase = 18 + 12 * (0.5 + 0.5 * Math.sin(angle + 1.4));
				const aBase = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(angle));

				for (let j = 0; j < cols; j += 1) {
					const u = cols === 1 ? 0.5 : j / (cols - 1);
					const edge = Math.abs(u - 0.5) * 2;
					const x = centerX - halfWidth + u * span;
					const a = aBase * (0.8 + 0.2 * edge);
					const size = sizeBase * (0.94 + 0.12 * edge);
					points.push({ x, y, char: randGlyph(), size, a });
				}
			}

			lastPointsRef.current = points;

			ctx.fillStyle = fill;
			for (const p of points) {
				ctx.globalAlpha = p.a;
				ctx.font = `600 ${p.size.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace`;
				ctx.fillText(p.char, p.x, p.y);
			}
			ctx.globalAlpha = 1;
		}

		function drawExplosion(dt: number) {
			syncFill(performance.now());
			const particles = particlesRef.current;
			ctx.fillStyle = fill;

			const gravity = 420;
			const damp = 0.985;

			for (const p of particles) {
				p.vx *= damp;
				p.vy = p.vy * damp + gravity * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
			}

			const elapsed = (performance.now() - explosionStartRef.current) / 1000;
			const fade = Math.max(0, 1 - elapsed / 1.05);

			for (const p of particles) {
				ctx.globalAlpha = Math.max(0, Math.min(1, p.a * fade));
				ctx.font = `600 ${p.size.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace`;
				ctx.fillText(p.char, p.x, p.y);
			}
			ctx.globalAlpha = 1;

			if (elapsed > 1.05 && !finishedRef.current) {
				finishedRef.current = true;
				if (onComplete) onComplete();
			}
		}

		function loop(now: number) {
			const dt = Math.min(0.05, (now - prevNow) / 1000);
			prevNow = now;

			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			ctx.clearRect(0, 0, w, h);

			if (phaseRef.current === "idle") {
				drawHelix(now, w, h);
			} else {
				drawExplosion(dt);
			}

			raf = window.requestAnimationFrame(loop);
		}

		raf = window.requestAnimationFrame(loop);
		return () => {
			window.cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, [onComplete]);

	return (
		<div
			className={interactive ? "fixed inset-0 z-50 cursor-pointer bg-background" : "fixed inset-0 z-50 cursor-wait bg-background"}
			onClick={handleClick}
			role={interactive ? "button" : undefined}
			aria-label={interactive ? "Enter" : "Loading"}
			tabIndex={interactive ? 0 : -1}
			onKeyDown={(e) => {
				if (!interactive) return;
				if (e.key === "Enter" || e.key === " ") handleClick();
			}}
		>
			<CryptoBackdrop scatter={false} rings={false} />
			<span ref={colorProbeRef} className="pointer-events-none absolute opacity-0 text-foreground" aria-hidden>
				.
			</span>
			<canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
			{interactive ? (
				<div
					ref={clickRef}
					className="pointer-events-none fixed left-0 top-0 font-mono text-xs text-muted-foreground"
					style={{ transform: "translate3d(0px, 0px, 0)" }}
				>
					click
				</div>
			) : (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="bg-card/70 flex items-center gap-3 rounded-lg border px-6 py-4 backdrop-blur">
						<Spinner className="text-muted-foreground" />
						<div className="text-muted-foreground text-sm">
							<ScrambleText text="LOADING" />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
