# Components Guide

A reference for all reusable components encountered in the project tutorials.

---

## `<For>` — List Renderer

**Purpose:** Efficiently renders arrays of items with automatic keying.

**Props:**
| Prop       | Type                                      | Description                          |
| ---------- | ----------------------------------------- | ------------------------------------ |
| `each`     | `T[]` or `ReactiveState<T[]>`             | Array to iterate over                |
| `children` | `(item: T, index: number) => VNode`       | Render function for each item        |

**Example:**
```tsx
import { For } from "fynixui";

<For each={items.value}>
  {(item, index) => <div key={item.id}>{item.name}</div>}
</For>
```

**Where it's used:** Todo list (Project 1), Notes grid (Project 2), Activity feed (Project 3)

> **Tip:** Always provide a `key` prop on the returned element for best reconciliation performance.

---

## `<Suspense>` — Async Loading Boundary

**Purpose:** Shows a fallback while lazy-loaded components are loading.

**Props:**
| Prop       | Type    | Description                            |
| ---------- | ------- | -------------------------------------- |
| `fallback` | `VNode` | Content to show while loading          |
| `children` | `VNode` | The lazy component to render           |

**Example:**
```tsx
import { nixLazy, Suspense } from "fynixui";

const HeavyChart = nixLazy(() => import("./Chart"));

function Dashboard(): VNode {
  return (
    <Suspense fallback={<p>Loading chart...</p>}>
      <HeavyChart />
    </Suspense>
  );
}
```

**Where it's used:** Dashboard lazy-loaded widgets (Project 3)

---

## `Button` — Built-in Button Component

**Purpose:** Pre-styled, accessible button with delegated events.

**Example:**
```tsx
import { Button } from "fynixui/custom";

<Button r-click={handleSave}>Save</Button>
```

**Where it's used:** Available as a built-in custom component.

---

## `Path` — Navigation Link Component

**Purpose:** Declarative navigation link that integrates with the Fynix router.

**Example:**
```tsx
import { Path } from "fynixui/custom";

<Path href="/dashboard" props={{ tab: "overview" }}>
  Go to Dashboard
</Path>
```

**Where it's used:** Navigation between pages (Project 3)

---

## Building Your Own Components

Follow this pattern:

```tsx
import { VNode } from "fynixui";

// 1. Define props interface
interface CardProps {
  title: string;
  children?: VNode[];
  variant?: "default" | "highlighted";
}

// 2. Export component function
export function Card(props: CardProps): VNode {
  const cls = props.variant === "highlighted" ? "card highlighted" : "card";

  return (
    <div class={cls}>
      <h3 class="card-title">{props.title}</h3>
      <div class="card-body">{props.children}</div>
    </div>
  );
}

// 3. Usage
<Card title="My Card" variant="highlighted">
  <p>Card content here</p>
</Card>
```

**Guidelines:**
- Accept props as the first argument
- Return a `VNode`
- Use TypeScript interfaces for prop types
- Keep components focused on one responsibility

---

**Next:** [API Reference →](./08-api-reference.md)
