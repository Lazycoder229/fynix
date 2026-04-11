type Priority = "immediate" | "high" | "normal" | "low" | "idle";
type EffectTag = "PLACEMENT" | "UPDATE" | "DELETION" | null;
interface FynixFiber {
  type: string | symbol | ComponentFunction;
  props: VNodeProps;
  key: string | number | null;
  child: FynixFiber | null;
  sibling: FynixFiber | null;
  parent: FynixFiber | null;
  alternate: FynixFiber | null;
  effectTag: EffectTag;
  updatePriority: Priority;
  _domNode: Node | null;
  ctx: ComponentContext | null;
  _vnode: VNode | null;
}
export type VNodeType = string | symbol | ComponentFunction;
export type VNodeChild = VNode | string | number | boolean | null | undefined;
export type VNodeChildren = VNodeChild | VNodeChild[];
export interface VNodeProps {
  children?: VNode[];
  key?: string | number | null;
  [key: string]: any;
}
export interface VNode {
  type: VNodeType;
  props: VNodeProps;
  key: string | number | null;
  _domNode?: Node | null;
  _fiber?: FynixFiber | null;
  _rendered?: VNode | null;
  _fragmentStart?: Node | null;
  _fragmentEnd?: Node | null;
  _state?: ReactiveState<any> | null;
  _cleanup?: (() => void) | null;
}
export interface ComponentFunction {
  (props: any): VNode | Promise<VNode>;
}
interface ReactiveState<T> {
  value: T;
  _isNixState: boolean;
  subscribe(callback: () => void): () => void;
}
interface ComponentContext {
  hooks: any[];
  hookIndex: number;
  effects: Array<() => void | (() => void)>;
  cleanups: Array<() => void>;
  _vnode: VNode | null;
  _fiber: FynixFiber | null;
  _accessedStates: Set<ReactiveState<any>>;
  _subscriptions: Set<ReactiveState<any>>;
  _subscriptionCleanups: Array<() => void>;
  version: number;
  rerender: (() => void) | null;
  Component: ComponentFunction;
  _isMounted: boolean;
  _isRerendering: boolean;
  _rerenderTimeout: ReturnType<typeof setTimeout> | null;
}
import { Button, Path } from "./custom/index";
import { nixAsync } from "./hooks/nixAsync";
import { nixAsyncCached } from "./hooks/nixAsyncCache";
import { nixAsyncDebounce } from "./hooks/nixAsyncDebounce";
import { nixAsyncQuery } from "./hooks/nixAsyncQuery";
import { nixCallback } from "./hooks/nixCallback";
import { nixComputed } from "./hooks/nixComputed";
import { nixDebounce } from "./hooks/nixDebounce";
import { nixEffect, nixEffectAlways, nixEffectOnce } from "./hooks/nixEffect";
import { nixForm } from "./hooks/nixForm";
import { nixFormAsync } from "./hooks/nixFormAsync";
import { nixInterval } from "./hooks/nixInterval";
import { nixLazy, Suspense } from "./hooks/nixLazy";
import { nixLazyAsync } from "./hooks/nixLazyAsync";
import { nixLazyFormAsync } from "./hooks/nixLazyFormAsync";
import { nixLocalStorage } from "./hooks/nixLocalStorage";
import { nixMemo } from "./hooks/nixMemo";
import { nixPrevious } from "./hooks/nixPrevious";
import { nixRef } from "./hooks/nixRef";
import { nixState } from "./hooks/nixState";
import { nixStore } from "./hooks/nixStore";
import createFynix from "./router/router";
type AsyncBatchingStore = {
  isBatching: boolean;
  callbacks: Array<() => void>;
};
export declare function batchUpdates(fn: () => void): void;
export declare function isCurrentlyBatching(): boolean;
export interface ErrorHandlerConfig {
  onRenderError?: (error: Error, component?: ComponentFunction) => boolean;
  onAsyncError?: (error: Error) => boolean;
  onCommitError?: (error: Error, fiber?: FynixFiber) => boolean;
  logToConsole?: boolean;
  showOverlay?: boolean;
}
export declare function configureErrorHandling(
  config: Partial<ErrorHandlerConfig>
): void;
export declare function getErrorConfig(): ErrorHandlerConfig;
export interface PerformanceProfileConfig {
  enabled?: boolean;
  logMeasurements?: boolean;
  slowRenderThreshold?: number;
  onMetrics?: (metrics: PerformanceMetrics) => void;
}
export interface PerformanceMetrics {
  renderTime: number;
  commitTime: number;
  totalTime: number;
  updateCount: number;
  fiberCount: number;
  componentName?: string;
  timestamp: number;
}
export declare function enablePerformanceProfiling(
  config: PerformanceProfileConfig
): void;
export declare function getPerfConfig(): PerformanceProfileConfig;
export declare const TEXT: unique symbol;
export declare const Fragment: unique symbol;
export declare const BOOLEAN_ATTRS: Set<string>;
export declare const DOM_PROPERTIES: Set<string>;
export declare const DANGEROUS_HTML_PROPS: Set<string>;
export declare const DANGEROUS_PROTOCOLS: Set<string>;
export declare const SAFE_PROTOCOLS: Set<string>;
export declare function createTextVNode(text: any): VNode;
export declare function h(
  type: VNodeType,
  props?: VNodeProps | null,
  ...children: VNodeChildren[]
): VNode;
export declare namespace h {
  var Fragment: ({ children }: { children?: VNode[] }) => VNode[];
}
export declare const Fynix: typeof h;
declare class FiberReconciler {
  private wipRoot;
  private wipEntry;
  private nextWork;
  private deletions;
  mountRoot(vnode: VNode, container: Element): void;
  scheduleUpdate(fiber: FynixFiber, priority?: Priority): void;
  private scheduleRender;
  private workLoop;
  private performWork;
  private updateComponentFiber;
  private updateHostFiber;
  private reconcileChildren;
  private commitRoot;
  private commitWork;
  private commitDeletion;
  private unmountFiber;
  private runEffects;
  private vnodeToFiber;
  private cloneFiber;
  private findDomParent;
  private findNearestDom;
  private findNextDomSibling;
}
declare const fiberReconciler: FiberReconciler;
export declare const __debug__: {
  getSchedulerState: () => {
    isScheduled: boolean;
    isWorking: boolean;
    currentPriority: Priority;
    queueSize: number;
    batchedUpdatesSize: number;
    idCounter: number;
  };
  getQueueMetrics: () => {
    pending: number;
    batched: number;
    isActive: boolean;
    currentPriority: Priority;
  };
  getFiberReconciler: () => FiberReconciler;
  getErrorConfig: () => ErrorHandlerConfig;
  getPerfConfig: () => PerformanceProfileConfig;
  collectGarbage: () => void;
  clearSchedulerQueue: () => void;
  getAsyncContext: () => {
    currentBatchStore: AsyncBatchingStore | null;
    batchingStorageAvailable: boolean;
  };
};
declare class HierarchicalStore {
  private root;
  private selectorCache;
  private stateSnapshot;
  select<T>(selector: (state: any) => T): T;
  optimisticUpdate<T>(
    path: string,
    update: T,
    onRollback?: () => void
  ): {
    commit: () => void;
    rollback: () => void;
  };
  private set;
}
export declare function useHierarchicalStore(): HierarchicalStore;
declare function mount(
  AppComponent: ComponentFunction,
  root: string | Element,
  props?: any
): void;
declare function hydrate(
  AppComponent: ComponentFunction,
  root: string | Element,
  props?: any
): void;
export declare function memo(
  Component: ComponentFunction,
  propsAreEqual?: (oldProps: any, newProps: any) => boolean
): ComponentFunction;
export declare function renderComponent(
  Component: ComponentFunction,
  props?: any
): VNode;
export declare function ErrorBoundary({
  fallback,
  children,
}: {
  fallback: (error: Error) => VNode;
  children?: VNode[];
}): VNode;
export {
  Button,
  createFynix,
  nixAsync,
  nixAsyncCached,
  nixAsyncDebounce,
  nixAsyncQuery,
  nixCallback,
  nixComputed,
  nixDebounce,
  nixEffect,
  nixEffectAlways,
  nixEffectOnce,
  nixForm,
  nixFormAsync,
  nixInterval,
  nixLazy,
  nixLazyAsync,
  nixLazyFormAsync,
  nixLocalStorage,
  nixMemo,
  nixPrevious,
  nixRef,
  nixState,
  nixStore,
  Path,
  Suspense,
  mount,
  hydrate,
  fiberReconciler,
};
