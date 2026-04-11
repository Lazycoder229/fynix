# Project 1: Todo App (Beginner)

Build a fully functional Todo application to learn the fundamentals of Fynix.

---

## What You'll Build

A todo app with:
- Add new tasks
- Mark tasks as complete
- Delete tasks
- Filter by status (All / Active / Completed)
- Task counter

## What You'll Learn

- `nixState` for reactive data
- `nixComputed` for derived values
- List rendering with `<For>`
- Event handling with `r-click` and `r-input`
- Conditional rendering

---

## Step 1: Project Setup

Create the file `src/home/view.tsx`:

```tsx
import { nixState, VNode } from "fynixui";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function TodoApp(): VNode {
  const todos = nixState<Todo[]>([]);

  return (
    <div class="todo-app">
      <h1>📝 My Todos</h1>
    </div>
  );
}
```

**Concept introduced:** `nixState` with a typed array. We use an interface to define the shape of each todo item.

---

## Step 2: Add Todo Input

```tsx
import { nixState, VNode } from "fynixui";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function TodoApp(): VNode {
  const todos = nixState<Todo[]>([]);
  const input = nixState("");

  function addTodo() {
    const text = input.value.trim();
    if (!text) return;

    todos.value = [
      ...todos.value,
      { id: Date.now(), text, done: false }
    ];
    input.value = "";
  }

  return (
    <div class="todo-app">
      <h1>📝 My Todos</h1>
      <div class="input-row">
        <input
          type="text"
          value={input.value}
          r-input={(e: any) => input.value = e.target.value}
          r-keydown={(e: any) => e.key === "Enter" && addTodo()}
          placeholder="What needs to be done?"
        />
        <button r-click={addTodo}>Add</button>
      </div>
    </div>
  );
}
```

**Concept introduced:** Two-way binding with `r-input`. Notice we update state immutably using spread syntax.

---

## Step 3: Render the Todo List

```tsx
import { nixState, For, VNode } from "fynixui";

// ... (interfaces and state from above)

// Inside the return, after the input-row div:
<ul class="todo-list">
  <For each={todos.value}>
    {(todo, index) => (
      <li key={todo.id} class={todo.done ? "done" : ""}>
        <span r-click={() => toggleTodo(todo.id)}>
          {todo.done ? "✅" : "⬜"} {todo.text}
        </span>
        <button r-click={() => deleteTodo(todo.id)}>🗑️</button>
      </li>
    )}
  </For>
</ul>
```

Add these functions before the return:

```tsx
function toggleTodo(id: number) {
  todos.value = todos.value.map(t =>
    t.id === id ? { ...t, done: !t.done } : t
  );
}

function deleteTodo(id: number) {
  todos.value = todos.value.filter(t => t.id !== id);
}
```

**Concept introduced:** `<For>` component for list rendering. Each item gets a `key` for efficient reconciliation.

---

## Step 4: Add Filtering with `nixComputed`

```tsx
import { nixState, nixComputed, For, VNode } from "fynixui";

type Filter = "all" | "active" | "completed";

export default function TodoApp(): VNode {
  const todos = nixState<Todo[]>([]);
  const input = nixState("");
  const filter = nixState<Filter>("all");

  const filteredTodos = nixComputed(() => {
    switch (filter.value) {
      case "active":    return todos.value.filter(t => !t.done);
      case "completed": return todos.value.filter(t => t.done);
      default:          return todos.value;
    }
  });

  const activeCount = nixComputed(() =>
    todos.value.filter(t => !t.done).length
  );

  // ... addTodo, toggleTodo, deleteTodo functions

  return (
    <div class="todo-app">
      <h1>📝 My Todos</h1>

      {/* Input row (from Step 2) */}

      <div class="filters">
        <button r-click={() => filter.value = "all"}
          class={filter.value === "all" ? "active" : ""}>All</button>
        <button r-click={() => filter.value = "active"}
          class={filter.value === "active" ? "active" : ""}>Active</button>
        <button r-click={() => filter.value = "completed"}
          class={filter.value === "completed" ? "active" : ""}>Done</button>
      </div>

      <ul class="todo-list">
        <For each={filteredTodos.value}>
          {(todo) => (
            <li key={todo.id} class={todo.done ? "done" : ""}>
              <span r-click={() => toggleTodo(todo.id)}>
                {todo.done ? "✅" : "⬜"} {todo.text}
              </span>
              <button r-click={() => deleteTodo(todo.id)}>🗑️</button>
            </li>
          )}
        </For>
      </ul>

      <p class="counter">{activeCount} items left</p>
    </div>
  );
}
```

**Concept introduced:** `nixComputed` creates derived state that auto-updates when its dependencies change. `filteredTodos` recomputes whenever `todos` or `filter` changes.

---

## Complete Code

See the full working code: [TodoApp view.tsx](./examples/todo-app.tsx)

**Key takeaways:**
- `nixState` for mutable reactive data
- `nixComputed` for derived/filtered data
- `<For>` for efficient list rendering
- `r-click` / `r-input` for event handling
- Immutable state updates with spread syntax

---

**Next:** [Project 2: Notes Manager →](./05-project-notes-manager.md)
