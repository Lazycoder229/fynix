# Common Mistakes

Avoid these pitfalls when building with Fynix.

---

## 1. Mutating State Directly

```tsx
// ❌ WRONG: Direct mutation — won't trigger re-render
todos.value.push({ id: 1, text: "New", done: false });

// ✅ CORRECT: Create new reference
todos.value = [...todos.value, { id: 1, text: "New", done: false }];
```

**Why:** Fynix uses reference equality (`===`) to detect changes. Mutating an array/object in place keeps the same reference, so Fynix doesn't know it changed.

---

## 2. Using Native Event Handlers

```tsx
// ❌ WRONG: Blocked by Fynix security
<button onclick={() => save()}>Save</button>
<input onchange={(e) => update(e)} />

// ✅ CORRECT: Use r- prefix
<button r-click={() => save()}>Save</button>
<input r-change={(e) => update(e)} />
```

**Why:** Fynix blocks inline event handlers (`onclick`, `onchange`, etc.) to prevent XSS attacks. Use `r-` prefixed delegated events instead.

---

## 3. Calling Hooks Conditionally

```tsx
// ❌ WRONG: Hook order changes between renders
function MyComponent(): VNode {
  if (someCondition) {
    const data = nixState(null); // Hook order breaks!
  }
  const count = nixState(0);
  // ...
}

// ✅ CORRECT: All hooks at the top level
function MyComponent(): VNode {
  const data = nixState(null); // Always called
  const count = nixState(0); // Always called
  // Use conditionals in the return, not around hooks
}
```

**Why:** Hooks use array indices internally. Conditional calls shift indices and cause state corruption.

---

## 4. Forgetting Effect Cleanup

```tsx
// ❌ WRONG: Memory leak — listener never removed
nixEffect(() => {
  window.addEventListener("resize", handleResize);
}, []);

// ✅ CORRECT: Return cleanup function
nixEffect(() => {
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
```

**Why:** Without cleanup, event listeners, timers, and subscriptions accumulate on every re-render, causing memory leaks.

---

## 5. Using innerHTML

```tsx
// ❌ WRONG: Blocked by Fynix security
element.innerHTML = userInput;

// ✅ CORRECT: Use VNode children
<div>{userInput}</div>;
```

**Why:** `innerHTML` is a primary XSS attack vector. Fynix auto-sanitizes text content in VNodes.

---

## 6. Missing Keys in Lists

```tsx
// ❌ WRONG: No keys — poor reconciliation
<For each={items.value}>
  {(item) => <div>{item.name}</div>}
</For>

// ✅ CORRECT: Unique keys for each item
<For each={items.value}>
  {(item) => <div key={item.id}>{item.name}</div>}
</For>
```

**Why:** Without keys, Fynix can't efficiently track which items changed, leading to unnecessary DOM operations and potential bugs with stateful elements.

---

## 7. Calling Hooks Outside Components

```tsx
// ❌ WRONG: nixState requires a component context
const globalCount = nixState(0); // Throws Error!

// ✅ CORRECT: Use nixStore for global state
// Inside a component:
const globalCount = nixStore("app.count", 0);
```

**Why:** `nixState`, `nixEffect`, `nixRef`, etc. require an active component context. They can only be called inside component functions during rendering. Use `nixStore` for module-level shared state.

---

## 8. Over-Using `nixEffectAlways`

```tsx
// ❌ BAD: Runs on every single render
nixEffectAlways(() => {
  console.log("Rendered!");
  fetchData(); // Re-fetches on every render!
});

// ✅ GOOD: Use deps to control when it runs
nixEffect(() => {
  fetchData();
}, [userId]); // Only re-fetches when userId changes
```

**Why:** `nixEffectAlways` fires on every render, which can cause performance issues and infinite loops if it triggers state changes.

---

## 9. Using Dangerous Protocols in URLs

```tsx
// ❌ BLOCKED: javascript: protocol
<a href="javascript:alert('xss')">Click</a>
<img src="data:text/html,<script>..." />

// ✅ ALLOWED: Safe protocols only
<a href="/about">About</a>
<a href="https://example.com">External</a>
<img src="/images/photo.jpg" />
```

**Why:** Fynix blocks `javascript:`, `data:`, `vbscript:`, and `file:` protocols in `href`, `src`, `action`, and `formaction` attributes.

---

## 10. Not Batching Multiple State Updates

```tsx
// ❌ SUBOPTIMAL: Three separate re-renders
name.value = "Alice";
age.value = 30;
role.value = "admin";

// ✅ OPTIMAL: Single re-render
batchUpdates(() => {
  name.value = "Alice";
  age.value = 30;
  role.value = "admin";
});
```

**Why:** Each state change triggers a re-render. Wrapping multiple changes in `batchUpdates` coalesces them into a single render pass.

> **Note:** Event handlers (e.g., `r-click`) automatically batch state changes. Manual batching is mainly needed outside event handlers.

---

**← Back to:** [Table of Contents](./01-introduction.md)
