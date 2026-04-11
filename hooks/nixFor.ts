/* MIT License * Copyright (c) 2026 Resty Gonzales */
import { Fragment } from "../runtime.js";
import { VNode } from "../types/fnx";

interface ReactiveState<T> {
  value: T;
  _isNixState: boolean;
  subscribe(callback: () => void): () => void;
}

interface ForProps<T> {
  each: T[] | ReactiveState<T[]>;
  children?:
    | ((item: T, index: number) => VNode)
    | ((item: T, index: number) => VNode)[];
}

export function For<T>(props: ForProps<T>): VNode {
  const isReactive =
    props.each && typeof props.each === "object" && "_isNixState" in props.each;

  //  Access .value while activeContext is live so the runtime
  // automatically tracks this state and re-renders <For> on change.
  const items: T[] = isReactive
    ? (props.each as ReactiveState<T[]>).value // tracked by runtime
    : Array.isArray(props.each)
      ? props.each
      : [];

  let renderer: ((item: T, index: number) => VNode) | undefined;

  if (typeof props.children === "function") {
    renderer = props.children;
  } else if (Array.isArray(props.children)) {
    const first = props.children[0];
    if (typeof first === "function") {
      renderer = first as (item: T, index: number) => VNode;
    }
  }

  if (!renderer) {
    if (items.length > 0) {
      console.warn(
        "[Fynix] <For> expects a function as its child. Received:",
        typeof props.children
      );
    }
    return { type: Fragment, props: { children: [] }, key: null };
  }

  const finalRenderer = renderer;

  const mapped = items.map((item, index) => {
    try {
      const vnode = finalRenderer(item, index);
      // Hoist the key from the rendered vnode up to the mapped entry
      // so your diffing algorithm can track it
      return { ...vnode, key: vnode.key ?? index };
    } catch (error) {
      console.error(`[Fynix] Error rendering item at index ${index}:`, error);
      return {
        type: "div",
        props: { children: ["Error rendering item"], style: "color: red;" },
        key: index,
      } as VNode;
    }
  });

  return { type: Fragment, props: { children: mapped }, key: null };
}
