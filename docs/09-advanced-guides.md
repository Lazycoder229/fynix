# Advanced Guides

Techniques for building production-grade Fynix applications.

---

## State Management Patterns

### Pattern 1: Local Component State

Use `nixState` for state that belongs to a single component:

```tsx
function Counter(): VNode {
  const count = nixState(0); // Only this component re-renders
  return <button r-click={() => count.value++}>{count}</button>;
}
```

### Pattern 2: Global Shared State

Use `nixStore` when multiple components need the same data:

```tsx
// In any component:
const theme = nixStore("app.theme", "light");

// In another component — same store instance:
const theme = nixStore("app.theme", "light");
// Both components stay synced automatically
```

### Pattern 3: Derived State

Use `nixComputed` to avoid duplicating logic:

```tsx
// ❌ Bad: duplicated filter logic
const activeItems = nixState(items.value.filter((i) => i.active));

// ✅ Good: derived from source of truth
const activeItems = nixComputed(() => items.value.filter((i) => i.active));
```

### Pattern 4: Persistent State

Use `nixLocalStorage` for data that survives page reloads:

```tsx
const preferences = nixLocalStorage("prefs", { fontSize: 14, theme: "dark" });
preferences.set({ ...preferences.value, fontSize: 16 });
```

---

## Performance Optimization

### 1. Memoize Expensive Computations

```tsx
const sorted = nixMemo(
  () => [...largeArray].sort((a, b) => a.name.localeCompare(b.name)),
  [largeArray]
);
```

### 2. Memoize Callbacks Passed to Children

```tsx
// ❌ New function every render — child re-renders needlessly
<ChildComponent onSave={() => save(id)} />;

// ✅ Stable reference — child skips re-render
const onSave = nixCallback(() => save(id), [id]);
<ChildComponent onSave={onSave} />;
```

### 3. Debounce High-Frequency Updates

```tsx
const debouncedSearch = nixDebounce((query) => {
  results.value = search(query);
}, 300);

<input r-input={(e) => debouncedSearch(e.target.value)} />;
```

### 4. Lazy Load Heavy Components

```tsx
const HeavyChart = nixLazy(() => import("./Chart"));

<Suspense fallback={<Spinner />}>
  <HeavyChart data={chartData} />
</Suspense>;
```

### 5. Use Batch Updates for Multiple Changes

```tsx
batchUpdates(() => {
  items.value = newItems;
  count.value = newItems.length;
  lastUpdate.value = Date.now();
  // Single re-render for all three
});
```

### 6. Monitor with Performance Profiling

```tsx
enablePerformanceProfiling({
  enabled: true,
  slowRenderThreshold: 16.67,
  onMetrics: (m) => {
    if (m.totalTime > 16.67) console.warn("Slow render:", m);
  },
});
```

---

## Reusable Component Patterns

### Composition Pattern

```tsx
function Layout(props: { header: VNode; children: VNode[] }): VNode {
  return (
    <div class="layout">
      <header>{props.header}</header>
      <main>{props.children}</main>
    </div>
  );
}

// Usage
<Layout header={<NavBar />}>
  <Dashboard />
</Layout>;
```

### Higher-Order Component Pattern

```tsx
function withLoading(Component: ComponentFunction) {
  return function Wrapped(props: any): VNode {
    const loading = nixState(true);
    nixEffectOnce(() => {
      setTimeout(() => (loading.value = false), 500);
    });

    if (loading.value) return <p>Loading...</p>;
    return <Component {...props} />;
  };
}

const SafeDashboard = withLoading(Dashboard);
```

---

## Project Structure (Recommended)

```
src/
├── components/          ← Shared reusable components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Modal.tsx
├── hooks/               ← Custom hooks
│   └── useAuth.ts
├── stores/              ← Global state definitions
│   └── authStore.ts
├── home/
│   └── view.tsx         ← Route: /
├── dashboard/
│   ├── view.tsx         ← Route: /dashboard
│   └── [id]/
│       └── view.tsx     ← Route: /dashboard/:id
├── settings/
│   └── view.tsx         ← Route: /settings
├── styles/
│   └── global.css
└── main.ts              ← Entry point
```

---

**Next:** [Best Practices →](./10-best-practices.md)
