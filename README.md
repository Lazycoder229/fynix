<div align="center">

# Fynix Core

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-100%25-blue)
![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)

**A lightweight, fiber-based runtime with built-in security and fine-grained reactivity**

[ Quick Start](#-quick-start) • [ Docs](#-architecture) • [ Security](#-security) • [ Features](#-key-features)

</div>

---

## Key Features

<table>
<tr>
<td align="center"><br><b>Fiber Architecture</b><br>Time-sliced rendering</td>
<td align="center"><br><b>Security Built-in</b><br>XSS protection by default</td>
<td align="center"><br><b>Zero Dependencies</b><br>No supply chain risk</td>
</tr>
<tr>
<td align="center"><br><b>Surgical Updates</b><br>Only affected fibers render</td>
<td align="center"><br><b>TypeScript Native</b><br>Full type safety</td>
<td align="center"><br><b>High Performance</b><br>Optimized for speed</td>
</tr>
</table>

---

## Quick Facts

| Aspect                 | Status                  |
| ---------------------- | ----------------------- |
| **Build Size**         | ~15KB gzipped           |
| **External Deps**      | 0                       |
| **TypeScript Support** | Full                    |
| **Browser Support**    | Modern browsers         |
| **Security**           | Built-in XSS protection |

---

## Overview

Fynix Core is a modern web framework built on **fiber architecture** and **fine-grained reactivity**. Unlike traditional frameworks that re-render entire component trees, Fynix uses targeted fiber updates to only re-render components that actually changed, resulting in dramatically better performance.

**Key Stats:**

- **Zero Runtime Dependencies** - No supply chain risk
- **Security Built-in** - XSS protection at the framework level
- **Lightweight** - Tiny bundle size with fiber reconciliation
- **Surgical Re-renders** - Only affected fibers update, not entire trees
- **Full TypeScript** - Native JSX support with complete type safety

---

## Architecture

### The Fynix Render Pipeline

```
    VNode Tree (h() / JSX)
           ↓
    FiberReconciler
    (Fiber Tree Construction)
           ↓
    Time-Sliced Work Loop
    (FynixScheduler handles priority)
           ↓
    Commit Phase
    (DOM Mutations)
           ↓
    Browser Paint
```

### Core Concepts

**1. VNode (Virtual DOM Node)**

- Lightweight, immutable representation of UI
- Created by `h()` function or JSX syntax
- Never directly mutates the DOM
- Preserved as the public API

**2. FynixFiber (Internal Work Unit)**

- Each fiber represents one VNode
- Forms a singly-linked tree: `child → sibling → parent`
- Contains component context, hooks, and lifecycle state
- `alternate` pointer enables diffing without touching the DOM mid-render

**3. Work Loop (Time-Sliced Scheduling)**

- Priority-based task scheduler
- Yields to higher-priority work (user interactions)
- Background work (prefetching, non-critical updates) runs idle
- Ensures UI stays responsive even under heavy load

**4. Commit Phase**

- Applies all DOM mutations in one synchronous pass
- No partial updates, no layout thrashing
- Operations: `PLACEMENT`, `UPDATE`, `DELETION`

---

## Runtime Features

### 1. **Priority-Based Scheduling**

Fine-grained control over when and how updates are processed:

```typescript
enum Priority {
  immediate = "Right now (sync)",
  high = "Next rAF (~16ms)",
  normal = "Batched updates",
  low = "Background work",
  idle = "requestIdleCallback",
}
```

**Performance Impact:**

- User interactions (clicks) → `high` priority
- State updates → `normal` priority
- Prefetching → `low` priority
- Analytics → `idle` priority

```typescript
interface Update {
  id: string;
  type: UpdateType; // "state" | "props" | "effect" | "layout"
  priority: Priority;
  component?: ComponentContext;
  callback: () => void;
  timestamp: number;
}
```

### 2. **Fine-Grained Reactivity**

**nixState** tracks exactly which components depend on which state values:

```typescript
const count = nixState(0);

// Only this component's fiber updates
count.set(count.value + 1);

// NOT the entire tree
```

**How it works:**

1. Component subscribes to `nixState`
2. State change marks only THIS fiber as dirty
3. Scheduler queues fiber for update
4. Commit phase applies single fiber update
5. Parent & sibling trees untouched

### 3. **Double-Buffered Fiber Tree**

Safe diffing without touching the DOM during reconciliation:

```typescript
interface FynixFiber {
  // Current render
  props: VNodeProps;
  child: FynixFiber | null;
  sibling: FynixFiber | null;

  // Previous render (for diffing)
  alternate: FynixFiber | null;

  // Reconciliation metadata
  effectTag: "PLACEMENT" | "UPDATE" | "DELETION";
  updatePriority: Priority;
}
```

### 4. **Component Context Lifecycle**

Each component gets persistent state storage:

```typescript
interface ComponentContext {
  hooks: any[];              // Hook values
  effects: Function[];       // Effect cleanup functions
  _fiber: FynixFiber;        // Back-reference to fiber
  _subscriptions: Set<...>;  // Active subscriptions
  _isMounted: boolean;       // Lifecycle tracking
  version: number;           // Render count
}
```

---

## Router Features

### 1. **File-Based Routing**

Automatic route discovery with pattern matching:

```typescript
interface FynixRouter {
  mountRouter(selector?: string): void;
  navigate(path: string, props?: Record<string, any>): void;
  replace(path: string, props?: Record<string, any>): void;
  back(): void;
  cleanup(): void;
}
```

### 2. **Dynamic Routes with Params**

Automatic parameter extraction from URL patterns:

```typescript
interface DynamicRoute {
  pattern: string; // e.g., "/products/:id"
  regex: RegExp; // Compiled for fast matching
  component: RouteComponent;
  params: string[]; // ["id"] extracted from pattern
}
```

### 3. **Reactive Location Signal**

Components automatically re-render on route changes:

```typescript
interface LocationSignal {
  path: string; // Current route path
  params: Record<string, string>; // URL parameters
  search: string; // Query string
}

// Components automatically re-render on route changes
location.subscribe((newLocation) => {
  // Handle route change
});
```

### 4. **Enterprise Props Caching**

Prevents state loss during navigation:

```typescript
interface HistoryState {
  __fynixCacheKey?: string;
  serializedProps?: Record<string, any>;
}

// Limits
const MAX_CACHE_SIZE = 50;
const RENDER_DEBOUNCE = 10; // ms
```

### 5. **SEO-Friendly Route Metadata**

Define page titles and meta tags per route:

```typescript
interface RouteMeta {
  title?: string;
  description?: string;
  keywords?: string;
  twitterCard?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

interface RouteComponent {
  (props: any): VNode | Promise<VNode>;
  props?: Record<string, any> | (() => Record<string, any>);
  meta?: RouteMeta | ((params: Record<string, string>) => RouteMeta);
}
```

### Lazy Loading

Routes support lazy loading via `nixLazy`:

```typescript
interface FynixRouterOptions {
  lazy?: boolean; // Enable lazy route loading
}
```

## Installation

```bash
npx fynixcli <app-name>
```

### JSX Syntax

```typescript
import { nixState, VNode } from "fynixui";

export function Counter(): VNode {
  const count = nixState<number>(0);

  return (
    <div class="p-8 text-center">
      <h1 class="text-4xl font-black mb-4">
        Count: {count.value}
      </h1>
      <button
        r-click={() => count.set(count.value + 1)}
        r-class="px-6 py-3 rounded-lg bg-gradient-to-r
               from-violet-500 to-cyan-500
               text-white font-bold hover:shadow-lg
               transition-shadow"
      >
        Increment
      </button>
    </div>
  );
}
```

## Security

### Built-in XSS Protection

**HTML Entity Encoding**

- Automatic sanitization of text nodes
- `<`, `>`, `&`, `"`, `'` are encoded

  **Protocol Blocking**

- `javascript:` URLs blocked
- `data:` URIs blocked
- `vbscript:` blocked
- Safe protocols only: `http://`, `https://`, relative paths

  **Inline Handler Blocking**

- `onclick`, `onmouseover`, etc. rejected
- Use `r-click`, `r-input` instead (delegated events)

  **innerHTML Restriction**

- `innerHTML` assignment blocked
- `outerHTML` blocked
- Use VNode API instead

### Security Best Practices

```typescript
//  BLOCKED (inline handler)
<button onclick="alert('hack')">Click</button>

//  ALLOWED (delegated event)
<button r-click={() => alert('safe')}>Click</button>

//  BLOCKED (data URI)
<img src="data:text/html,<script>..." />

//  ALLOWED (secure source)
<img src="/images/photo.jpg" />

//  BLOCKED (innerHTML)
element.innerHTML = userInput;

//  ALLOWED (VNode)
<div>{userInput}</div>
```

## Contributing

Contributions welcome! Please submit issues and pull requests to our [GitHub repository](https://github.com/Lazycoder229/fynix).

---

## License

MIT License © 2026 Resty Gonzales

See [LICENSE](./LICENSE) for full details.

<div align="center">

**Made with by the Fynix team**

[![GitHub Stars](https://img.shields.io/github/stars/Lazycoder229/fynix.svg)](https://github.com/Lazycoder229/fynix)
[![Twitter Follow](https://img.shields.io/twitter/follow/fynix.svg)](https://twitter.com/fynix)

</div>
