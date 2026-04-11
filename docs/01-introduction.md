# Fynix — Official Documentation

#cd core
npm version patch # or minor/major
git push origin main --tags

> A lightweight, fiber-based reactive UI framework with built-in security and fine-grained reactivity.

---

## What is Fynix?

Fynix is a modern web UI framework built from the ground up on **fiber architecture** and **fine-grained reactivity**. Unlike traditional frameworks that re-render entire component trees on every state change, Fynix surgically updates only the exact components (fibers) that depend on changed state — resulting in dramatically better performance.

**Why Fynix?**

- **Zero Runtime Dependencies** — No supply chain risk. Everything is self-contained.
- **Security Built-in** — XSS protection at the framework level. Dangerous protocols, inline event handlers, and innerHTML are blocked by default.
- **Fiber Architecture** — Time-sliced rendering with priority scheduling ensures your UI stays responsive even under heavy load.
- **Surgical Re-renders** — Only affected fibers update, not entire component trees.
- **Full TypeScript** — Native JSX support with complete type safety.
- **~15KB gzipped** — Tiny bundle, massive capability.

---

## Quick Facts

| Aspect              | Status                  |
| ------------------- | ----------------------- |
| **Build Size**      | ~15KB gzipped           |
| **External Deps**   | 0                       |
| **TypeScript**      | Full support            |
| **Browser Support** | Modern browsers         |
| **Security**        | Built-in XSS protection |
| **License**         | MIT                     |

---

## How Fynix Works (High Level)

```
    JSX / h() calls
         ↓
    VNode Tree (lightweight, immutable)
         ↓
    Fiber Reconciler (builds fiber tree, diffs against previous)
         ↓
    Priority Scheduler (time-sliced work loop)
         ↓
    Commit Phase (all DOM mutations in one synchronous pass)
         ↓
    Browser Paint
```

**Key idea:** State changes (`nixState`) trigger a targeted fiber re-render on the exact component — not a full tree walk. This is what makes Fynix fast.

---

## Who is Fynix For?

- Developers who want **React-like DX** with better performance defaults
- Teams building **security-sensitive** applications
- Anyone who wants a **lightweight** yet powerful framework
- Developers who prefer **TypeScript-first** tooling

---

## What You'll Learn in This Documentation

| Section               | Description                                        |
| --------------------- | -------------------------------------------------- |
| **Getting Started**   | Install, setup, and your first Hello World         |
| **Core Concepts**     | Components, state, effects, rendering              |
| **Project Tutorials** | Build 3 real apps (Todo, Notes Manager, Dashboard) |
| **Components Guide**  | Reusable components used across projects           |
| **API Reference**     | Every function, hook, and method documented        |
| **Advanced Guides**   | State patterns, optimization, project structure    |
| **Best Practices**    | Conventions, naming, folder structure              |
| **Common Mistakes**   | What to avoid and why                              |

---

**Next:** [Getting Started →](./02-getting-started.md)
