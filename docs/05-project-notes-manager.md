# Project 2: Notes Manager (Intermediate)

Build a multi-feature Notes Manager to learn forms, localStorage persistence, and routing.

---

## What You'll Build

- Create, edit, and delete notes
- Persist notes to localStorage
- Search/filter notes
- Form validation
- Multi-page layout with routing

## What You'll Learn

- `nixForm` for form handling and validation
- `nixLocalStorage` for persistence
- `nixRef` for DOM access
- `nixDebounce` for search optimization
- Router navigation with `navigate()`

---

## Step 1: Data Model and State

Create `src/notes/view.tsx`:

```tsx
import { nixState, nixLocalStorage, nixComputed, For, VNode } from "fynixui";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export default function NotesManager(): VNode {
  // Persist notes to localStorage automatically
  const notes = nixLocalStorage<Note[]>("app-notes", []);
  const searchQuery = nixState("");

  const filteredNotes = nixComputed(() => {
    const query = searchQuery.value.toLowerCase();
    if (!query) return notes.value;
    return notes.value.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  });

  return (
    <div class="notes-app">
      <h1>📒 Notes Manager</h1>
      <p>{filteredNotes.value.length} notes</p>
    </div>
  );
}
```

**Concept introduced:** `nixLocalStorage` works like `nixState` but automatically persists to `localStorage`. When the page reloads, your notes are still there.

---

## Step 2: Note Creation with Form Validation

```tsx
import { nixForm } from "fynixui/hooks/nixForm";

// Inside NotesManager component:
const form = nixForm(
  { title: "", content: "" },
  {
    title: {
      required: true,
      minLength: 2,
      message: "Title is required (min 2 chars)",
    },
    content: {
      required: true,
      minLength: 5,
      message: "Content is required (min 5 chars)",
    },
  }
);

function createNote() {
  form.handleSubmit(async (values) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: values.title,
      content: values.content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notes.set([newNote, ...notes.value]);
    form.reset();
  });
}
```

**Form JSX:**

```tsx
<form
  r-submit={(e: any) => {
    e.preventDefault();
    createNote();
  }}
>
  <div class="field">
    <input
      type="text"
      placeholder="Note title"
      {...form.getFieldProps("title")}
    />
    {form.errors.value.title && (
      <span class="error">{form.errors.value.title}</span>
    )}
  </div>
  <div class="field">
    <textarea
      placeholder="Write your note..."
      {...form.getFieldProps("content")}
    />
    {form.errors.value.content && (
      <span class="error">{form.errors.value.content}</span>
    )}
  </div>
  <button type="submit" disabled={form.isSubmitting.value}>
    {form.isSubmitting.value ? "Saving..." : "Save Note"}
  </button>
</form>
```

**Concept introduced:** `nixForm` provides reactive form state, validation, error tracking, and submit handling with AbortController support. `getFieldProps()` returns `value`, `r-input`, and `r-blur` bindings for each field.

---

## Step 3: Search with Debouncing

```tsx
import { nixDebounce } from "fynixui/hooks/nixDebounce";

// Inside the component:
const debouncedSearch = nixDebounce((value: string) => {
  searchQuery.value = value;
}, 300);

// In JSX:
<input
  type="search"
  placeholder="Search notes..."
  r-input={(e: any) => debouncedSearch(e.target.value)}
/>;
```

**Concept introduced:** `nixDebounce` delays execution until the user stops typing for 300ms, preventing excessive re-renders during fast typing.

---

## Step 4: Edit and Delete Notes

```tsx
const editingId = nixState<string | null>(null);

function deleteNote(id: string) {
  notes.set(notes.value.filter((n) => n.id !== id));
}

function updateNote(id: string, title: string, content: string) {
  notes.set(
    notes.value.map((n) =>
      n.id === id ? { ...n, title, content, updatedAt: Date.now() } : n
    )
  );
  editingId.value = null;
}
```

**Note list JSX:**

```tsx
<div class="notes-grid">
  <For each={filteredNotes.value}>
    {(note) => (
      <div key={note.id} class="note-card">
        {editingId.value === note.id ? (
          <NoteEditor
            note={note}
            onSave={updateNote}
            onCancel={() => (editingId.value = null)}
          />
        ) : (
          <div>
            <h3>{note.title}</h3>
            <p>{note.content}</p>
            <small>{new Date(note.updatedAt).toLocaleDateString()}</small>
            <div class="actions">
              <button r-click={() => (editingId.value = note.id)}>
                ✏️ Edit
              </button>
              <button r-click={() => deleteNote(note.id)}>🗑️ Delete</button>
            </div>
          </div>
        )}
      </div>
    )}
  </For>
</div>
```

---

## Step 5: NoteEditor Subcomponent

```tsx
interface NoteEditorProps {
  note: Note;
  onSave: (id: string, title: string, content: string) => void;
  onCancel: () => void;
}

function NoteEditor(props: NoteEditorProps): VNode {
  const title = nixState(props.note.title);
  const content = nixState(props.note.content);

  return (
    <div class="note-editor">
      <input
        value={title.value}
        r-input={(e: any) => (title.value = e.target.value)}
      />
      <textarea
        value={content.value}
        r-input={(e: any) => (content.value = e.target.value)}
      />
      <button
        r-click={() => props.onSave(props.note.id, title.value, content.value)}
      >
        💾 Save
      </button>
      <button r-click={props.onCancel}>Cancel</button>
    </div>
  );
}
```

**Concept introduced:** Passing callbacks as props between parent and child components.

---

**Key takeaways:**

- `nixLocalStorage` for persistence across page reloads
- `nixForm` for validated form handling with async submit
- `nixDebounce` for performance-optimized search
- Component composition with props and callbacks

---

**Next:** [Project 3: Dashboard →](./06-project-dashboard.md)
