# Project 3: Real-Time Dashboard (Advanced)

Build a dynamic dashboard with async data fetching, global state, and routing.

---

## What You'll Build

- Multiple dashboard widgets (stats, charts placeholder, activity feed)
- Async data fetching with loading/error states
- Global store for shared state
- Interval-based data refresh
- Multi-page app with router navigation
- SEO meta tags per route

## What You'll Learn

- `nixAsync` and `nixAsyncCached` for data fetching
- `nixStore` for global state management
- `nixInterval` for periodic updates
- `nixLazy` / `Suspense` for code splitting
- Router with dynamic routes, navigation, and SEO meta

---

## Step 1: App Setup with Router

Create `src/main.ts`:

```typescript
import createFynix from "fynixui/router";

const app = createFynix();
app.mountRouter("#app");
```

Project structure:

```
src/
├── dashboard/
│   └── view.tsx        → /dashboard
├── dashboard/
│   └── [id]/
│       └── view.tsx    → /dashboard/:id (dynamic route)
├── settings/
│   └── view.tsx        → /settings
└── main.ts
```

---

## Step 2: Global State with `nixStore`

Create `src/dashboard/view.tsx`:

```tsx
import {
  nixState,
  nixStore,
  nixInterval,
  nixEffect,
  For,
  VNode,
} from "fynixui";

interface DashboardStats {
  totalUsers: number;
  activeNow: number;
  revenue: number;
  growth: number;
}

export default function Dashboard(): VNode {
  const stats = nixStore<DashboardStats>("dashboard.stats", {
    totalUsers: 0,
    activeNow: 0,
    revenue: 0,
    growth: 0,
  });

  // Simulate real-time data updates every 5 seconds
  nixInterval(() => {
    stats.value = {
      totalUsers: stats.value.totalUsers + Math.floor(Math.random() * 5),
      activeNow: 100 + Math.floor(Math.random() * 50),
      revenue: stats.value.revenue + Math.random() * 100,
      growth: +(Math.random() * 10).toFixed(1),
    };
  }, 5000);

  return (
    <div class="dashboard">
      <h1>📊 Dashboard</h1>
      <div class="stats-grid">
        <StatCard
          label="Total Users"
          value={stats.value.totalUsers}
          icon="👥"
        />
        <StatCard label="Active Now" value={stats.value.activeNow} icon="🟢" />
        <StatCard
          label="Revenue"
          value={`$${stats.value.revenue.toFixed(2)}`}
          icon="💰"
        />
        <StatCard label="Growth" value={`${stats.value.growth}%`} icon="📈" />
      </div>
    </div>
  );
}

// Reusable stat card component
function StatCard(props: { label: string; value: any; icon: string }): VNode {
  return (
    <div class="stat-card">
      <span class="icon">{props.icon}</span>
      <div>
        <p class="value">{props.value}</p>
        <p class="label">{props.label}</p>
      </div>
    </div>
  );
}
```

**Concept introduced:** `nixStore` creates named global reactive state. Multiple components can subscribe to `"dashboard.stats"` and all stay synchronized. `nixInterval` runs a callback repeatedly and auto-cleans on unmount.

---

## Step 3: Async Data Fetching

```tsx
import { nixAsync } from "fynixui/hooks/nixAsync";

function ActivityFeed(): VNode {
  const { data, loading, error, refetch } = nixAsync<any[]>(
    async (signal) => {
      const res = await fetch("/api/activity", { signal });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    [] // deps — refetch when these change
  );

  if (loading.value) return <p>Loading activity...</p>;
  if (error.value)
    return (
      <div>
        <p class="error">Error: {error.value.message}</p>
        <button r-click={refetch}>Retry</button>
      </div>
    );

  return (
    <div class="activity-feed">
      <h2>Recent Activity</h2>
      <For each={data.value || []}>
        {(item: any) => (
          <div key={item.id} class="activity-item">
            <span>{item.action}</span>
            <time>{new Date(item.timestamp).toLocaleString()}</time>
          </div>
        )}
      </For>
    </div>
  );
}
```

**Concept introduced:** `nixAsync` handles async operations with automatic loading/error states and AbortController support. The `signal` parameter enables request cancellation on unmount.

---

## Step 4: Dynamic Routes with Params

Create `src/dashboard/[id]/view.tsx`:

```tsx
import { nixAsync, VNode } from "fynixui";

// Route meta for SEO
export default function DetailView(props: { params: { id: string } }): VNode {
  const { data, loading } = nixAsync(async () => {
    const res = await fetch(`/api/items/${props.params.id}`);
    return res.json();
  }, [props.params.id]);

  if (loading.value) return <p>Loading...</p>;

  return (
    <div>
      <h1>Detail: {props.params.id}</h1>
      <pre>{JSON.stringify(data.value, null, 2)}</pre>
    </div>
  );
}

// SEO metadata — auto-applied by router
DetailView.meta = (params: { id: string }) => ({
  title: `Dashboard - Item ${params.id}`,
  description: `Details for item ${params.id}`,
  ogTitle: `Item ${params.id} | My Dashboard`,
});
```

**Concept introduced:** Dynamic routes use `[param]` folder naming. The router extracts params and passes them to the component. SEO meta tags are auto-managed.

---

## Step 5: Navigation Between Pages

```tsx
import createFynix from "fynixui/router";

function NavBar(): VNode {
  const router = createFynix(); // singleton — safe to call again

  return (
    <nav>
      <button r-click={() => router.navigate("/dashboard")}>Dashboard</button>
      <button r-click={() => router.navigate("/settings")}>Settings</button>
      <button
        r-click={() => router.navigate("/dashboard/42", { source: "nav" })}
      >
        Item 42
      </button>
      <button r-click={() => router.back()}>← Back</button>
    </nav>
  );
}
```

**Router API:**

- `navigate(path, props?)` — Push navigation with optional props
- `replace(path, props?)` — Replace current history entry
- `back()` — Go back in history
- Props are cached and survive browser back/forward

---

**Key takeaways:**

- `nixStore` for global cross-component state
- `nixAsync` for data fetching with loading/error handling
- `nixInterval` for periodic updates with automatic cleanup
- Dynamic routes with `[param]` folders and extracted params
- Route-level SEO metadata

---

**Next:** [Components Guide →](./07-components-guide.md)
