# API Reference

Complete reference for all Fynix hooks, functions, and core APIs.

---

## Core

### `h(type, props, ...children)`

Creates a VNode (virtual DOM element).

| Parameter   | Type                           | Description               |
| ----------- | ------------------------------ | ------------------------- |
| `type`      | `string \| symbol \| Function` | Element type or component |
| `props`     | `object \| null`               | Props/attributes          |
| `children`  | `VNodeChildren[]`              | Child elements            |
| **Returns** | `VNode`                        | Virtual DOM node          |

```tsx
h("div", { id: "app" }, h("p", null, "Hello"));
```

### `Fynix`

Alias for `h`. Use as JSX pragma:

```tsx
// tsconfig.json: "jsxFactory": "Fynix"
<div id="app">
  <p>Hello</p>
</div>
```

### `Fragment`

Symbol for grouping elements without a wrapper DOM node.

```tsx
<>
  {child1}
  {child2}
</>
```

### `mount(vnode, container)`

Mounts a VNode tree into a DOM element.

| Parameter   | Type          | Description          |
| ----------- | ------------- | -------------------- |
| `vnode`     | `VNode`       | Root VNode to render |
| `container` | `HTMLElement` | Target DOM container |

```tsx
mount(h(App, null), document.getElementById("app"));
```

### `batchUpdates(fn)`

Batches multiple state updates into a single re-render.

| Parameter | Type         | Description                 |
| --------- | ------------ | --------------------------- |
| `fn`      | `() => void` | Function containing updates |

```tsx
batchUpdates(() => {
  a.value = 1;
  b.value = 2;
});
```

---

## State Hooks

### `nixState<T>(initial): NixState<T>`

Creates reactive state that triggers re-renders on change.

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `initial` | `T`  | Initial value |

**Returns:**

| Property                | Type                 | Description                     |
| ----------------------- | -------------------- | ------------------------------- |
| `.value`                | `T` (get/set)        | Current value                   |
| `.subscribe(fn)`        | `(fn) => () => void` | Subscribe to changes            |
| `.cleanup()`            | `() => void`         | Destroy state and subscriptions |
| `.asReadOnly()`         | `ReadOnlyState<T>`   | Read-only version               |
| `.getSubscriberCount()` | `() => number`       | Number of subscribers           |
| `.isDestroyed()`        | `() => boolean`      | Whether state is destroyed      |

```tsx
const count = nixState(0);
count.value++; // triggers re-render
count.value = 10; // triggers re-render
```

### `nixComputed<T>(computeFn): ComputedState<T>`

Creates derived state that auto-updates when dependencies change.

| Parameter   | Type      | Description          |
| ----------- | --------- | -------------------- |
| `computeFn` | `() => T` | Computation function |

```tsx
const doubled = nixComputed(() => count.value * 2);
console.log(doubled.value); // auto-recomputes
```

### `nixStore<T>(path, initial): StoreState<T>`

Global reactive store accessible by path name across components.

| Parameter | Type     | Description             |
| --------- | -------- | ----------------------- |
| `path`    | `string` | Unique store identifier |
| `initial` | `T`      | Initial value           |

```tsx
const theme = nixStore("app.theme", "dark");
```

### `nixLocalStorage<T>(key, initial)`

Reactive state synced with `localStorage`.

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `key`     | `string` | localStorage key              |
| `initial` | `T`      | Fallback if key doesn't exist |

**Returns:** `{ value: T, set(v): boolean, clear(): void, getSize(): number, isValid(): boolean }`

```tsx
const settings = nixLocalStorage("user-settings", { dark: false });
settings.set({ dark: true }); // persists to localStorage
```

---

## Effect Hooks

### `nixEffect(effect, deps)`

Runs side effects with dependency tracking and cleanup.

| Parameter | Type                         | Description                          |
| --------- | ---------------------------- | ------------------------------------ |
| `effect`  | `() => void \| (() => void)` | Effect function (may return cleanup) |
| `deps`    | `any[]`                      | Dependency array                     |

```tsx
nixEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer); // cleanup
}, []);
```

### `nixEffectOnce(effect)`

Runs effect once on mount. Shorthand for `nixEffect(effect, [])`.

### `nixEffectAlways(effect)`

Runs effect on every render. Use sparingly.

### `nixInterval(callback, ms)`

Runs a callback at an interval with automatic cleanup on unmount.

| Parameter  | Type         | Description              |
| ---------- | ------------ | ------------------------ |
| `callback` | `() => void` | Function to call         |
| `ms`       | `number`     | Interval in milliseconds |

---

## Memoization Hooks

### `nixMemo<T>(factory, deps): T`

Memoizes a computed value. Recomputes only when dependencies change.

| Parameter | Type      | Description            |
| --------- | --------- | ---------------------- |
| `factory` | `() => T` | Value factory function |
| `deps`    | `any[]`   | Dependency array       |

```tsx
const sorted = nixMemo(() => items.sort(compareFn), [items]);
```

### `nixCallback<T>(fn, deps): T`

Memoizes a callback function reference. Prevents unnecessary child re-renders.

| Parameter | Type       | Description         |
| --------- | ---------- | ------------------- |
| `fn`      | `Function` | Callback to memoize |
| `deps`    | `any[]`    | Dependency array    |

```tsx
const handleClick = nixCallback(() => save(id), [id]);
```

### `nixRef<T>(initial): { current: T }`

Mutable ref that persists across renders without triggering re-renders.

```tsx
const inputRef = nixRef<HTMLInputElement>(null);
// After mount: inputRef.current.focus();
```

### `nixPrevious<T>(value): T`

Returns the previous render's value.

```tsx
const prevCount = nixPrevious(count.value);
```

---

## Async Hooks

### `nixAsync<T>(asyncFn, deps)`

Handles async operations with loading/error states.

**Returns:** `{ data, loading, error, refetch }`

```tsx
const { data, loading, error } = nixAsync(async (signal) => {
  const res = await fetch("/api/data", { signal });
  return res.json();
}, []);
```

### `nixAsyncCached<T>(asyncFn, deps)`

Like `nixAsync` but with built-in result caching.

### `nixAsyncDebounce<T>(asyncFn, deps, delay)`

Like `nixAsync` but debounces the execution.

### `nixAsyncQuery<T>(asyncFn, deps)`

Specialized async hook for query/search patterns.

---

## Form Hooks

### `nixForm<T>(initialValues, validationRules)`

Full-featured form handler with validation.

**Returns:**

| Property                     | Description                               |
| ---------------------------- | ----------------------------------------- |
| `values`                     | `NixState<T>` — form values               |
| `errors`                     | `NixState<Errors>` — validation errors    |
| `touched`                    | `NixState<Touched>` — touched fields      |
| `isSubmitting`               | `NixState<boolean>` — submit in progress  |
| `isValid`                    | `ComputedState<boolean>` — form validity  |
| `handleChange(field, value)` | Update a field                            |
| `handleBlur(field)`          | Mark field as touched                     |
| `handleSubmit(onSubmit)`     | Validate and submit                       |
| `cancelSubmit()`             | Abort in-flight submit                    |
| `reset()`                    | Reset form to initial values              |
| `getFieldProps(field)`       | Get `value`, `r-input`, `r-blur` bindings |

```tsx
const form = nixForm(
  { email: "" },
  {
    email: { required: true, pattern: /^\S+@\S+$/, message: "Invalid email" },
  }
);
```

### `nixDebounce(fn, delay)`

Creates a debounced version of a function.

```tsx
const search = nixDebounce((q) => fetchResults(q), 300);
```

---

## Router API

### `createFynix(options?): FynixRouter`

Creates (or returns existing) router instance.

| Option | Type      | Description               |
| ------ | --------- | ------------------------- |
| `lazy` | `boolean` | Enable lazy route loading |

**Returns:**

| Method                  | Description                      |
| ----------------------- | -------------------------------- |
| `mountRouter(selector)` | Mount router to DOM element      |
| `navigate(path, props)` | Push navigation                  |
| `replace(path, props)`  | Replace current entry            |
| `back()`                | Go back in history               |
| `cleanup()`             | Destroy router and all listeners |

### `location` (LocationManager)

Reactive signal for current route information.

| Property        | Type                     | Description          |
| --------------- | ------------------------ | -------------------- |
| `.value.path`   | `string`                 | Current pathname     |
| `.value.params` | `Record<string, string>` | URL parameters       |
| `.value.search` | `string`                 | Query string         |
| `.subscribe()`  | `(cb) => () => void`     | Subscribe to changes |

---

## Lazy Loading

### `nixLazy(importFn): ComponentFunction`

Wraps a dynamic import for code-splitting.

```tsx
const Chart = nixLazy(() => import("./Chart"));
```

### `Suspense`

Shows fallback while lazy components load. See [Components Guide](./07-components-guide.md).

---

## Error Handling

### `configureErrorHandling(config)`

Configure global error behavior.

```tsx
configureErrorHandling({
  onRenderError: (error, component) => {
    log(error);
    return true;
  },
  showOverlay: process.env.NODE_ENV !== "production",
});
```

### `enablePerformanceProfiling(config)`

Enable render performance monitoring.

```tsx
enablePerformanceProfiling({
  enabled: true,
  logMeasurements: true,
  slowRenderThreshold: 16.67,
  onMetrics: (m) => analytics.send(m),
});
```

---

**Next:** [Advanced Guides →](./09-advanced-guides.md)
