# Core Concepts

Understand the four pillars of Fynix before building projects.

---

## 1. Components

**What:** A component is a function that returns a VNode (virtual DOM node).

**Why:** Components let you split your UI into reusable, independent pieces.

```tsx
import { VNode } from "fynixui";

function Greeting(props: { name: string }): VNode {
  return <h1>Hello, {props.name}!</h1>;
}

// Usage
<Greeting name="Alice" />;
```

**Rules:**

- Must return a `VNode` (or use `Fragment` for multiple elements)
- Props are passed as the first argument
- Hooks must be called at the top level (not inside conditionals)

> **Used in:** All three project tutorials

---

## 2. State (`nixState`)

**What:** `nixState` creates a reactive value. When it changes, only the component that reads it re-renders.

**Why:** Unlike traditional frameworks that diff entire trees, Fynix tracks exactly which component fibers depend on which state — enabling surgical DOM updates.

```tsx
import { nixState, VNode } from "fynixui";

function Counter(): VNode {
  const count = nixState<number>(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button r-click={() => count.value++}>+1</button>
      <button r-click={() => (count.value = 0)}>Reset</button>
    </div>
  );
}
```

**Key points:**

- Read via `count.value` (or just `{count}` in JSX — auto-unwraps)
- Write via `count.value = newValue`
- Only the subscribing component's fiber is re-rendered, not the whole tree
- Has built-in protection against prototype pollution

> **Used in:** Todo App (Project 1), Notes Manager (Project 2), Dashboard (Project 3)

---

## 3. Effects (`nixEffect`)

**What:** `nixEffect` runs side effects (API calls, subscriptions, timers) after render.

**Why:** Keeps your component functions pure. Side effects are scheduled separately and cleaned up automatically.

```tsx
import { nixState, nixEffect, VNode } from "fynixui";

function Timer(): VNode {
  const seconds = nixState(0);

  nixEffect(() => {
    const interval = setInterval(() => {
      seconds.value++;
    }, 1000);

    // Cleanup: runs when component unmounts or deps change
    return () => clearInterval(interval);
  }, []); // Empty deps = run once on mount

  return <p>Elapsed: {seconds} seconds</p>;
}
```

**Variants:**
| Hook | Behavior |
| ---------------- | ---------------------------------- |
| `nixEffect` | Runs when dependencies change |
| `nixEffectOnce` | Runs once on mount |
| `nixEffectAlways` | Runs on every render (use sparingly) |

> **Used in:** Timer in Todo App, API fetching in Dashboard

---

## 4. Events & Rendering

### Delegated Events

Fynix uses **event delegation** with the `r-` prefix for security:

```tsx
// ✅ Safe — delegated event
<button r-click={(e) => handleClick(e)}>Click me</button>
<input r-input={(e) => name.value = e.target.value} />
<form r-submit={(e) => { e.preventDefault(); save(); }}>

// ❌ Blocked — inline handlers
<button onclick="alert('xss')">Click</button>
```

**Available events:** `r-click`, `r-input`, `r-change`, `r-submit`, `r-keydown`, `r-keyup`, `r-focus`, `r-blur`, `r-mouseover`, `r-mouseout`, and any standard DOM event with the `r-` prefix.

### The Rendering Pipeline

```
1. nixState changes     → marks fiber as dirty
2. Scheduler queues     → prioritizes (immediate > high > normal > low > idle)
3. Work loop processes  → time-sliced to avoid blocking
4. Commit phase         → all DOM mutations in one synchronous pass
5. Effects run          → nixEffect callbacks execute after commit
```

### Batch Updates

Multiple state changes in one handler are automatically batched:

```tsx
function handleReset() {
  // These trigger ONE re-render, not three
  name.value = "";
  count.value = 0;
  items.value = [];
}
```

You can also explicitly batch:

```tsx
import { batchUpdates } from "fynixui";

batchUpdates(() => {
  stateA.value = 1;
  stateB.value = 2;
  // Single re-render after both updates
});
```

---

## The `h()` Function

Under the hood, JSX compiles to `h()` calls:

```tsx
// JSX:
<div id="app">
  <MyComponent name="Alice" />
  Hello
</div>;

// Compiles to:
h("div", { id: "app" }, h(MyComponent, { name: "Alice" }), "Hello");
```

You can use `h()` directly if you prefer:

```tsx
import { h, VNode } from "fynixui";

function App(): VNode {
  return h(
    "div",
    { class: "app" },
    h("h1", null, "Hello World"),
    h("p", null, "Built with Fynix")
  );
}
```

### Fragment

Use `Fragment` to return multiple elements without a wrapper:

```tsx
import { Fragment, VNode } from "fynixui";

function List(): VNode {
  return (
    <>
      <li>Item 1</li>
      <li>Item 2</li>
    </>
  );
}
```

---

**Next:** [Project 1: Todo App →](./04-project-todo-app.md)
