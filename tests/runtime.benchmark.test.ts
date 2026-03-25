import { describe, it, expect } from "vitest";
import {
  h,
  renderComponent,
  batchUpdates,
  isCurrentlyBatching,
  useFiberRenderer,
  useHierarchicalStore,
  memo,
  createTextVNode,
  Fynix,
} from "../runtime";
import { nixState } from "../hooks/nixState";

/**
 * Runtime Performance Benchmarks
 * Tests core rendering, batching, and state management performance
 *
 * Note: These are structured as regular tests but focus on performance
 * Run with: npm run benchmark
 */

describe("Runtime Performance Tests", () => {
  describe("VNode Creation Performance", () => {
    it("should create simple text vnode efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        createTextVNode("Hello World");
      }
      const duration = performance.now() - start;
      console.log(`Create 1000 text vnodes: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should create simple element vnodes efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        h("div", { className: "test" }, "Hello");
      }
      const duration = performance.now() - start;
      console.log(`Create 1000 element vnodes: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should create nested vnodes (5 levels deep) efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        h(
          "div",
          { id: "root" },
          h(
            "section",
            {},
            h("article", {}, h("p", {}, h("span", {}, "Content")))
          )
        );
      }
      const duration = performance.now() - start;
      console.log(`Create 500 nested vnodes: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should create vnodes with 10 props efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        h("div", {
          className: "test",
          id: "test-id",
          "data-test": "value",
          "data-count": 10,
          "data-active": true,
          "data-value": "string value",
          "data-object": { key: "value" },
          title: "Test Title",
          style: { color: "red", fontSize: "16px" },
          onClick: () => {},
        });
      }
      const duration = performance.now() - start;
      console.log(`Create 1000 vnodes with props: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(150);
    });

    it("should create component vnodes efficiently", () => {
      const Component = (props: any) => h("div", {}, props.children);
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        h(Component, { prop1: "value1", prop2: 123 }, "Child content");
      }
      const duration = performance.now() - start;
      console.log(`Create 1000 component vnodes: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(150);
    });

    it("should create array of 100 vnodes efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        const nodes = Array.from({ length: 100 }, (_, j) =>
          h("div", { key: j }, `Item ${j}`)
        );
      }
      const duration = performance.now() - start;
      console.log(`Create 10 arrays of 100 vnodes: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Batching Performance", () => {
    it("should batch 10 function calls efficiently", () => {
      const start = performance.now();
      for (let iter = 0; iter < 100; iter++) {
        let count = 0;
        batchUpdates(() => {
          for (let i = 0; i < 10; i++) {
            count++;
          }
        });
      }
      const duration = performance.now() - start;
      console.log(`Batch 100x10 calls: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it("should batch 100 function calls efficiently", () => {
      const start = performance.now();
      for (let iter = 0; iter < 10; iter++) {
        let count = 0;
        batchUpdates(() => {
          for (let i = 0; i < 100; i++) {
            count++;
          }
        });
      }
      const duration = performance.now() - start;
      console.log(`Batch 10x100 calls: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it("should handle nested batch updates (10 levels)", () => {
      const start = performance.now();
      for (let iter = 0; iter < 10; iter++) {
        let count = 0;
        batchUpdates(() => {
          count++;
          for (let i = 0; i < 10; i++) {
            batchUpdates(() => {
              count++;
            });
          }
        });
      }
      const duration = performance.now() - start;
      console.log(`Nested batch 10 levels x10: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should check batching status efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 1000000; i++) {
        isCurrentlyBatching();
      }
      const duration = performance.now() - start;
      console.log(`Check batching status 1M times: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });
  });

  describe("Fiber Rendering Performance", () => {
    const setupContainer = (): HTMLElement => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      return container;
    };

    const cleanupContainer = (container: HTMLElement) => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    it("should render simple text component efficiently", () => {
      const SimpleComponent = () => h("div", {}, "Hello World");
      const start = performance.now();

      for (let i = 0; i < 10; i++) {
        const container = setupContainer();
        try {
          renderComponent(SimpleComponent, container);
        } finally {
          cleanupContainer(container);
        }
      }
      const duration = performance.now() - start;
      console.log(`Render simple component 10 times: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should render nested elements efficiently", () => {
      const NestedComponent = () =>
        h(
          "div",
          { className: "container" },
          h("header", {}, h("h1", {}, "Title")),
          h("main", {}, h("section", {}, h("p", {}, "Content paragraph"))),
          h("footer", {}, "Footer text")
        );

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        const container = setupContainer();
        try {
          renderComponent(NestedComponent, container);
        } finally {
          cleanupContainer(container);
        }
      }
      const duration = performance.now() - start;
      console.log(`Render nested component 10 times: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should render list of 50 items efficiently", () => {
      const ListComponent = () =>
        h(
          "ul",
          {},
          Array.from({ length: 50 }, (_, i) => h("li", { key: i }, `Item ${i}`))
        );

      const start = performance.now();
      for (let i = 0; i < 5; i++) {
        const container = setupContainer();
        try {
          renderComponent(ListComponent, container);
        } finally {
          cleanupContainer(container);
        }
      }
      const duration = performance.now() - start;
      console.log(`Render 50-item list 5 times: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should render with multiple props efficiently", () => {
      const PropsComponent = () =>
        h("div", {
          id: "test",
          className: "active",
          title: "Test Component",
          "data-value": 123,
        });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const container = setupContainer();
        try {
          renderComponent(PropsComponent, container);
        } finally {
          cleanupContainer(container);
        }
      }
      const duration = performance.now() - start;
      console.log(
        `Render multi-prop component 100 times: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(2000);
    });
  });

  describe("State Management Performance", () => {
    it("should work with state in component context", () => {
      // nixState can only be called within component functions
      // Testing through component creation instead
      const Component = () => {
        const state = nixState(0);
        return h("div", {}, state.value);
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const container = document.createElement("div");
        document.body.appendChild(container);
        try {
          renderComponent(Component, container);
        } finally {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      }
      const duration = performance.now() - start;
      console.log(`Render 100 components with state: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should render multiple components with state", () => {
      const Counter = () => {
        const count = nixState(0);
        return h("div", {}, `Count: ${count.value}`);
      };

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        const container = document.createElement("div");
        document.body.appendChild(container);
        try {
          renderComponent(Counter, container);
        } finally {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      }
      const duration = performance.now() - start;
      console.log(
        `Render 50 components with state hooks: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(500);
    });
  });

  describe("Memoization Performance", () => {
    it("should create memoized component efficiently", () => {
      const Component = () => h("div", {}, "Content");
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const MemoizedComponent = memo(Component);
      }
      const duration = performance.now() - start;
      console.log(`Create 1000 memoized components: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should memoized component with props compare", () => {
      const Component = (props: any) =>
        h("div", {}, props.count, props.active, props.title);
      const MemoizedComponent = memo(Component);

      const props = { count: 10, active: true, title: "Test" };
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        MemoizedComponent(props);
        MemoizedComponent(props);
      }
      const duration = performance.now() - start;
      console.log(
        `Memoized component with same props 2000 times: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(100);
    });

    it("should memoized component with changed props", () => {
      const Component = (props: any) => h("div", {}, props.count);
      const MemoizedComponent = memo(Component);

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        MemoizedComponent({ count: i });
      }
      const duration = performance.now() - start;
      console.log(
        `Memoized component with changed props 1000 times: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(200);
    });
  });

  describe("Store Performance", () => {
    it("should create hierarchical store efficiently", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const store = useHierarchicalStore();
      }
      const duration = performance.now() - start;
      console.log(`Create 1000 store instances: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should access store methods efficiently", () => {
      const store = useHierarchicalStore();
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const selector = (state: any) => state;
        store.select(selector);
      }
      const duration = performance.now() - start;
      console.log(`Call store.select 1000 times: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should handle optimistic updates efficiently", () => {
      const store = useHierarchicalStore();
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const update = store.optimisticUpdate(`test-${i}`, { value: i });
        update.commit();
      }
      const duration = performance.now() - start;
      console.log(`Optimistic updates 100 times: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Complex Scenarios", () => {
    it("should render component tree with state and memoization", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const MemoComponent = memo((props: any) =>
        h("div", { className: props.active ? "active" : "" }, props.label)
      );

      const App = () =>
        h(
          "div",
          { className: "app" },
          ...Array.from({ length: 10 }, (_, i) =>
            h(MemoComponent, {
              key: i,
              active: i % 2 === 0,
              label: `Item ${i}`,
            })
          )
        );

      const start = performance.now();
      try {
        renderComponent(App, container);
      } finally {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
      const duration = performance.now() - start;
      console.log(`Render memoized component tree: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should batch updates with nested components", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const Counter = (props: any) => {
        return h("div", { className: "counter" }, props.count.toString());
      };

      const start = performance.now();
      try {
        batchUpdates(() => {
          for (let i = 0; i < 5; i++) {
            renderComponent(() => h(Counter, { count: i }), container);
          }
        });
      } finally {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
      const duration = performance.now() - start;
      console.log(`Batch render 5 components: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should create and render large component tree (100 nodes)", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const TreeComponent = () => {
        const createNodes = (depth: number, maxDepth: number = 3): any[] => {
          if (depth > maxDepth) return [];
          return Array.from(
            { length: Math.min(10, 100 / (maxDepth + 1)) },
            (_, i) =>
              h(
                "div",
                { key: `${depth}-${i}`, className: `level-${depth}` },
                ...createNodes(depth + 1, maxDepth)
              )
          );
        };

        return h("div", { id: "tree-root" }, ...createNodes(0));
      };

      const start = performance.now();
      try {
        renderComponent(TreeComponent, container);
      } finally {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
      const duration = performance.now() - start;
      console.log(`Render 100-node tree: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
    });

    it("should render complex component with state management", () => {
      const ComplexComponent = () => {
        const count = nixState(0);
        const active = nixState(false);
        return h(
          "div",
          { className: "complex" },
          h("p", {}, `Count: ${count.value}`),
          h("p", {}, `Active: ${active.value ? "yes" : "no"}`)
        );
      };

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        const container = document.createElement("div");
        document.body.appendChild(container);
        try {
          renderComponent(ComplexComponent, container);
        } finally {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      }
      const duration = performance.now() - start;
      console.log(
        `Render complex component with multiple states 10 times: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(500);
    });
  });
});
