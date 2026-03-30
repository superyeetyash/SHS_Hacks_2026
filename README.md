# SHS_Hacks_2026

Curated by Yasashvee Karthi, Alexander Jonathon Jameson, Guru Anish Agneeswaran, Liam Moorthy, Tejas Ganesh

## EdgeProof Generator (Admin Test-Case Builder)

This project now includes a full-stack admin website for generating robust programming test suites from:
- assignment directions
- a reference implementation
- a requested test count

The app focuses on edge-case coverage templates (empty inputs, boundaries, malformed-like cases, scale checks, etc.) and produces exportable JSON.

## Features

- Admin login (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`)
- Protected dashboard
- Input fields for challenge title, language, directions, and reference code
- Heuristic test-case generator that infers input model (`array`, `string`, `number`, `matrix`, `graph`)
- Optional execution of generated test cases against your reference code (Python/JavaScript)
- Per-test input/output preview plus optional example run from custom JSON input
- Paste student code later and retest against the same generated suite (pass/fail + runtime errors)
- JSON output preview, copy-to-clipboard, and file download
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

- Node.js
- Express + EJS
- Express sessions
- Vanilla CSS/JS

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Set secure values in `.env`:

```env
PORT=3000
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=teacher@example.com
ADMIN_PASSWORD=ChangeMe123!
```

4. Run in development mode:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Production Notes

- Replace in-memory sessions with a persistent session store (Redis, DB, etc.)
- Add CSRF protection and rate limiting
- Hash credentials in a database instead of plaintext `.env` credentials
- Integrate execution sandboxing if you later run untrusted student code

## Project Structure

```text
src/
	middleware/
		auth.js
	routes/
		auth.js
		dashboard.js
	services/
		testCaseGenerator.js
	server.js
views/
	partials/
		header.ejs
		footer.ejs
	dashboard.ejs
	error.ejs
	login.ejs
public/
	css/styles.css
	js/main.js
```
