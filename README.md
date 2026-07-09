
# SHS_Hacks_2026

Curated by Yasashvee Karthi, Alexander Jameson, Anish Agneeswaran, Liam Moorthy, Tejas Ganesh

## EdgeProof Generator (Admin Test-Case Builder)

This project includes a full-stack website for generating robust programming test suites from:
- assignment directions
- a reference implementation
- a requested test count

The app focuses on edge-case coverage templates (empty inputs, boundaries, malformed-like cases, scale checks, etc.) and produces exportable JSON.

## Features

- No login required
- Input fields for challenge title, language, directions, and reference code
- Heuristic test-case generator that infers input model (`array`, `string`, `number`, `matrix`, `graph`)
- Optional execution of generated test cases against your reference code (Python/JavaScript)
- Per-test input/output preview plus optional example run from custom JSON input
- Paste student code later and retest against the same generated suite (pass/fail + runtime errors)
- Responsive UI

## Important Limitation

No generator can *guarantee* perfect coverage for every possible bug. This app creates strong baseline and edge-case-heavy suites, but you should still:
- validate expected outputs with an authoritative solver
- add hand-crafted tests for known tricky pitfalls
- optionally add fuzzing/property-based tests

## Reference Code Contract

For execution preview, your reference code should define a callable function (default name: `solve`) that accepts one JSON object and returns a result.

JavaScript example:

```javascript
function solve(input) {
	return { received: input };
}
```

Python example:

```python
def solve(input_data):
		return {"received": input_data}
```

You can change the function name in the dashboard.

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind + shadcn/Radix UI
- Node runtime API routes (executes reference/student code)

## Language Toolchains

The runner executes code locally, so some languages need host toolchains installed on your machine.

On Windows, these are the exact package installs I used:

```powershell
winget install --id Microsoft.DotNet.SDK.8 -e --silent --accept-package-agreements --accept-source-agreements
winget install --id EclipseAdoptium.Temurin.17.JDK -e --silent --accept-package-agreements --accept-source-agreements
winget install --id LLVM.LLVM -e --silent --accept-package-agreements --accept-source-agreements
winget install --id Rustlang.Rustup -e --silent --accept-package-agreements --accept-source-agreements
```

C# can also fall back to the .NET SDK compiler path, but Java, C/C++, and Rust still need their toolchains available on PATH.

## Global Setup

Go to https://phanguard.org/edgeproof

## Local Setup

The app lives in `agency-website/`.

1. Install dependencies:

```bash
npm install --prefix agency-website
```

If `npm`/`node` aren’t available on your PATH (or PowerShell blocks `npm.ps1`), use the repo-bundled Node runtime (if present):

```powershell
cd agency-website
..\.tools\node\node-v24.14.1-win-x64\npm.cmd install
```

2. Run in development mode:

```bash
npm run dev -- --port 3003
```

If you’re using the bundled Node runtime, start Next directly (choose any port you want):

```powershell
cd agency-website
..\.tools\node\node-v24.14.1-win-x64\node.exe .\node_modules\next\dist\bin\next dev --port 3003
```

3. Open:

```text
http://localhost:3003
```

EdgeProof is at:

```text
http://localhost:3003/edgeproof
```

## Possible Future Improvements

- Add CSRF protection and rate limiting
- Integrate execution sandboxing if you later run untrusted student code

## Project Structure

```text
agency-website/
  app/
    api/
      generate/route.ts
      retest/route.ts
    page.tsx
    edgeproof/page.tsx
  lib/
    edgeproof/
      codeRunner.ts
      testCaseGenerator.ts
      types.ts
```
