# Getting Started

Get up and running with Fynix in under 5 minutes.

---

## Installation

Create a new Fynix project using the CLI:

```bash
npx fynixcli my-app
cd my-app
npm install
npm run dev
```

This scaffolds a fully configured project with Vite, TypeScript, and the Fynix runtime.

### Manual Installation

If you prefer to add Fynix to an existing project:

```bash
npm install fynixui
```

**Requirements:**
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

---

## Project Structure

After scaffolding, your project looks like this:

```
my-app/
├── src/
│   ├── home/
│   │   └── view.tsx        ← Home page (route: /)
│   ├── about/
│   │   └── view.tsx        ← About page (route: /about)
│   └── main.ts             ← App entry point
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

> **Key insight:** Fynix uses **file-based routing**. The folder structure under `src/` determines your routes automatically. A file named `view.tsx` inside `src/about/` maps to the `/about` route.

---

## Your First Component: Hello World

Create `src/home/view.tsx`:

```tsx
import { VNode } from "fynixui";

export default function Home(): VNode {
  return (
    <div>
      <h1>Hello, Fynix!</h1>
      <p>Welcome to your first Fynix app.</p>
    </div>
  );
}
```

**What's happening:**
1. We import `VNode` — the type for Fynix virtual DOM nodes
2. We export a function component that returns JSX
3. Fynix's JSX pragma converts this to `h()` calls under the hood
4. The router automatically discovers this file and maps it to `/`

---

## Setting Up the Entry Point

Create `src/main.ts`:

```typescript
import createFynix from "fynixui/router";

const app = createFynix();
app.mountRouter("#app");
```

And in your `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My Fynix App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Run `npm run dev` and open `http://localhost:5173`. You should see "Hello, Fynix!".

---

## Adding Interactivity

Let's add a counter to see reactivity in action:

```tsx
import { nixState, VNode } from "fynixui";

export default function Home(): VNode {
  const count = nixState<number>(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button r-click={() => count.value++}>
        Increment
      </button>
    </div>
  );
}
```

**What's new:**
- `nixState(0)` creates a reactive state initialized to `0`
- `{count}` in JSX automatically displays the value and subscribes to changes
- `r-click` is Fynix's secure event handler (replaces `onclick`)
- `count.value++` updates the state, which triggers a surgical re-render of only this component

> **Why `r-click` instead of `onClick`?** Fynix blocks inline event handlers (`onclick`, `onmouseover`, etc.) for security. All events go through Fynix's delegated event system using `r-` prefixed attributes.

---

**Next:** [Core Concepts →](./03-core-concepts.md)
