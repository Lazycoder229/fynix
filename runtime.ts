/* MIT License
 *
 * Copyright (c) 2026 Resty Gonzales
 *
 * SECURITY NOTICE:
 * This runtime includes built-in XSS protection mechanisms.
 * For additional security, consider implementing:
 * 1. Content Security Policy (CSP) headers
 * 2. Subresource Integrity (SRI) for external scripts
 * 3. Regular security audits of your application code
 * 4. Input validation on the server side
 *
 * CSP Header Example:
 * Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// =============================================================================
// ARCHITECTURE OVERVIEW
// =============================================================================
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  h() / Fynix  →  VNode tree  (lightweight, immutable)   │
//  └────────────────────────────┬────────────────────────────┘
//                               │ mount() / nixState change
//                               ▼
//  ┌─────────────────────────────────────────────────────────┐
//  │  FiberReconciler                                         │
//  │  · builds a FynixFiber tree mirroring the VNode tree    │
//  │  · work loop is time-sliced via FynixScheduler          │
//  │  · yields to higher-priority work between fibers        │
//  │  · commit phase applies all DOM mutations in one pass   │
//  └────────────────────────────┬────────────────────────────┘
//                               │
//       ┌────────────┬──────────┴──────────┬────────────┐
//       ▼            ▼                     ▼            ▼
//   PLACEMENT     UPDATE               DELETION     effect tags
//  createElement  updateProps        removeChild    run cleanups
//
//  Fine-grained reactivity (nixState) triggers a targeted fiber
//  re-render on the exact component fiber — not a full tree walk.
//
//  VNode objects (h() output) are preserved as the public API.
//  The Fiber tree is an internal implementation detail.
//
// =============================================================================

// ---------------------- Types ----------------------

type Priority = "immediate" | "high" | "normal" | "low" | "idle";
type UpdateType = "state" | "props" | "effect" | "layout";

interface Update {
  id: string;
  type: UpdateType;
  priority: Priority;
  component?: ComponentContext;
  callback: () => void;
  timestamp: number;
}

interface PriorityQueue<T> {
  push(item: T, priority: Priority): void;
  pop(): T | undefined;
  peek(): T | undefined;
  size(): number;
  isEmpty(): boolean;
}

interface ReactiveScheduler {
  schedule(update: Update, priority: Priority): void;
  batchUpdates(updates: Update[]): void;
  timeSlice(deadline: number): boolean;
  flush(): void;
}

// EffectTag drives the commit phase — what DOM operation to perform.
type EffectTag = "PLACEMENT" | "UPDATE" | "DELETION" | null;

/**
 * FynixFiber — the internal unit of work.
 *
 * Each fiber corresponds to one VNode. The fiber tree is a linked list
 * (child → sibling → parent) that the work loop walks depth-first.
 * `alternate` points to the fiber from the previous render ("current tree")
 * so we can diff old vs new props without touching the real DOM mid-render.
 */
interface FynixFiber {
  // --- identity ---
  type: string | symbol | ComponentFunction;
  props: VNodeProps;
  key: string | number | null;

  // --- tree links ---
  child: FynixFiber | null;
  sibling: FynixFiber | null;
  parent: FynixFiber | null;

  // --- double-buffering ---
  alternate: FynixFiber | null; // fiber from previous render
  effectTag: EffectTag;
  updatePriority: Priority;

  // --- output ---
  _domNode: Node | null;

  // --- component fibers only ---
  ctx: ComponentContext | null; // hooks + subscriptions live here
  _vnode: VNode | null; // the VNode that spawned this fiber
}

// ---------------------- Public VNode types ----------------------

export type VNodeType = string | symbol | ComponentFunction;
export type VNodeChild = VNode | string | number | boolean | null | undefined;
export type VNodeChildren = VNodeChild | VNodeChild[];

export interface VNodeProps {
  children?: VNode[];
  key?: string | number | null;
  [key: string]: any;
}

/**
 * VNode — the public, user-facing virtual DOM node.
 *
 * Users build trees with h(). Internally each VNode is backed by a FynixFiber.
 * _fiber is set after the first render and used by reactive rerenders to locate
 * the exact fiber that needs updating without a full tree walk.
 */
export interface VNode {
  type: VNodeType;
  props: VNodeProps;
  key: string | number | null;
  // runtime internals — set after first mount
  _domNode?: Node | null;
  _fiber?: FynixFiber | null; // back-reference to the live fiber
  _rendered?: VNode | null;
  _fragmentStart?: Node | null; // Fragment sentinel start text node
  _fragmentEnd?: Node | null; // Fragment sentinel end text node
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

/**
 * ComponentContext — per-component instance state.
 *
 * Lives on the FynixFiber for the duration of the component's life.
 * Carries hooks, reactive subscriptions, and the fiber back-reference
 * so that nixState changes can trigger a targeted fiber re-render.
 */
interface ComponentContext {
  hooks: any[];
  hookIndex: number;
  effects: Array<() => void | (() => void)>;
  cleanups: Array<() => void>;
  _vnode: VNode | null;
  _fiber: FynixFiber | null; // back-ref to owning fiber
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

// ---------------------- Imports ----------------------

import { activeContext, setActiveContext } from "./context/context";
import { Button, Path } from "./custom/index";
import { removeErrorOverlay, showErrorOverlay } from "./error/errorOverlay";
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

// ---------------------- Helpers ----------------------

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

// ---------------------- Batching ----------------------

/**
 * AsyncLocalStorage for batching context — safely handles concurrent async callers.
 * Each async context (fetch, setTimeout, etc.) maintains its own batching state.
 */
type AsyncBatchingStore = {
  isBatching: boolean;
  callbacks: Array<() => void>;
};

// Use (globalThis as any) to handle environments where AsyncLocalStorage may not be typed
let batchingStorage: any = null;

// Polyfill for Node.js < 13 / environments without AsyncLocalStorage
try {
  if (typeof (globalThis as any).AsyncLocalStorage !== "undefined") {
    batchingStorage = new (globalThis as any).AsyncLocalStorage();
  }
} catch {
  // AsyncLocalStorage not available; fallback to simple sync batching
}

/**
 * Wraps multiple synchronous state changes into a single re-render.
 *
 * Thread-safe for async contexts when AsyncLocalStorage is available.
 * Falls back to simple sync batching in environments without AsyncLocalStorage.
 *
 * All state updates inside `fn` are collected and applied in a single pass,
 * reducing redundant DOM updates and improving performance.
 *
 * @param fn - Callback containing state mutations to batch
 *
 * @example
 * batchUpdates(() => {
 *   setCount(count + 1);
 *   setName('Alice');
 *   // Both updates applied in single render
 * })
 */
export function batchUpdates(fn: () => void): void {
  const store = batchingStorage?.getStore();
  const isBatching = store?.isBatching ?? false;

  if (isBatching) {
    fn();
    return;
  }

  const newStore: AsyncBatchingStore = { isBatching: true, callbacks: [] };

  const run = () => {
    try {
      fn();
    } finally {
      const callbacks = newStore.callbacks;
      newStore.isBatching = false;
      if (callbacks.length > 0) scheduler.executeBatchedCallbacks(callbacks);
    }
  };

  if (batchingStorage) {
    batchingStorage.run(newStore, run);
  } else {
    run();
  }
}

/**
 * Check if currently inside a batch operation.
 *
 * Respects async context when AsyncLocalStorage is available.
 * Useful for conditional rendering or debugging.
 *
 * @returns true if inside a batchUpdates call, false otherwise
 */
export function isCurrentlyBatching(): boolean {
  const store = batchingStorage?.getStore();
  return store?.isBatching ?? false;
}

/**
 * Internal: Get the current batching store (for scheduler integration).
 */
function getCurrentBatchStore(): AsyncBatchingStore | null {
  return batchingStorage?.getStore() ?? null;
}

// ---------------------- Priority Scheduler ----------------------

class SimplePriorityQueue<T> implements PriorityQueue<T> {
  private heap: Array<{ item: T; priority: Priority }> = [];
  private readonly order: Record<Priority, number> = {
    immediate: 0,
    high: 1,
    normal: 2,
    low: 3,
    idle: 4,
  };

  private cmp(a: { priority: Priority }, b: { priority: Priority }): number {
    return this.order[a.priority] - this.order[b.priority];
  }

  private siftUp(i: number): void {
    // Boundary check
    if (i < 0 || i >= this.heap.length) return;

    while (i > 0) {
      const p = (i - 1) >> 1;
      if (p < 0 || p >= this.heap.length) break;
      if (this.cmp(this.heap[i]!, this.heap[p]!) < 0) {
        [this.heap[i], this.heap[p]] = [this.heap[p]!, this.heap[i]!];
        i = p;
      } else break;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    // Boundary check
    if (i < 0 || i >= n) return;

    while (true) {
      let s = i;
      const l = 2 * i + 1,
        r = 2 * i + 2;
      if (l < n && this.cmp(this.heap[l]!, this.heap[s]!) < 0) s = l;
      if (r < n && this.cmp(this.heap[r]!, this.heap[s]!) < 0) s = r;
      if (s === i) break;
      if (s < 0 || s >= n) break; // Safety check
      [this.heap[i], this.heap[s]] = [this.heap[s]!, this.heap[i]!];
      i = s;
    }
  }

  push(item: T, priority: Priority): void {
    if (!item) {
      console.warn(
        "[SimplePriorityQueue] Attempted to push null/undefined item"
      );
      return;
    }
    this.heap.push({ item, priority });
    this.siftUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (!this.heap.length) return undefined;
    const top = this.heap[0];
    if (!top) return undefined;

    const last = this.heap.pop();
    if (!last) return top.item;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top.item;
  }

  peek(): T | undefined {
    if (!this.heap.length) return undefined;
    return this.heap[0]?.item;
  }

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return !this.heap.length;
  }
}

class FynixScheduler implements ReactiveScheduler {
  private updateQueue = new SimplePriorityQueue<Update>();
  private batchedUpdates = new Set<Update>();
  private isScheduled = false;
  private isWorking = false;
  private currentPriority: Priority = "normal";
  private idCounter = 0;

  schedule(update: Update, priority: Priority = "normal"): void {
    update.id = `u_${this.idCounter++}`;
    update.priority = priority;
    update.timestamp = performance.now();

    if (priority === "immediate") {
      this.flushOne(update);
    } else {
      this.updateQueue.push(update, priority);
      this.kick();
    }
  }

  batchUpdates(updates: Update[]): void {
    updates.forEach((u) => this.batchedUpdates.add(u));
    this.kick();
  }

  timeSlice(deadline: number): boolean {
    const t0 = performance.now();
    const prev = this.currentPriority;

    while (!this.updateQueue.isEmpty() && performance.now() - t0 < deadline) {
      const u = this.updateQueue.pop()!;
      if (this.shouldYield() && u.priority !== "immediate") {
        this.updateQueue.push(u, u.priority);
        break;
      }
      this.flushOne(u);
    }

    this.currentPriority = prev;
    return this.updateQueue.isEmpty();
  }

  // Multi-pass drain: callbacks may schedule new work; drain until quiescent.
  flush(): void {
    if (this.isWorking) return;
    this.isWorking = true;

    try {
      let passes = 0;
      while (
        (!this.updateQueue.isEmpty() || this.batchedUpdates.size > 0) &&
        passes++ < 10
      ) {
        while (!this.updateQueue.isEmpty())
          this.flushOne(this.updateQueue.pop()!);
        this.batchedUpdates.forEach((u) => this.flushOne(u));
        this.batchedUpdates.clear();
      }
    } finally {
      this.isWorking = false;
      this.isScheduled = false;
    }
  }

  private flushOne(u: Update): void {
    const prev = this.currentPriority;
    this.currentPriority = u.priority;
    try {
      u.callback();
    } catch (e) {
      console.error("[FynixScheduler]", e);
      showErrorOverlay(e as Error);
    } finally {
      this.currentPriority = prev;
    }
  }

  private kick(): void {
    if (this.isScheduled) return;
    this.isScheduled = true;

    const next = this.updateQueue.peek();
    if (!next) {
      this.isScheduled = false;
      return;
    }

    if (next.priority === "high" || next.priority === "immediate") {
      requestAnimationFrame(() => this.loop(16.67));
    } else if ("requestIdleCallback" in window) {
      requestIdleCallback((d) => this.loop(d.timeRemaining()));
    } else {
      setTimeout(() => this.loop(5), 0);
    }
  }

  private loop(deadline: number): void {
    if (!this.timeSlice(deadline)) {
      this.isScheduled = false;
      this.kick();
    } else {
      this.flush();
    }
  }

  getCurrentPriority(): Priority {
    return this.currentPriority;
  }

  shouldYield(): boolean {
    const next = this.updateQueue.peek();
    if (!next) return false;
    return this.level(next.priority) < this.level(this.currentPriority);
  }

  private level(p: Priority): number {
    return { immediate: 0, high: 1, normal: 2, low: 3, idle: 4 }[p];
  }

  executeBatchedCallbacks(cbs: Array<() => void>): void {
    const store = getCurrentBatchStore();
    if (store) {
      // Add callbacks to the current batch store instead of scheduling immediately
      store.callbacks.push(...cbs);
    } else {
      // Fallback: schedule as high-priority updates
      const updates = cbs.map((cb) => ({
        id: `b_${this.idCounter++}`,
        type: "state" as UpdateType,
        priority: "high" as Priority,
        callback: cb,
        timestamp: performance.now(),
      }));
      this.batchUpdates(updates);
      this.flush();
    }
  }

  /**
   * Get scheduler state for debugging (internal API)
   */
  getState() {
    return {
      isScheduled: this.isScheduled,
      isWorking: this.isWorking,
      currentPriority: this.currentPriority,
      queueSize: this.updateQueue.size(),
      batchedUpdatesSize: this.batchedUpdates.size,
      idCounter: this.idCounter,
    };
  }

  /**
   * Get current update queue status for debugging
   */
  getQueueMetrics() {
    return {
      pending: this.updateQueue.size(),
      batched: this.batchedUpdates.size,
      isActive: this.isWorking || this.isScheduled,
      currentPriority: this.currentPriority,
    };
  }

  /**
   * Clear all pending updates (use with caution - debugging only)
   */
  clearQueue(): void {
    this.updateQueue = new SimplePriorityQueue();
    this.batchedUpdates.clear();
  }
}

const scheduler = new FynixScheduler();

// ---------------------- Async Error Channel ----------------------

/**
 * Error handler configuration for customizing error behavior
 */
export interface ErrorHandlerConfig {
  /**
   * Handle sync rendering errors in components
   * @param error - The error that occurred
   * @param component - Component that threw (if available)
   * @returns true to prevent default error overlay, false to show overlay
   */
  onRenderError?: (error: Error, component?: ComponentFunction) => boolean;

  /**
   * Handle async errors from promises/callbacks
   * @param error - The error that occurred
   * @returns true to prevent default error overlay, false to show overlay
   */
  onAsyncError?: (error: Error) => boolean;

  /**
   * Handle errors during fiber commit phase
   * @param error - The error that occurred
   * @param fiber - Fiber that caused error (if available)
   * @returns true to prevent default error overlay, false to show overlay
   */
  onCommitError?: (error: Error, fiber?: FynixFiber) => boolean;

  /**
   * Whether to log errors to console (default: true)
   */
  logToConsole?: boolean;

  /**
   * Whether to show error overlay UI (default: true)
   */
  showOverlay?: boolean;
}

let errorConfig: ErrorHandlerConfig = {
  logToConsole: true,
  showOverlay: true,
};

/**
 * Configure global error handling behavior
 *
 * @param config - Error handler configuration
 * @example
 * configureErrorHandling({
 *   onRenderError: (error, component) => {
 *     // Custom handling
 *     return true; // prevent default overlay
 *   },
 *   showOverlay: false, // disable overlay in production
 * })
 */
export function configureErrorHandling(
  config: Partial<ErrorHandlerConfig>
): void {
  errorConfig = { ...errorConfig, ...config };
}

/**
 * Get current error handler configuration
 */
export function getErrorConfig(): ErrorHandlerConfig {
  return { ...errorConfig };
}

// ---------------------- Performance Profiling ----------------------

/**
 * Performance profiling configuration for measuring render/commit times
 */
export interface PerformanceProfileConfig {
  /**
   * Enable performance profiling (default: false for production)
   */
  enabled?: boolean;

  /**
   * Log performance measurements to console
   */
  logMeasurements?: boolean;

  /**
   * Threshold in ms for slow-render warnings (default: 16.67ms)
   */
  slowRenderThreshold?: number;

  /**
   * Callback fired when performance data is collected
   */
  onMetrics?: (metrics: PerformanceMetrics) => void;
}

/**
 * Performance metrics collected during render cycle
 */
export interface PerformanceMetrics {
  renderTime: number;
  commitTime: number;
  totalTime: number;
  updateCount: number;
  fiberCount: number;
  componentName?: string;
  timestamp: number;
}

let perfConfig: PerformanceProfileConfig = {
  enabled: false,
  logMeasurements: false,
  slowRenderThreshold: 16.67,
};

/**
 * Enable performance profiling for debugging render performance
 *
 * @param config - Performance profiling configuration
 *
 * @example
 * enablePerformanceProfiling({
 *   enabled: true,
 *   logMeasurements: true,
 *   slowRenderThreshold: 16.67,
 *   onMetrics: (m) => sendToAnalytics(m),
 * })
 */
export function enablePerformanceProfiling(
  config: PerformanceProfileConfig
): void {
  perfConfig = { ...perfConfig, ...config };
}

/**
 * Get current performance profiling configuration
 */
export function getPerfConfig(): PerformanceProfileConfig {
  return { ...perfConfig };
}

/**
 * Record a performance mark (internal use)
 */
function perfMark(name: string): void {
  if (!perfConfig.enabled || typeof performance === "undefined") return;
  try {
    performance.mark(`fynix:${name}`);
  } catch {
    // Mark/measure not available
  }
}

/**
 * Measure performance between two marks (internal use)
 */
function perfMeasure(name: string, startMark: string, endMark: string): number {
  if (!perfConfig.enabled || typeof performance === "undefined") return 0;
  try {
    performance.measure(
      `fynix:${name}`,
      `fynix:${startMark}`,
      `fynix:${endMark}`
    );
    const measures = performance.getEntriesByName(`fynix:${name}`);
    const duration = measures[measures.length - 1]?.duration ?? 0;

    if (perfConfig.logMeasurements) {
      console.debug(`[Fynix Performance] ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  } catch {
    // Mark/measure not available
    return 0;
  }
}

type ErrorHandler = (error: Error) => void;
const asyncErrorHandlers: ErrorHandler[] = [];

function publishAsyncError(error: Error): void {
  if (errorConfig.logToConsole) {
    console.error("[Fynix] Async Error:", error);
  }

  // Call user-configured async error handler
  if (errorConfig.onAsyncError) {
    const handled = errorConfig.onAsyncError(error);
    if (handled) return; // User handled it, don't show overlay
  }

  // Call registered error boundary handlers
  if (asyncErrorHandlers.length > 0) {
    const handler = asyncErrorHandlers[asyncErrorHandlers.length - 1];
    if (handler) {
      handler(error);
      return;
    }
  }

  // Default: show overlay if enabled
  if (errorConfig.showOverlay) {
    showErrorOverlay(error);
  }
}

// ---------------------- Symbols / Constants ----------------------

export const TEXT = Symbol("text");
export const Fragment = Symbol("Fragment");

export const BOOLEAN_ATTRS = new Set([
  "checked",
  "selected",
  "disabled",
  "readonly",
  "multiple",
  "autoplay",
  "controls",
  "loop",
  "muted",
  "open",
  "required",
  "reversed",
  "scoped",
  "seamless",
  "autofocus",
  "novalidate",
  "formnovalidate",
]);

export const DOM_PROPERTIES = new Set([
  "value",
  "checked",
  "selected",
  "selectedIndex",
  "innerHTML",
  "textContent",
  "innerText",
]);

export const DANGEROUS_HTML_PROPS = new Set([
  "innerHTML",
  "outerHTML",
  "insertAdjacentHTML",
  "srcdoc",
]);

export const DANGEROUS_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "about:",
]);

export const SAFE_PROTOCOLS = new Set([
  "http:",
  "https:",
  "ftp:",
  "ftps:",
  "mailto:",
  "tel:",
  "#",
  "/",
  "./",
  "../",
]);

// ---------------------- Security ----------------------

function sanitizeText(text: string): string {
  if (typeof text !== "string") return String(text);
  return text
    .replace(
      /[<>"'&]/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "&": "&amp;",
        })[c] || c
    )
    .replace(/javascript:/gi, "blocked:")
    .replace(/data:.*?base64/gi, "blocked:");
}

function sanitizeAttributeValue(value: string): string {
  if (typeof value !== "string") return String(value);
  return value
    .replace(
      /["'<>]/g,
      (c) =>
        ({ '"': "&quot;", "'": "&#x27;", "<": "&lt;", ">": "&gt;" })[c] || c
    )
    .replace(/javascript:/gi, "blocked:")
    .replace(/on\w+=/gi, "blocked=");
}

function sanitizeErrorMessage(error: any): string {
  if (!error) return "Unknown error";
  return sanitizeText(
    String(error.message || error.toString() || "Unknown error")
  ).slice(0, 200);
}

// ---------------------- Property Setter ----------------------

/**
 * Applies a resolved value to an element attribute or DOM property.
 * Security-hardened: blocks innerHTML, dangerous protocols, inline handlers.
 */
function applyAttributeValue(el: HTMLElement, key: string, value: any): void {
  const k = key.toLowerCase();

  if (BOOLEAN_ATTRS.has(k)) {
    if (value) {
      el.setAttribute(k, "");
      (el as any)[k] = true;
    } else {
      el.removeAttribute(k);
      (el as any)[k] = false;
    }
    return;
  }

  if (DOM_PROPERTIES.has(key) && !DANGEROUS_HTML_PROPS.has(key)) {
    (el as any)[key] =
      key === "textContent" || key === "innerText"
        ? sanitizeText(value ?? "")
        : (value ?? "");
    return;
  }

  if (key.startsWith("data-") || key.startsWith("aria-")) {
    if (value != null && value !== false)
      el.setAttribute(key, sanitizeAttributeValue(String(value)));
    else el.removeAttribute(key);
    return;
  }

  if (value != null && value !== false) el.setAttribute(key, value);
}

function setProperty(el: HTMLElement, key: string, value: any): void {
  // Reactive nixState on any attribute
  if (
    value &&
    typeof value === "object" &&
    (value._isNixState || value._isRestState) &&
    key !== "r-class" &&
    key !== "rc"
  ) {
    const anyEl = el as any;
    if (!anyEl._fynixCleanups) anyEl._fynixCleanups = [];
    applyAttributeValue(el, key, value.value);
    const unsub = value.subscribe(() =>
      applyAttributeValue(el, key, value.value)
    );
    anyEl._fynixCleanups.push(unsub);
    return;
  }

  if (key === "r-class" || key === "rc") {
    if (typeof value === "string") {
      el.setAttribute("class", value);
      return;
    }
    if (value && (value._isNixState || value._isRestState)) {
      el.setAttribute("class", value.value);
      const anyEl = el as any;
      if (!anyEl._fynixCleanups) anyEl._fynixCleanups = [];
      anyEl._fynixCleanups.push(
        value.subscribe(() => el.setAttribute("class", value.value))
      );
    }
    return;
  }

  if (key.startsWith("r-")) {
    registerDelegatedHandler(el, key.slice(2).toLowerCase(), value);
    return;
  }
  if (key === "style" && typeof value === "object") {
    Object.assign(el.style, value);
    return;
  }

  if (DANGEROUS_HTML_PROPS.has(key)) {
    console.error(
      `[Fynix] Security: ${key} blocked. Use textContent or children.`
    );
    return;
  }

  if (
    ["href", "src", "action", "formaction"].includes(key) &&
    typeof value === "string"
  ) {
    const n = value.trim().toLowerCase();
    for (const p of DANGEROUS_PROTOCOLS) {
      if (n.startsWith(p)) {
        console.error(`[Fynix] Security: ${p} blocked in ${key}`);
        return;
      }
    }
    if (n.includes(":")) {
      const proto = n.split(":")[0] + ":";
      if (!SAFE_PROTOCOLS.has(proto) && !SAFE_PROTOCOLS.has(n.charAt(0))) {
        console.error(
          `[Fynix] Security: protocol '${proto}' not safe in ${key}`
        );
        return;
      }
    }
    if (
      n.startsWith("data:") &&
      (n.includes("javascript") || n.includes("<script"))
    ) {
      console.error(`[Fynix] Security: suspicious data: URL blocked in ${key}`);
      return;
    }
  }

  if (key.toLowerCase().startsWith("on") && key !== "open") {
    console.error(
      `[Fynix] Security: inline handler '${key}' blocked. Use r-${key.slice(2)}.`
    );
    return;
  }

  applyAttributeValue(el, key, value);
}

// ---------------------- Event Delegation ----------------------

const delegatedEvents = new Map<string, Map<number, (e: Event) => void>>();
let eventIdCounter = 1;

function ensureDelegated(type: string): void {
  if (delegatedEvents.has(type)) return;
  delegatedEvents.set(type, new Map());
  document.addEventListener(type, (e: Event) => {
    let cur: Node | null = e.target as Node;
    while (cur && cur !== document) {
      if (cur.nodeType !== 1) break;
      const eid = (cur as any)._rest_eid;
      const handler =
        eid != null ? delegatedEvents.get(type)?.get(eid) : undefined;
      if (handler) {
        handler(e);
        return;
      }
      cur = (cur as Element).parentElement;
    }
  });
}

function registerDelegatedHandler(
  el: HTMLElement,
  name: string,
  fn: (e: Event) => void
): void {
  if (typeof fn !== "function" || el.nodeType !== 1) return;
  const anyEl = el as any;
  const eid = anyEl._rest_eid ?? (anyEl._rest_eid = ++eventIdCounter);
  ensureDelegated(name);
  delegatedEvents.get(name)!.set(eid, (e: Event) => {
    try {
      isCurrentlyBatching()
        ? fn.call(el, e)
        : batchUpdates(() => fn.call(el, e));
    } catch (err) {
      console.error("[Fynix] Event handler error:", err);
      showErrorOverlay(err as Error);
    }
  });
}

// ---------------------- VNode helpers ----------------------

export function createTextVNode(text: any): VNode {
  if (text == null || text === false)
    return { type: TEXT, props: { nodeValue: "" }, key: null };

  if (text && typeof text === "object" && text._isNixState) {
    const vnode: VNode = {
      type: TEXT,
      props: { nodeValue: String(text.value) },
      key: null,
      _state: text,
      _cleanup: null,
    };
    vnode._cleanup = text.subscribe(() => {
      if (vnode._domNode)
        (vnode._domNode as Text).nodeValue = String(text.value);
    });
    return vnode;
  }

  return { type: TEXT, props: { nodeValue: String(text) }, key: null };
}

/**
 * h() — hyperscript factory. Creates a VNode representing a component or DOM element.
 *
 * Shallow-copies props before deleting `key` so the caller's original object is never mutated.
 * Supports JSX via pragma configuration.
 *
 * @param type - Component function, string (element type), or symbol (Fragment)
 * @param props - Element props/attributes or component props (may be null)
 * @param children - Variadic child VNodes, strings, numbers, or nested arrays
 * @returns A VNode ready for mounting or hydration
 *
 * @example
 * h('div', { id: 'app' }, h(MyComponent, { name: 'Alice' }), 'Hello')
 */
export function h(
  type: VNodeType,
  props: VNodeProps | null = null,
  ...children: VNodeChildren[]
): VNode {
  const normalizedProps: VNodeProps =
    props === null || typeof props !== "object" || Array.isArray(props)
      ? {}
      : { ...props };

  const flatChildren: VNode[] = [];
  for (const c of (children as any[]).flat(Infinity)) {
    if (c == null || c === false) continue;
    if (c && typeof c === "object" && "_isNixState" in c) {
      flatChildren.push(createTextVNode(c));
    } else if (typeof c === "string" || typeof c === "number") {
      flatChildren.push(createTextVNode(c));
    } else if (c && typeof c === "object" && "type" in c) {
      if (c.type === Fragment) {
        flatChildren.push(
          ...(c.props.children || []).filter(
            (x: any) => x != null && x !== false
          )
        );
      } else {
        flatChildren.push(c as VNode);
      }
    } else if (typeof c === "function") {
      flatChildren.push(c as any);
    } else {
      flatChildren.push(createTextVNode(String(c)));
    }
  }

  const key = normalizedProps.key ?? null;
  delete normalizedProps.key;

  if (type === Fragment)
    return { type: Fragment, props: { children: flatChildren }, key };
  return { type, props: { ...normalizedProps, children: flatChildren }, key };
}

h.Fragment = ({ children }: { children?: VNode[] }) => children || [];
export const Fynix = h;
Fynix.Fragment = h.Fragment;

// ---------------------- Component Context ----------------------

/**
 * WeakRef-based context tracking to allow garbage collection
 * while maintaining references to active component contexts
 */
class ContextTracker {
  private contextRefs = new Map<VNode, any>();
  private cleanup: any = null;

  constructor() {
    // Initialize FinalizationRegistry if available
    if ((globalThis as any).FinalizationRegistry) {
      this.cleanup = new (globalThis as any).FinalizationRegistry(
        (vnode: VNode) => {
          // Clean up when component context is garbage collected
          this.contextRefs.delete(vnode);
        }
      );
    }
  }

  set(vnode: VNode, ctx: ComponentContext): void {
    if ((globalThis as any).WeakRef) {
      const ref = new (globalThis as any).WeakRef(ctx);
      this.contextRefs.set(vnode, ref);
      if (this.cleanup) {
        this.cleanup.register(ctx, vnode);
      }
    } else {
      // Fallback: store directly (no automatic cleanup)
      this.contextRefs.set(vnode, ctx);
    }
  }

  get(vnode: VNode): ComponentContext | undefined {
    const ref = this.contextRefs.get(vnode);
    if (!ref) return undefined;

    // Check if it's a WeakRef or direct reference
    const ctx = ref.deref ? ref.deref() : ref;
    if (!ctx && ref.deref) {
      this.contextRefs.delete(vnode);
    }
    return ctx;
  }

  has(vnode: VNode): boolean {
    const ref = this.contextRefs.get(vnode);
    if (!ref) return false;
    const ctx = ref.deref ? ref.deref() : ref;
    if (!ctx && ref.deref) {
      this.contextRefs.delete(vnode);
      return false;
    }
    return true;
  }

  delete(vnode: VNode): void {
    this.contextRefs.delete(vnode);
  }

  clear(): void {
    this.contextRefs.clear();
  }
}

// Try to use WeakRef-based tracking, fallback to WeakMap if not available
let componentInstances: ContextTracker | WeakMap<VNode, ComponentContext>;

try {
  if (
    typeof (globalThis as any).WeakRef !== "undefined" &&
    typeof (globalThis as any).FinalizationRegistry !== "undefined"
  ) {
    componentInstances = new ContextTracker();
  } else {
    // Fallback for older environments
    componentInstances = new WeakMap();
  }
} catch {
  // WeakRef/FinalizationRegistry not available, use WeakMap
  componentInstances = new WeakMap();
}

// Tracks pending rerenders to debounce multiple updates
const pendingRerenders = new WeakSet<ComponentContext>();

function makeContext(
  vnode: VNode,
  Component: ComponentFunction
): ComponentContext {
  return {
    hooks: [],
    hookIndex: 0,
    effects: [],
    cleanups: [],
    _vnode: vnode,
    _fiber: null,
    _accessedStates: new Set(),
    _subscriptions: new Set(),
    _subscriptionCleanups: [],
    version: 0,
    rerender: null,
    Component,
    _isMounted: false,
    _isRerendering: false,
    _rerenderTimeout: null,
  };
}

function beginComponent(vnode: VNode): ComponentContext {
  let ctx = componentInstances.get(vnode);
  if (!ctx) {
    ctx = makeContext(vnode, vnode.type as ComponentFunction);
    componentInstances.set(vnode, ctx);
  }
  ctx.hookIndex = 0;
  ctx._accessedStates.clear();
  setActiveContext(ctx);
  ctx.version++;
  return ctx;
}

function endComponent(): void {
  const ctx = activeContext as ComponentContext | null;
  if (!ctx) return;

  ctx._accessedStates.forEach((state) => {
    if (!ctx._subscriptions.has(state)) {
      if (!ctx.rerender) ctx.rerender = createRerender(ctx);
      const unsub = state.subscribe(() => {
        if (ctx.rerender && ctx._isMounted) {
          typeof queueMicrotask === "function"
            ? queueMicrotask(() => ctx.rerender!())
            : setTimeout(ctx.rerender, 0);
        }
      });
      ctx._subscriptions.add(state);
      ctx._subscriptionCleanups.push(unsub);
    }
  });

  setActiveContext(null);
}

/**
 * createRerender — returns a debounced rerender function for a component.
 *
 * When nixState changes, this is called. Instead of calling patch() directly
 * on a VNode subtree (old approach), it calls fiberReconciler.scheduleUpdate()
 * with the component's fiber — triggering a targeted, prioritized re-render
 * through the Fiber work loop.
 */
function createRerender(ctx: ComponentContext): () => void {
  return function rerender() {
    if (ctx._isRerendering || pendingRerenders.has(ctx)) return;

    if (ctx._rerenderTimeout !== null) {
      clearTimeout(ctx._rerenderTimeout);
      ctx._rerenderTimeout = null;
    }

    ctx._rerenderTimeout = setTimeout(() => {
      ctx._rerenderTimeout = null;
      if (ctx._isRerendering || !ctx._isMounted) return;

      // If this component has a live fiber, schedule a targeted fiber update.
      // The Fiber work loop handles time-slicing and priority — no full re-mount.
      if (ctx._fiber) {
        fiberReconciler.scheduleUpdate(ctx._fiber, "normal");
      } else if (ctx._vnode) {
        // Fallback: component not yet assigned a fiber (very first render race).
        // Safe to ignore — the in-progress render will pick up the latest state.
        console.warn(
          "[Fynix] Rerender triggered before fiber assigned — skipping."
        );
      }
    }, 0);
  };
}

// ---------------------- DOM utilities ----------------------

function updateProps(
  el: HTMLElement,
  newProps: VNodeProps = {},
  oldProps: VNodeProps = {}
): void {
  if (!el || el.nodeType !== 1) return;

  for (const k of Object.keys(oldProps)) {
    if (k === "children") continue;
    if (!(k in newProps)) {
      if (k.startsWith("r-")) {
        const eid = (el as any)._rest_eid;
        if (eid) delegatedEvents.get(k.slice(2).toLowerCase())?.delete(eid);
      } else if (BOOLEAN_ATTRS.has(k.toLowerCase())) {
        el.removeAttribute(k);
        (el as any)[k] = false;
      } else if (DOM_PROPERTIES.has(k)) {
        (el as any)[k] = "";
      } else {
        el.removeAttribute(k);
      }
    }
  }

  for (const [k, v] of Object.entries(newProps)) {
    if (k === "children") continue;
    if (oldProps[k] !== v) setProperty(el, k, v);
  }
}

function createDomElement(type: string, props: VNodeProps): HTMLElement {
  const el = document.createElement(type);
  for (const [k, v] of Object.entries(props)) {
    if (k !== "children") setProperty(el as HTMLElement, k, v);
  }
  return el;
}

function unmountCtx(ctx: ComponentContext): void {
  ctx._isMounted = false;
  if (ctx._rerenderTimeout !== null) {
    clearTimeout(ctx._rerenderTimeout);
    ctx._rerenderTimeout = null;
  }
  ctx._subscriptionCleanups.forEach((u) => {
    try {
      u();
    } catch {}
  });
  ctx.cleanups.forEach((c) => {
    try {
      c?.();
    } catch {}
  });
  ctx._subscriptions.clear();
  ctx._accessedStates.clear();
  ctx._subscriptionCleanups = [];
  ctx.cleanups = [];
  ctx.hooks = [];
  ctx.effects = [];
  ctx.rerender = null;
  ctx._vnode = null;
  ctx._fiber = null;
}

function removeDomCleanups(node: Node): void {
  const any = node as any;
  const eid = any._rest_eid;
  if (eid) delegatedEvents.forEach((m) => m.delete(eid));
  if (any._fynixCleanups) {
    any._fynixCleanups.forEach((fn: () => void) => {
      try {
        fn();
      } catch {}
    });
    any._fynixCleanups = null;
  }
}

// ---------------------- Fiber Reconciler ----------------------
//
//  Design goals:
//  · Lightweight — no extra allocations beyond the fiber nodes themselves
//  · VNode-compatible — each fiber wraps a VNode; public API unchanged
//  · Fine-grained — nixState triggers a subtree re-render from the exact fiber
//  · Time-sliced — workLoop yields at deadline; resumes via scheduler
//  · Two-phase — render phase (reconcile) is interruptible; commit is sync

class FiberReconciler {
  // Work-in-progress root for this render cycle.
  private wipRoot: FynixFiber | null = null;

  // Next fiber unit of work. Null when the render phase is complete.
  private nextWork: FynixFiber | null = null;

  // Fibers marked for deletion collected during reconcile.
  private deletions: FynixFiber[] = [];

  // ----- Public entry points -------------------------------------------------

  /**
   * mount() — first render. Creates the initial fiber tree from the VNode.
   * Called by the public mount() function after resolving the root element.
   */
  mountRoot(vnode: VNode, container: Element): void {
    const rootFiber = this.vnodeToFiber(vnode, null, null);
    rootFiber._domNode = container as unknown as Node;

    this.wipRoot = rootFiber;
    this.nextWork = rootFiber;
    this.deletions = [];

    this.scheduleRender("high");
  }

  /**
   * scheduleUpdate() — targeted re-render for a single component fiber.
   * Called by createRerender() when nixState changes. Only the subtree rooted
   * at `fiber` is re-reconciled; siblings and ancestors are untouched.
   */
  scheduleUpdate(fiber: FynixFiber, priority: Priority = "normal"): void {
    // Clone the fiber as work-in-progress with alternate pointing at current.
    const wip = this.cloneFiber(fiber);
    wip.alternate = fiber;

    // Walk up to the root so commitRoot can find the container.
    let root = wip;
    while (root.parent) root = root.parent;
    this.wipRoot = root;

    this.nextWork = wip;
    this.deletions = [];

    this.scheduleRender(priority);
  }

  // ----- Render phase (interruptible) ----------------------------------------

  private scheduleRender(priority: Priority): void {
    scheduler.schedule(
      {
        id: "",
        type: "layout",
        priority,
        callback: () => this.workLoop(priority === "high" ? 16 : 5),
        timestamp: performance.now(),
      },
      priority
    );
  }

  /**
   * workLoop — processes fiber units of work within the given time budget.
   * If the deadline expires before all work is done, it reschedules itself
   * at normal priority and yields the main thread.
   */
  private workLoop(deadline: number): void {
    perfMark("workloop-start");

    const t0 = performance.now();

    while (this.nextWork && performance.now() - t0 < deadline) {
      this.nextWork = this.performWork(this.nextWork);
    }

    if (!this.nextWork && this.wipRoot) {
      // Render phase complete — run the commit phase synchronously.
      // The commit must not be interrupted: it mutates the real DOM.
      perfMark("render-complete");
      this.commitRoot();
      perfMark("commit-complete");

      // Record performance measurements
      if (perfConfig.enabled) {
        const renderTime = perfMeasure(
          "render",
          "workloop-start",
          "render-complete"
        );
        const commitTime = perfMeasure(
          "commit",
          "render-complete",
          "commit-complete"
        );

        if (
          perfConfig.slowRenderThreshold &&
          renderTime + commitTime > perfConfig.slowRenderThreshold
        ) {
          console.warn(
            `[Fynix] Slow render: ${(renderTime + commitTime).toFixed(2)}ms`
          );
        }

        if (perfConfig.onMetrics) {
          perfConfig.onMetrics({
            renderTime,
            commitTime,
            totalTime: renderTime + commitTime,
            updateCount: 0, // Could track this
            fiberCount: 0, // Could count fibers
            timestamp: performance.now(),
          });
        }
      }
    } else if (this.nextWork) {
      // Still have work — reschedule for the next frame/idle slot.
      this.scheduleRender("normal");
    }
  }

  /**
   * performWork — processes one fiber and returns the next unit of work.
   *
   * Order: child → sibling → parent's sibling (depth-first, left-to-right).
   * Component fibers call the component function and reconcile its output.
   * Host fibers (div, span, text…) create or reuse DOM nodes.
   */
  private performWork(fiber: FynixFiber): FynixFiber | null {
    if (typeof fiber.type === "function") {
      this.updateComponentFiber(fiber);
    } else {
      this.updateHostFiber(fiber);
    }

    // Depth-first traversal
    if (fiber.child) return fiber.child;
    let f: FynixFiber | null = fiber;
    while (f) {
      if (f.sibling) return f.sibling;
      f = f.parent;
    }
    return null;
  }

  // ----- Component fiber update ----------------------------------------------

  /**
   * updateComponentFiber — calls the component function, manages
   * ComponentContext (hooks + subscriptions), and reconciles children.
   */
  private updateComponentFiber(fiber: FynixFiber): void {
    // Retrieve or create the ComponentContext for this fiber.
    const vnode = fiber._vnode!;
    let ctx = componentInstances.get(vnode);

    if (!ctx) {
      ctx = makeContext(vnode, fiber.type as ComponentFunction);
      componentInstances.set(vnode, ctx);
    }

    ctx._fiber = fiber;
    fiber.ctx = ctx;

    // Run the component function with hooks active.
    ctx.hookIndex = 0;
    ctx._accessedStates.clear();
    setActiveContext(ctx);
    ctx.version++;

    let rendered: VNode | null = null;
    try {
      removeErrorOverlay();
      const result = (fiber.type as ComponentFunction)(fiber.props);

      if (result instanceof Promise) {
        // Async component: render a placeholder synchronously, resolve later.
        rendered = h("div", null, "Loading...");
        result
          .then((resolved) => {
            vnode._rendered = resolved;
            if (ctx!.rerender) ctx!.rerender();
          })
          .catch((err) =>
            publishAsyncError(
              err instanceof Error ? err : new Error(String(err))
            )
          );
      } else {
        rendered = result;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (errorConfig.logToConsole) {
        console.error("[Fynix] Component render error:", error);
      }

      // Call user-configured render error handler
      const handled = errorConfig.onRenderError?.(
        error,
        fiber.type as ComponentFunction
      );
      if (!handled && errorConfig.showOverlay) {
        showErrorOverlay(error);
      }

      rendered = h(
        "div",
        { style: "color:red" },
        `Error: ${sanitizeErrorMessage(error)}`
      );
    }

    // Wire subscriptions from accessed nixState values.
    ctx._accessedStates.forEach((state) => {
      if (!ctx!._subscriptions.has(state)) {
        if (!ctx!.rerender) ctx!.rerender = createRerender(ctx!);
        const unsub = state.subscribe(() => {
          if (ctx!.rerender && ctx!._isMounted) {
            typeof queueMicrotask === "function"
              ? queueMicrotask(() => ctx!.rerender!())
              : setTimeout(ctx!.rerender, 0);
          }
        });
        ctx!._subscriptions.add(state);
        ctx!._subscriptionCleanups.push(unsub);
      }
    });

    setActiveContext(null);

    ctx._isMounted = true;
    vnode._rendered = rendered;

    if (!ctx.rerender) ctx.rerender = createRerender(ctx);

    // Reconcile the rendered output as children of this fiber.
    const children = rendered ? [rendered] : [];
    this.reconcileChildren(fiber, children);
  }

  // ----- Host fiber update ---------------------------------------------------

  /**
   * updateHostFiber — creates or reuses a DOM node for a non-component fiber
   * (elements, text nodes, fragments).
   */
  private updateHostFiber(fiber: FynixFiber): void {
    // Text nodes
    if (
      fiber.type === TEXT ||
      (typeof fiber.type === "symbol" &&
        (fiber.type as symbol).description?.toLowerCase() === "text")
    ) {
      if (!fiber._domNode) {
        fiber._domNode = document.createTextNode(
          String(fiber.props.nodeValue ?? "")
        );
      } else if (fiber.alternate) {
        const oldText = fiber.alternate.props.nodeValue ?? "";
        const newText = fiber.props.nodeValue ?? "";
        if (oldText !== newText)
          (fiber._domNode as Text).nodeValue = String(newText);
      }
      return;
    }

    // Fragment sentinel nodes
    if (
      fiber.type === Fragment ||
      (typeof fiber.type === "symbol" &&
        (fiber.type as symbol).description?.toLowerCase() === "fragment")
    ) {
      if (!fiber._domNode) {
        const start = document.createTextNode("");
        const end = document.createTextNode("");
        fiber._domNode = start;
        const vnode = fiber._vnode;
        if (vnode) {
          vnode._fragmentStart = start;
          vnode._fragmentEnd = end;
          // Safeguard: mark fragment with both nodes for proper cleanup
          (fiber as any)._fragmentEnd = end;
        } else {
          console.warn(
            "[FynixReconciler] Fragment fiber created without backing VNode. This may cause cleanup issues."
          );
        }
      }
      this.reconcileChildren(fiber, fiber.props.children || []);
      return;
    }

    // Regular host elements
    if (typeof fiber.type === "string") {
      if (!fiber._domNode) {
        // New element
        fiber._domNode = createDomElement(fiber.type, fiber.props);
        fiber.effectTag = "PLACEMENT";
      } else if (fiber.alternate) {
        // Existing element — update props
        updateProps(
          fiber._domNode as HTMLElement,
          fiber.props,
          fiber.alternate.props
        );
        fiber.effectTag = "UPDATE";
      }
      this.reconcileChildren(fiber, fiber.props.children || []);
    }
  }

  // ----- Reconcile children --------------------------------------------------

  /**
   * reconcileChildren — diff the old fiber children (alternate.child chain)
   * against the new VNode children array.
   *
   * Produces effect tags (PLACEMENT / UPDATE / DELETION) without touching
   * the real DOM — all mutations are deferred to the commit phase.
   *
   * Supports keyed reconciliation: if any child has a key, the entire list
   * switches to key-based matching.
   */
  private reconcileChildren(wipFiber: FynixFiber, elements: VNode[]): void {
    // Build old-fiber map: key → fiber (keyed) or index → fiber (unkeyed)
    const hasKeys = elements.some((e) => e?.key != null);
    const oldMap = new Map<string | number, FynixFiber>();
    const oldByIndex: FynixFiber[] = [];

    let oldFiber = wipFiber.alternate?.child ?? null;
    let idx = 0;
    while (oldFiber) {
      if (hasKeys && oldFiber.key != null) oldMap.set(oldFiber.key, oldFiber);
      else oldByIndex[idx] = oldFiber;
      oldFiber = oldFiber.sibling;
      idx++;
    }

    // Collect fibers no longer present — mark for deletion
    if (hasKeys) {
      const newKeys = new Set(
        elements.filter((e) => e?.key != null).map((e) => e.key!)
      );
      oldMap.forEach((f, k) => {
        if (!newKeys.has(k)) {
          f.effectTag = "DELETION";
          this.deletions.push(f);
        }
      });
    }

    // Reconcile new elements
    let prevSibling: FynixFiber | null = null;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el == null) continue;

      const matchFiber =
        hasKeys && el.key != null
          ? (oldMap.get(el.key) ?? null)
          : (oldByIndex[i] ?? null);

      let newFiber: FynixFiber;

      if (matchFiber && matchFiber.type === el.type) {
        // UPDATE — reuse the DOM node, update props
        newFiber = this.cloneFiber(matchFiber);
        newFiber.props = el.props;
        newFiber.key = el.key;
        newFiber.alternate = matchFiber;
        newFiber.effectTag = "UPDATE";
        newFiber.parent = wipFiber;
        newFiber._vnode = el;
        el._fiber = newFiber;
      } else {
        // PLACEMENT — new fiber
        if (matchFiber) {
          matchFiber.effectTag = "DELETION";
          this.deletions.push(matchFiber);
        }
        newFiber = this.vnodeToFiber(el, wipFiber, null);
        newFiber.effectTag = "PLACEMENT";
      }

      if (i === 0) wipFiber.child = newFiber;
      else if (prevSibling) prevSibling.sibling = newFiber;
      prevSibling = newFiber;
    }

    // Old fibers beyond the new list → deletion
    if (!hasKeys) {
      for (let j = elements.length; j < oldByIndex.length; j++) {
        const dead = oldByIndex[j];
        if (dead) {
          dead.effectTag = "DELETION";
          this.deletions.push(dead);
        }
      }
    }
  }

  // ----- Commit phase (synchronous, uninterruptible) -------------------------

  /**
   * commitRoot — applies all fiber mutations to the real DOM in a single
   * synchronous pass. This cannot be interrupted because partial DOM
   * updates would leave the UI in an inconsistent state.
   *
   * Order:
   *  1. Run deletions first (removes old nodes before inserting new ones)
   *  2. Walk the new fiber tree (PLACEMENT / UPDATE)
   *  3. Promote wipRoot → currentRoot
   */
  private commitRoot(): void {
    if (!this.wipRoot) return;

    this.deletions.forEach((f) => this.commitDeletion(f));
    this.deletions = [];

    if (this.wipRoot.child) this.commitWork(this.wipRoot.child);

    this.wipRoot = null;
    this.nextWork = null;
  }

  private commitWork(fiber: FynixFiber | null): void {
    if (!fiber) return;

    const domParent = this.findDomParent(fiber);

    if (fiber.effectTag === "PLACEMENT" && fiber._domNode) {
      // Validate that domParent can actually accept children
      if (!domParent) {
        console.warn(
          "[FynixReconciler] No valid DOM parent found for fiber; skipping insertion"
        );
      } else {
        // Validate node types - ensure it can support appendChild
        const validContainers =
          domParent.nodeType === Node.ELEMENT_NODE ||
          domParent.nodeType === Node.DOCUMENT_NODE ||
          domParent.nodeType === Node.DOCUMENT_FRAGMENT_NODE;

        if (!validContainers) {
          console.warn(
            "[FynixReconciler] Parent node type (" +
              domParent.nodeType +
              ") cannot accept children; skipping insertion"
          );
        } else {
          try {
            // Ensure the node being inserted is not already in the DOM elsewhere
            if (
              fiber._domNode.parentNode &&
              fiber._domNode.parentNode !== domParent
            ) {
              try {
                fiber._domNode.parentNode.removeChild(fiber._domNode);
              } catch (e) {
                // Ignore if removal fails; continue with insertion attempt
              }
            }

            // Insert in correct position using next sibling as reference
            const refNode = this.findNextDomSibling(fiber);

            // Use insertBefore with reference node if available and valid
            if (refNode && refNode.parentNode === domParent) {
              try {
                domParent.insertBefore(fiber._domNode, refNode);
              } catch (insertErr) {
                // insertBefore failed; try append as fallback
                try {
                  domParent.appendChild(fiber._domNode);
                } catch (appendErr) {
                  console.error(
                    "[FynixReconciler] Failed to insert node:",
                    appendErr
                  );
                }
              }
            } else {
              // No valid reference node or parent mismatch; append at end
              try {
                domParent.appendChild(fiber._domNode);
              } catch (appendErr) {
                console.error(
                  "[FynixReconciler] Failed to append node:",
                  appendErr
                );
              }
            }
          } catch (e) {
            console.error(
              "[FynixReconciler] Unexpected error during node insertion:",
              e
            );
          }
        }
      }
    } else if (fiber.effectTag === "UPDATE") {
      if (fiber._domNode && typeof fiber.type === "string" && fiber.alternate) {
        updateProps(
          fiber._domNode as HTMLElement,
          fiber.props,
          fiber.alternate.props
        );
      }
    }
    // Text update is handled eagerly in updateHostFiber — no commit action needed.

    // Run effects after DOM mutation
    this.runEffects(fiber);

    fiber.effectTag = null;
    this.commitWork(fiber.child);
    this.commitWork(fiber.sibling);
  }

  private commitDeletion(fiber: FynixFiber): void {
    // Clean up component contexts recursively
    this.unmountFiber(fiber);

    // Remove the nearest DOM node from its parent
    const domNode = this.findNearestDom(fiber);
    if (domNode?.parentNode) domNode.parentNode.removeChild(domNode);
  }

  /**
   * unmountFiber — iterative implementation to avoid stack overflow on deep trees.
   * Uses a work stack instead of recursion for O(1) space complexity.
   */
  private unmountFiber(fiber: FynixFiber): void {
    if (!fiber) return;

    // Use a stack to process fibers iteratively (depth-first)
    const stack: FynixFiber[] = [fiber];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      // Push siblings and children onto stack (reverse order for correct traversal)
      if (current.sibling) stack.push(current.sibling);
      if (current.child) stack.push(current.child);

      // Cleanup current fiber
      try {
        if (current.ctx) {
          unmountCtx(current.ctx);
          if (current._vnode) componentInstances.delete(current._vnode);
        }
        if (current._domNode?.nodeType === 1)
          removeDomCleanups(current._domNode);
      } catch (e) {
        console.error("[FynixReconciler] Error unmounting fiber:", e);
      }
    }
  }

  private runEffects(fiber: FynixFiber): void {
    if (!fiber.ctx) return;
    const ctx = fiber.ctx;
    ctx.effects.forEach((effect) => {
      try {
        const cleanup = effect();
        if (typeof cleanup === "function") ctx.cleanups.push(cleanup);
      } catch (e) {
        console.error("[Fynix] Effect error:", e);
      }
    });
    ctx.effects = [];
  }

  // ----- Fiber tree utilities ------------------------------------------------

  private vnodeToFiber(
    vnode: VNode,
    parent: FynixFiber | null,
    alternate: FynixFiber | null
  ): FynixFiber {
    const fiber: FynixFiber = {
      type: vnode.type,
      props: vnode.props,
      key: vnode.key,
      child: null,
      sibling: null,
      parent,
      alternate,
      effectTag: null,
      updatePriority: "normal",
      _domNode: vnode._domNode ?? null,
      ctx: null,
      _vnode: vnode,
    };
    vnode._fiber = fiber;
    return fiber;
  }

  private cloneFiber(fiber: FynixFiber): FynixFiber {
    return {
      type: fiber.type,
      props: fiber.props,
      key: fiber.key,
      child: null,
      sibling: null,
      parent: fiber.parent,
      alternate: fiber,
      effectTag: null,
      updatePriority: fiber.updatePriority,
      _domNode: fiber._domNode,
      ctx: fiber.ctx,
      _vnode: fiber._vnode,
    };
  }

  /** Walk up the fiber tree to find the nearest ancestor with a real DOM node. */
  private findDomParent(fiber: FynixFiber): Node | null {
    let p = fiber.parent;
    while (p && !p._domNode) p = p.parent;

    // Get the DOM node
    let domNode = p?._domNode ?? null;

    // Skip text nodes and comment nodes — keep walking up the tree
    // until we find an actual Element or Document that can accept children
    while (
      domNode &&
      (domNode.nodeType === Node.TEXT_NODE ||
        domNode.nodeType === Node.COMMENT_NODE ||
        domNode.nodeType === Node.PROCESSING_INSTRUCTION_NODE)
    ) {
      // Walk up to the parent of this text node
      domNode = domNode.parentNode;
    }

    return domNode;
  }

  /** Find the real DOM node closest to this fiber (may be in a child fiber). */
  private findNearestDom(fiber: FynixFiber): Node | null {
    if (fiber._domNode) return fiber._domNode;
    if (fiber.child) return this.findNearestDom(fiber.child);
    return null;
  }

  /**
   * findNextDomSibling — returns the DOM node that should immediately follow
   * the fiber being inserted. Used as the `insertBefore` reference.
   */
  private findNextDomSibling(fiber: FynixFiber): Node | null {
    let sib = fiber.sibling;
    while (sib) {
      const dom = this.findNearestDom(sib);
      if (dom) return dom;
      sib = sib.sibling;
    }
    return null;
  }
}

// Global reconciler instance — single pipeline for the entire app.
const fiberReconciler = new FiberReconciler();

// ---------------------- Debug API ----------------------

/**
 * Debug API for inspecting runtime internals
 * @internal - Not part of public API, for debugging only
 */
export const __debug__ = {
  /**
   * Get scheduler state for performance debugging
   */
  getSchedulerState: () => scheduler.getState(),

  /**
   * Get queue metrics
   */
  getQueueMetrics: () => scheduler.getQueueMetrics(),

  /**
   * Get fiber reconciler instance
   */
  getFiberReconciler: () => fiberReconciler,

  /**
   * Get error configuration
   */
  getErrorConfig: () => getErrorConfig(),

  /**
   * Get performance configuration
   */
  getPerfConfig: () => getPerfConfig(),

  /**
   * Manually trigger a garbage collection hint (if using WeakRef tracking)
   */
  collectGarbage: () => {
    if (typeof global !== "undefined" && global.gc) {
      global.gc();
    } else if (typeof window !== "undefined" && (window as any).gc) {
      (window as any).gc();
    }
  },

  /**
   * Clear scheduler queue (debugging only, use with extreme caution)
   */
  clearSchedulerQueue: () => scheduler.clearQueue(),

  /**
   * Get async context info
   */
  getAsyncContext: () => ({
    currentBatchStore: getCurrentBatchStore(),
    batchingStorageAvailable: batchingStorage !== null,
  }),
};

// ---------------------- HierarchicalStore ----------------------

interface StoreNode<T = any> {
  path: string;
  value: T;
  version: number;
  children: Map<string, StoreNode>;
  subscribers: Set<() => void>;
}

class HierarchicalStore {
  private root = new Map<string, StoreNode>();
  private selectorCache = new Map<string, any>();
  private stateSnapshot: any = {};

  select<T>(selector: (state: any) => T): T {
    const k = selector.toString();
    if (this.selectorCache.has(k)) return this.selectorCache.get(k);
    const r = selector(this.stateSnapshot);
    this.selectorCache.set(k, r);
    return r;
  }

  optimisticUpdate<T>(path: string, update: T, onRollback?: () => void) {
    const node = this.root.get(path);
    const originalValue = node?.value;
    const originalVersion = node?.version ?? 0;
    this.set(path, update);
    return {
      commit: () => console.log(`[HierarchicalStore] Committed: ${path}`),
      rollback: () => {
        const cur = this.root.get(path);
        if (cur && cur.version !== originalVersion + 1) {
          console.warn(
            `[HierarchicalStore] Rollback skipped for "${path}": concurrent update.`
          );
          return;
        }
        this.set(path, originalValue);
        onRollback?.();
      },
    };
  }

  private set(path: string, value: any): void {
    let node = this.root.get(path);
    if (!node) {
      node = {
        path,
        value,
        version: 0,
        children: new Map(),
        subscribers: new Set(),
      };
      this.root.set(path, node);
    }
    node.value = value;
    node.version++;
    this.stateSnapshot = { ...this.stateSnapshot, [path]: value };
    node.subscribers.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.selectorCache.clear();
  }
}

const hierarchicalStore = new HierarchicalStore();
export function useHierarchicalStore(): HierarchicalStore {
  return hierarchicalStore;
}

// ---------------------- mount / hydrate ----------------------

let rootRenderFn: (() => void) | null = null;

/**
 * mount() — Bootstraps a Fynix application onto a DOM element.
 *
 * Creates a root VNode from AppComponent and hands it to the FiberReconciler.
 * All subsequent re-renders (from nixState changes) go through targeted fiber updates.
 *
 * Clears the container's existing HTML before mounting.
 * Supports HMR via Vite's import.meta.hot API.
 *
 * @param AppComponent - Root component function
 * @param root - DOM selector string or Element to mount into
 * @param props - Initial props to pass to AppComponent (optional)
 *
 * @example
 * mount(App, '#root', { version: '1.0' })
 */
function mount(
  AppComponent: ComponentFunction,
  root: string | Element,
  props: any = {}
): void {
  if (typeof root === "string") {
    const el = document.querySelector(root);
    if (!el) {
      console.error(`[Fynix] mount: selector "${root}" not found`);
      return;
    }
    root = el;
  }

  const container = root as Element;
  container.innerHTML = "";

  const win = window as any;
  const propsToUse =
    win.__lastRouteProps || win.__fynix__?.lastRouteProps || props;
  const appVNode: VNode = { type: AppComponent, props: propsToUse, key: null };

  // Hand off to the Fiber reconciler — this is the entry point into the pipeline.
  fiberReconciler.mountRoot(appVNode, container);

  // rootRenderFn for HMR / router — schedules a full reconciler update.
  rootRenderFn = () => {
    const fiber = appVNode._fiber;
    if (fiber) fiberReconciler.scheduleUpdate(fiber, "high");
  };

  win.__fynix__ = win.__fynix__ || {};
  win.__fynix__.rerender = rootRenderFn;

  if (import.meta.hot && !win.__fynix__.hmr) {
    win.__fynix__.hmr = async ({ mod }: { mod: any }) => {
      try {
        const UpdatedComponent = mod.App || mod.default;
        if (UpdatedComponent && appVNode._fiber) {
          appVNode._fiber.type = UpdatedComponent;
          fiberReconciler.scheduleUpdate(appVNode._fiber, "high");
        }
      } catch (err) {
        console.error("[Fynix HMR]", err);
        showErrorOverlay(err as Error);
      }
    };
    import.meta.hot.accept();
  }
}

/**
 * hydrate() — Attaches Fynix to server-rendered HTML.
 *
 * Walks the existing DOM and reuses nodes where possible instead of
 * creating new ones. Best for progressive enhancement and SSR scenarios.
 *
 * Delegates to FiberReconciler for all subsequent updates.
 *
 * @param AppComponent - Root component function
 * @param root - DOM selector string or Element containing server HTML
 * @param props - Initial props to pass to AppComponent (optional)
 *
 * @example
 * hydrate(App, '#root', { initialState: window.__STATE })
 */
function hydrate(
  AppComponent: ComponentFunction,
  root: string | Element,
  props: any = {}
): void {
  if (typeof root === "string") {
    const el = document.querySelector(root);
    if (!el) {
      console.error(`[Fynix] hydrate: selector "${root}" not found`);
      return;
    }
    root = el;
  }

  const container = root as Element;
  const win = window as any;
  const propsToUse =
    win.__lastRouteProps || win.__fynix__?.lastRouteProps || props;
  const appVNode: VNode = { type: AppComponent, props: propsToUse, key: null };

  // Seed _domNode with the existing container child so the reconciler
  // can reuse it rather than creating a new element.
  if (container.firstChild) appVNode._domNode = container.firstChild as Node;

  fiberReconciler.mountRoot(appVNode, container);

  rootRenderFn = () => {
    const fiber = appVNode._fiber;
    if (fiber) fiberReconciler.scheduleUpdate(fiber, "high");
  };

  win.__fynix__ = win.__fynix__ || {};
  win.__fynix__.rerender = rootRenderFn;
}

// ---------------------- Memoization ----------------------

const MEMO_VNODE_KEY = Symbol("fynix.memoVNode");

/**
 * memo() — Memoizes a component to prevent unnecessary re-renders.
 *
 * Returns a wrapped component that only re-renders when props change.
 * Uses shallow equality by default, but accepts a custom comparator.
 *
 * @param Component - Function component to memoize
 * @param propsAreEqual - Optional custom equality checker (return true if props are equal, skip render)
 * @returns Memoized component with same signature as Component
 *
 * @example
 * export const MyComponent = memo((props) => {...}, (old, new) => old.id === new.id)
 */
export function memo(
  Component: ComponentFunction,
  propsAreEqual?: (oldProps: any, newProps: any) => boolean
): ComponentFunction {
  const isEqual = propsAreEqual || shallowEqual;
  const instanceCache = new WeakMap<object, { props: any; result: any }>();

  return function MemoizedComponent(props: any) {
    const vnodeKey: object | null = props[MEMO_VNODE_KEY] ?? null;
    let cleanProps = props;
    if (vnodeKey) {
      cleanProps = { ...props };
      delete cleanProps[MEMO_VNODE_KEY];
    }

    if (vnodeKey) {
      const cached = instanceCache.get(vnodeKey);
      if (cached && isEqual(cached.props, cleanProps)) return cached.result;
    }

    const result = Component(cleanProps);
    if (vnodeKey) instanceCache.set(vnodeKey, { props: cleanProps, result });
    return result;
  };
}

// ---------------------- renderComponent (public API) ----------------------

const renderComponentCache = new WeakMap<
  VNode,
  { props: any; result: any; timestamp: number }
>();

/**
 * renderComponent() — Renders a component to a VNode without mounting to DOM.
 *
 * Useful for server-side rendering, testing, or generating VNodes for later.
 * Manages component hooks and lifecycle independently.
 *
 * Supports async components; returns a placeholder while async component resolves.
 *
 * @param Component - Function component to render
 * @param props - Props to pass to component
 * @returns VNode representing the component's output
 *
 * @example
 * const vnode = renderComponent(MyComponent, { title: 'Hello' })
 * mount(vnode, '#app')
 */
export function renderComponent(
  Component: ComponentFunction,
  props: any = {}
): VNode {
  const vnode: VNode = { type: Component, props, key: null };
  const ctx = beginComponent(vnode);
  ctx.Component = Component;
  if (!ctx.rerender) ctx.rerender = createRerender(ctx);

  try {
    removeErrorOverlay();
    const result = Component(props);

    if (result instanceof Promise) {
      const placeholder = h("div", null, "Loading...");
      ctx._vnode = vnode;
      vnode._rendered = placeholder;
      ctx._isMounted = true;
      result
        .then((resolved) => {
          vnode._rendered = resolved;
          renderComponentCache.set(vnode, {
            props,
            result: resolved,
            timestamp: performance.now(),
          });
          if (ctx.rerender) ctx.rerender();
        })
        .catch((err) =>
          publishAsyncError(err instanceof Error ? err : new Error(String(err)))
        );
      return placeholder;
    }

    ctx._vnode = vnode;
    vnode._rendered = result;
    ctx._isMounted = true;
    renderComponentCache.set(vnode, {
      props,
      result,
      timestamp: performance.now(),
    });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (errorConfig.logToConsole) {
      console.error("[Fynix] Component render error:", error);
    }

    // Call user-configured render error handler
    const handled = errorConfig.onRenderError?.(error, Component);
    if (!handled && errorConfig.showOverlay) {
      showErrorOverlay(error);
    }

    return h(
      "div",
      { style: "color:red" },
      `Error: ${sanitizeErrorMessage(error)}`
    );
  } finally {
    endComponent();
  }
}

// ---------------------- ErrorBoundary ----------------------

/**
 * ErrorBoundary — Catches async errors from child components.
 *
 * Wraps children and provides a fallback UI when errors occur.
 * Only catches errors from async operations (promises, callbacks);
 * use try-catch for synchronous errors.
 *
 * @param fallback - Component to render when an error occurs (receives Error object)
 * @param children - Child VNodes to potentially error
 * @returns Fragment containing either children or fallback UI
 *
 * @example
 * h(ErrorBoundary, {
 *   fallback: (error) => h('div', null, 'Error: ', error.message),
 *   children: [h(MyComponent, null)]
 * })
 */
export function ErrorBoundary({
  fallback,
  children,
}: {
  fallback: (error: Error) => VNode;
  children?: VNode[];
}): VNode {
  let asyncError: Error | null = null;

  const handleAsyncError = (error: Error) => {
    asyncError = error;
    console.error("[Fynix] ErrorBoundary caught async error:", error);
  };

  asyncErrorHandlers.push(handleAsyncError);

  const removeHandler = () => {
    const idx = asyncErrorHandlers.indexOf(handleAsyncError);
    if (idx !== -1) asyncErrorHandlers.splice(idx, 1);
  };

  const ctx = activeContext as ComponentContext | null;
  if (ctx) ctx.cleanups.push(removeHandler);

  try {
    if (asyncError) {
      removeHandler();
      return fallback(asyncError);
    }
    if (!children || children.length === 0) return h(Fragment, null);
    return h(Fragment, null, ...children);
  } catch (err) {
    removeHandler();
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[Fynix] ErrorBoundary caught:", error);
    try {
      return fallback(error);
    } catch (fe) {
      console.error("[Fynix] ErrorBoundary fallback also threw:", fe);
      return h(
        "div",
        { style: "color:red" },
        "[ErrorBoundary] Fatal render error"
      );
    }
  }
}

// ---------------------- Exports ----------------------

/**
 * PUBLIC API EXPORTS
 *
 * Core API:
 * - h, Fynix: Hyperscript factory
 * - mount, hydrate: App bootstrapping
 * - batchUpdates, isCurrentlyBatching: Update batching
 * - memo, renderComponent: Component utilities
 * - ErrorBoundary: Error handling
 * - configureErrorHandling, getErrorConfig: Error configuration
 *
 * State Management (Hooks):
 * - nixState: Reactive state
 * - nixStore: Global store
 * - nixEffect, nixEffectOnce, nixEffectAlways: Side effects
 * - nixComputed, nixMemo: Derived/memoized values
 * - nixRef, nixCallback, nixPrevious: References and callbacks
 * - nixLocalStorage: Persistent state
 * - nixForm, nixFormAsync: Form state management
 *
 * Async & Data Fetching:
 * - nixAsync, nixAsyncCached, nixAsyncDebounce, nixAsyncQuery: Async operations
 * - nixLazy, nixLazyAsync, nixLazyFormAsync, Suspense: Code splitting & loading
 *
 * Utilities & Timing:
 * - nixInterval, nixDebounce: Timing utilities
 * - Button, Path: Custom UI components
 * - createFynix: Router factory
 *
 * Internal:
 * - fiberReconciler: Reconciliation engine (for advanced use)
 */
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
