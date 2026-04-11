# Best Practices

Conventions and patterns for writing clean, maintainable Fynix code.

---

## Folder Structure

```
src/
├── components/          ← Shared, reusable UI components
├── hooks/               ← Custom hooks (useAuth, useTheme, etc.)
├── stores/              ← Global store definitions
├── styles/              ← CSS files
├── utils/               ← Pure utility functions
├── [route-name]/        ← File-based routes
│   └── view.tsx
└── main.ts              ← Entry point
```

**Rules:**

- One component per file
- Routes use folder-based naming (`/about/view.tsx` → `/about`)
- Dynamic routes use brackets (`/users/[id]/view.tsx` → `/users/:id`)
- Shared components go in `components/`, not route folders

---

## Naming Conventions

| Item            | Convention                  | Example                       |
| --------------- | --------------------------- | ----------------------------- |
| Components      | PascalCase                  | `UserProfile`, `StatCard`     |
| Hook functions  | camelCase with `nix` prefix | `nixState`, `nixEffect`       |
| Custom hooks    | camelCase with `use` prefix | `useAuth`, `useTheme`         |
| State variables | camelCase                   | `isLoading`, `currentUser`    |
| Event handlers  | camelCase with `handle`     | `handleClick`, `handleSubmit` |
| Files           | PascalCase for components   | `UserProfile.tsx`             |
| Route files     | `view.tsx`                  | `src/about/view.tsx`          |
| Interfaces      | PascalCase                  | `UserProps`, `TodoItem`       |

---

## Clean Code Tips

### 1. Keep Components Small

```tsx
// ❌ Bad: 200-line monolith component
function Dashboard(): VNode {
  // ... 200 lines of mixed logic and UI
}

// ✅ Good: decomposed into focused components
function Dashboard(): VNode {
  return (
    <Layout>
      <StatsRow />
      <ActivityFeed />
      <RecentOrders />
    </Layout>
  );
}
```

### 2. Extract Custom Hooks

```tsx
// ❌ Bad: logic mixed into component
function Profile(): VNode {
  const user = nixState(null);
  const loading = nixState(true);
  nixEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => {
        user.value = u;
        loading.value = false;
      });
  }, []);
  // ...
}

// ✅ Good: extracted into reusable hook
function useCurrentUser() {
  const user = nixState(null);
  const loading = nixState(true);
  nixEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => {
        user.value = u;
        loading.value = false;
      });
  }, []);
  return { user, loading };
}

function Profile(): VNode {
  const { user, loading } = useCurrentUser();
  // Clean, focused on UI
}
```

### 3. Always Type Your Props

```tsx
// ❌ Bad
function Card(props: any): VNode { ... }

// ✅ Good
interface CardProps {
  title: string;
  children?: VNode[];
  variant?: "default" | "highlighted";
}
function Card(props: CardProps): VNode { ... }
```

### 4. Always Clean Up Effects

```tsx
nixEffect(() => {
  const handler = (e: Event) => { ... };
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler); // ← always clean up
}, []);
```

### 5. Use Immutable State Updates

```tsx
// ❌ Bad: mutates in place (won't trigger re-render)
todos.value.push(newTodo);

// ✅ Good: creates new array
todos.value = [...todos.value, newTodo];
```

---

## Performance Tips

1. **Use `nixComputed`** instead of recalculating in renders
2. **Use `nixMemo`** for expensive calculations
3. **Use `nixCallback`** when passing functions to child components
4. **Use `nixDebounce`** on search/input handlers
5. **Use `nixLazy`** for code-splitting large components
6. **Use `batchUpdates`** when changing multiple states at once
7. **Avoid `nixEffectAlways`** — prefer `nixEffect` with explicit deps

---

## Security Tips

1. **Always use `r-` events** — inline handlers (`onclick`) are blocked
2. **Never use `innerHTML`** — use the VNode API
3. **Trust the framework** — text content is auto-sanitized
4. **Use HTTPS** for all external resources
5. **Add CSP headers** in production:
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'
   ```

---

**Next:** [Common Mistakes →](./11-common-mistakes.md)
