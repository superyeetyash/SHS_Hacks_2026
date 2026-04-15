"use client";

import Link from "next/link";

import { CryptoBackdrop, ScrambleText, ThemeToggle } from "@/components/crypto-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Marquee() {
	return (
		<main className="relative min-h-screen overflow-hidden">
			<CryptoBackdrop />

			<div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8">
				<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<Link href="/" className="flex items-center gap-3" onClick={(e) => e.preventDefault()} aria-disabled="true">
						<div className="bg-foreground/10 text-foreground inline-flex size-10 items-center justify-center rounded-lg border">
							<span className="font-mono text-xs">01</span>
						</div>
						<div className="flex flex-col">
							<div className="text-sm font-semibold tracking-tight">Agency</div>
							<div className="text-muted-foreground text-xs">Cryptographic template</div>
						</div>
					</Link>

					<nav className="flex flex-wrap items-center gap-4">
						<Link
							href="#services"
							className="text-muted-foreground hover:text-foreground text-sm"
							onClick={(e) => e.preventDefault()}
							aria-disabled="true"
						>
							<ScrambleText text="SERVICES" />
						</Link>
						<Link
							href="#work"
							className="text-muted-foreground hover:text-foreground text-sm"
							onClick={(e) => e.preventDefault()}
							aria-disabled="true"
						>
							<ScrambleText text="WORK" />
						</Link>
						<Link
							href="#process"
							className="text-muted-foreground hover:text-foreground text-sm"
							onClick={(e) => e.preventDefault()}
							aria-disabled="true"
						>
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
						<Button size="lg" className="font-mono" asChild>
							<Link href="/edgeproof">
								<ScrambleText text="GET_STARTED" />
							</Link>
						</Button>
						<Button size="lg" variant="outline" className="font-mono" asChild>
							<Link href="#work">
								<ScrambleText text="VIEW_WORK" />
							</Link>
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
