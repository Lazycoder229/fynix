/* MIT License

* Copyright (c) 2026 Resty Gonzales

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
 */

/**
 * Fynix File-Based Router - TypeScript Edition
 * All Security & Memory Leak Issues Fixed
 */

import { mount } from "../runtime";
import { nixLazy } from "../hooks/nixLazy"; // Added for Arch E lazy routes

// ---------------------- Location Signal (Arch B) ----------------------
/**
 * Reactive signal containing the current router location.
 * Components can subscribe to this to re-render on route changes.
 *
 * Note: This is a plain object + subscribers pattern instead of nixState
 * because this is initialized at module level, before any component context exists.
 * nixState requires an active component context, which doesn't exist at module load time.
 */

interface LocationSignal {
  path: string;
  params: Record<string, string>;
  search: string;
}

class LocationManager {
  private current: LocationSignal = {
    path: typeof window !== "undefined" ? window.location.pathname : "/",
    params: {},
    search: typeof window !== "undefined" ? window.location.search : "",
  };

  private subscribers: Set<(location: LocationSignal) => void> = new Set();

  get value(): LocationSignal {
    return this.current;
  }

  set value(newLocation: LocationSignal) {
    this.current = newLocation;
    this.subscribers.forEach((callback) => {
      try {
        callback(newLocation);
      } catch (error) {
        console.error("[Router] Location subscriber error:", error);
      }
    });
  }

  subscribe(callback: (location: LocationSignal) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

export const location = new LocationManager();

// ---------------------- Types ----------------------

interface RouteComponent {
  (props: any): any;
  props?: Record<string, any> | (() => Record<string, any>);
  meta?: RouteMeta | ((params: Record<string, string>) => RouteMeta);
}

interface RouteMeta {
  title?: string;
  description?: string;
  keywords?: string;
  twitterCard?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

interface DynamicRoute {
  pattern: string;
  regex: RegExp;
  component: RouteComponent;
  params: string[];
}

interface EventListener {
  element: Element | Window | Document;
  event: string;
  handler: EventListenerOrEventListenerObject;
}

interface HistoryState {
  __fynixCacheKey?: string;
  serializedProps?: Record<string, any>;
}

interface FynixRouterOptions {
  lazy?: boolean;
}

interface NestedRoute {
  path: string;
  component: RouteComponent;
  layout: RouteComponent;
}

interface FynixRouter {
  mountRouter(selector?: string): void;
  navigate(path: string, props?: Record<string, any>): void;
  replace(path: string, props?: Record<string, any>): void;
  back(): void;
  cleanup(): void;
  routes: Record<string, RouteComponent>;
  dynamicRoutes: DynamicRoute[];
  enableNestedRouting(routes: NestedRoute[]): void;
  // Enterprise features
  clearCache?(): void;
}

interface WindowWithFynix extends Window {
  [key: string]: any;
  __fynixPropsCache?: Map<string, Record<string, any>>;
  __lastRouteProps?: Record<string, any>;
  __fynixLinkProps__?: Record<string, any>;
}

declare const window: WindowWithFynix;

// ---------------------- Constants ----------------------

const MAX_CACHE_SIZE = 50;
const PROPS_NAMESPACE = "__fynixLinkProps__";
const MAX_LISTENERS = 100;
const ALLOWED_PROTOCOLS = ["http:", "https:", ""];
const RENDER_DEBOUNCE = 10; // ms

// ---------------------- Singleton State ----------------------

let routerInstance: FynixRouter | null = null;
let isRouterInitialized = false;

// ---------------------- Security Helpers ----------------------

/**
 * Detect external URLs
 */
function isExternal(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/**
 *  HTML escaping to prevent XSS - Enhanced version
 */
function escapeHTML(str: unknown): string {
  if (typeof str !== "string") return "";

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/`/g, "&#96;")
    .replace(/\//g, "&#x2F;")
    .replace(/=/g, "&#x3D;")
    .replace(/\(/g, "&#x28;")
    .replace(/\)/g, "&#x29;")
    .replace(/\{/g, "&#x7B;")
    .replace(/\}/g, "&#x7D;")
    .replace(/\[/g, "&#x5B;")
    .replace(/\]/g, "&#x5D;");
}

/**
 * Sanitize content for safe DOM insertion
 */
function sanitizeContent(content: string): string {
  // Remove potentially dangerous elements and attributes
  return content
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, "")
    .replace(/<object[^>]*>.*?<\/object>/gis, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/expression\s*\(/gi, "");
}

/**
 * Validate and sanitize component props
 */
function sanitizeProps(props: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    // Skip dangerous keys natively
    if (typeof key !== "string" || key.startsWith("__")) {
      continue;
    }

    // Sanitize string values
    if (typeof value === "string") {
      // First sanitize any HTML content, then escape remaining characters
      const cleanContent = sanitizeContent(value);
      sanitized[key] = escapeHTML(cleanContent);
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects (with depth limit)
      if (Object.keys(value).length < 50) {
        // Prevent DoS
        sanitized[key] = sanitizeProps(value);
      }
    } else if (typeof value === "function") {
      // BUG FIX: Allow functions for programmatic internal navigation
      sanitized[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validates and sanitizes props coming from external/untrusted sources (URL/History).
 * Functions are strictly stripped here.
 */
function sanitizeExternalProps(
  props: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    if (
      typeof key !== "string" ||
      key.startsWith("__") ||
      key.includes("javascript") ||
      key.includes("on")
    ) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = escapeHTML(sanitizeContent(value));
    } else if (typeof value === "object" && value !== null) {
      if (Object.keys(value).length < 50) {
        sanitized[key] = sanitizeExternalProps(value);
      }
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
    // Functions are silently dropped
  }

  return sanitized;
}

/**
 * Validate URL to prevent open redirect - Enhanced security
 */
function isValidURL(url: string): boolean {
  try {
    // Reject URLs with suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /data:/i,
      /mailto:/i,
      /tel:/i,
      /ftp:/i,
      /file:/i,
      /%2f%2f/i, // Double slash encoding
      /%5c%5c/i, // Double backslash encoding
      /\\\\/, // UNC paths
      /@/, // Potential credential injection
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      console.warn("[Router] Security: Suspicious URL pattern blocked");
      return false;
    }

    const parsed = new URL(url, window.location.origin);

    // Strict origin validation
    if (parsed.origin !== window.location.origin) {
      console.warn("[Router] Security: Cross-origin navigation blocked");
      return false;
    }

    // Protocol validation
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      console.warn(
        "[Router] Security: Dangerous protocol blocked:",
        parsed.protocol
      );
      return false;
    }

    // Additional checks for encoded attacks
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (decodedPath !== parsed.pathname && /[<>"'`]/.test(decodedPath)) {
      console.warn("[Router] Security: Encoded XSS attempt blocked");
      return false;
    }

    // Check for excessive length (DoS prevention)
    if (url.length > 2048) {
      console.warn("[Router] Security: Excessively long URL blocked");
      return false;
    }

    return true;
  } catch (e) {
    console.warn("[Router] Security: Invalid URL blocked");
    return false;
  }
}

/**
 * Sanitize path to prevent directory traversal
 */
function sanitizePath(path: string): string {
  if (typeof path !== "string") return "/";

  // Decode URL encoding first to catch encoded traversal attempts
  try {
    path = decodeURIComponent(path);
  } catch (e) {
    console.warn("[Router] Invalid URL encoding in path");
    return "/";
  }

  // Remove null bytes
  path = path.replace(/\0/g, "");

  // Normalize slashes
  path = path.replace(/\\/g, "/");
  path = path.replace(/\/+/g, "/");

  // Remove directory traversal attempts
  path = path
    .split("/")
    .filter((part) => part !== ".." && part !== ".")
    .join("/");

  // Ensure leading slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // Remove trailing slash (except for root)
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path || "/";
}

// ---------------------- Module Loading ----------------------

/**
 * Try multiple possible glob paths for file-based routing
 */
/**
 * Try multiple possible glob paths for file-based routing.
 * Uses Vite's import.meta.glob.
 */
function tryGlobPaths(lazy: boolean = false): Record<string, any> {
  try {
    if (lazy) {
      // Lazy routing branch (Arch E) - returns () => Promise<Module>
      let modules = import.meta.glob("/src/**/*.{tsx,jsx,ts,js}");
      if (Object.keys(modules).length === 0) {
        modules = import.meta.glob([
          "./**/*.tsx",
          "./**/*.jsx",
          "./**/*.ts",
          "./**/*.js",
        ]);
      }
      if (Object.keys(modules).length === 0) {
        modules = import.meta.glob(["../**/*.tsx", "../**/*.jsx"]);
      }
      return modules || {};
    } else {
      // Eager routing branch (default)
      let modules = import.meta.glob("/src/**/*.{tsx,jsx,ts,js}", {
        eager: true,
      });
      if (Object.keys(modules).length === 0) {
        modules = import.meta.glob(
          ["./**/*.tsx", "./**/*.jsx", "./**/*.ts", "./**/*.js"],
          { eager: true }
        );
      }
      if (Object.keys(modules).length === 0) {
        modules = import.meta.glob(["../**/*.tsx", "../**/*.jsx"], {
          eager: true,
        });
      }
      return modules || {};
    }
  } catch (error) {
    console.error("[Router] Failed to load modules:", error);
    return {};
  }
}

/**
 * Convert file path to route path
 */
function filePathToRoute(filePath: string): string {
  let route = filePath
    .replace(/^.*\/src/, "")
    .replace(/\.(ts|tsx|js|jsx)$/, "")
    .replace(/\/view$/, "")
    .replace(/\/$/, "");

  if (!route) route = "/";

  // Convert [param] to :param for route matching
  route = route.replace(/\[([^\]]+)\]/g, ":$1");

  return route;
}

// ---------------------- Route Matching ----------------------

/**
 * Match a dynamic route pattern
 */
function matchDynamicRoute(
  path: string,
  dynamicRoutes: DynamicRoute[]
): { component: RouteComponent; params: Record<string, string> } | null {
  for (const route of dynamicRoutes) {
    const match = path.match(route.regex);

    if (match) {
      const params: Record<string, string> = {};

      route.params.forEach((param, i) => {
        // Already decoded in sanitizePath, just escape
        const matchValue = match[i + 1];
        params[param] = escapeHTML(matchValue || "");
      });

      return { component: route.component, params };
    }
  }

  return null;
}

// ---------------------- Props Serialization ----------------------

/**
 * Deserialize plain props
 */
function deserializeProps(props: unknown): Record<string, any> {
  if (!props || typeof props !== "object") return {};

  const deserialized: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof key !== "string" || key.startsWith("__")) {
      continue;
    }
    deserialized[key] = value;
  }

  return deserialized;
}

/**
 * Normalize path
 */
function normalizePath(path: string): string {
  return sanitizePath(path);
}

// ---------------------- Cache Management ----------------------

/**
 * Generate unique cache keys using crypto API when available
 */
function generateCacheKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback with better uniqueness
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * Add to cache with LRU eviction
 */
function addToCache(
  cache: Map<string, Record<string, any>>,
  key: string,
  value: Record<string, any>
): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (typeof firstKey === "string") {
      const evicted = cache.get(firstKey);
      if (evicted && typeof evicted === "object") {
        Object.values(evicted).forEach((val) => {
          if (val && typeof val === "object" && "cleanup" in val) {
            try {
              (val as any).cleanup();
            } catch (e) {
              // Silent cleanup failure
            }
          }
        });
      }
      cache.delete(firstKey);
    }
  }

  cache.set(key, value);
}

// ---------------------- Meta Tag Management ----------------------

interface MetaDefinition {
  key: keyof RouteMeta;
  name?: string;
  property?: string;
}

const MANAGED_META: MetaDefinition[] = [
  { key: "description", name: "description" },
  { key: "keywords", name: "keywords" },
  { key: "twitterCard", name: "twitter:card" },
  { key: "ogTitle", property: "og:title" },
  { key: "ogDescription", property: "og:description" },
  { key: "ogImage", property: "og:image" },
];

/**
 * Update document meta tags for SEO with enhanced XSS prevention
 */
function updateMetaTags(meta: RouteMeta = {}): void {
  if (!meta || typeof meta !== "object") return;

  // Sanitize title with length limit
  if (meta.title && typeof meta.title === "string") {
    const sanitizedTitle = escapeHTML(meta.title).substring(0, 60); // SEO best practice
    document.title = sanitizedTitle;
  }

  MANAGED_META.forEach((def) => {
    const value = meta[def.key];

    const selector = def.name
      ? `meta[name="${CSS.escape(def.name)}"]`
      : `meta[property="${CSS.escape(def.property || "")}"]`;

    let el = document.querySelector(selector);

    if (value == null) {
      if (el) el.remove();
      return;
    }

    if (typeof value !== "string") return;

    // Additional validation for meta content - sanitize HTML first
    const cleanValue = sanitizeContent(value);
    const sanitizedValue = escapeHTML(cleanValue).substring(0, 300); // Reasonable length limit

    // Block suspicious content
    if (/javascript:|vbscript:|data:|<|>/i.test(sanitizedValue)) {
      console.warn(
        `[Router] Security: Blocked suspicious meta content for ${def.key}`
      );
      return;
    }

    if (!el) {
      el = document.createElement("meta");
      if (def.name) el.setAttribute("name", def.name);
      if (def.property) el.setAttribute("property", def.property);
      document.head.appendChild(el);
    }

    el.setAttribute("content", sanitizedValue);
  });
}

// Removed EnterpriseRouter class
// Removed LayoutRouter class
// Global instances removed

// ---------------------- Router Factory ----------------------

/**
 * Fynix Router Factory
 */
function createFynix(options: FynixRouterOptions = {}): FynixRouter {
  const isDevMode = import.meta.hot !== undefined;

  // Singleton pattern - return existing instance if already initialized
  if (routerInstance && isRouterInitialized && !isDevMode) {
    console.warn(
      "[Router] Router already initialized, returning existing instance"
    );
    return routerInstance;
  }

  // In dev mode with HMR, cleanup old instance before creating new one
  if (isDevMode && routerInstance) {
    console.log("[Router] HMR: Cleaning up old router instance");
    routerInstance.cleanup();
    routerInstance = null;
    isRouterInitialized = false;
  }

  let rootSelector = "#app-root";
  let currentPath: string | null = null;
  let isDestroyed = false;
  let listenerCount = 0;
  let renderTimeout: NodeJS.Timeout | null = null;
  let lastNavigationTime = 0;
  const NAVIGATION_RATE_LIMIT = 100; // ms between navigations

  const listeners: EventListener[] = [];

  // Initialize props namespace
  if (!window[PROPS_NAMESPACE]) {
    window[PROPS_NAMESPACE] = {};
  }

  // Clear old cache in dev mode to prevent memory buildup
  if (isDevMode && window.__fynixPropsCache) {
    window.__fynixPropsCache.clear();
  }

  const propsCache: Map<
    string,
    Record<string, any>
  > = window.__fynixPropsCache || new Map();
  window.__fynixPropsCache = propsCache;

  // Load all route modules
  const isLazy = !!options.lazy;
  const modules = tryGlobPaths(isLazy);
  const routes: Record<string, RouteComponent> = {};
  const dynamicRoutes: DynamicRoute[] = [];
  const nestedLayouts: Map<string, RouteComponent> = new Map();

  for (const [filePath, mod] of Object.entries(modules)) {
    const routePath = filePathToRoute(filePath);
    let component: RouteComponent | undefined = undefined;

    if (isLazy && typeof mod === "function") {
      // mod is () => Promise<Module>
      // Automatically wrap in nixLazy for Suspense compatibility
      component = nixLazy(mod as () => Promise<any>);
    } else if (mod && typeof mod === "object") {
      if ("default" in mod && mod.default) {
        component = mod.default;
      } else {
        const keys = Object.keys(mod);
        const firstKey = keys.length > 0 ? keys[0] : undefined;
        if (
          firstKey !== undefined &&
          typeof firstKey === "string" &&
          typeof mod[firstKey] !== "undefined"
        ) {
          component = mod[firstKey];
        } else {
          const values = Object.values(mod).filter(Boolean);
          if (values.length > 0) {
            component = values[0] as RouteComponent;
          }
        }
      }
    }

    if (!component || typeof routePath !== "string") continue;

    const hasDynamic = /:[^/]+/.test(routePath);

    if (hasDynamic) {
      dynamicRoutes.push({
        pattern: routePath,
        regex: new RegExp("^" + routePath.replace(/:[^/]+/g, "([^/]+)") + "$"),
        component,
        params: [...routePath.matchAll(/:([^/]+)/g)]
          .map((m) => m[1])
          .filter((p): p is string => typeof p === "string"),
      });
    } else {
      routes[routePath] = component;
    }
  }

  // ---------------------- Core Rendering ----------------------
  /**
   * Enhanced core route rendering function with enterprise features
   */
  async function renderRouteImmediate(): Promise<void> {
    if (isDestroyed) return;

    const path = normalizePath(window.location.pathname);
    let Page: RouteComponent | undefined = routes[path];
    let params: Record<string, string> = {};
    let routeProps: Record<string, any> = {};

    // Dynamic route matching
    if (!Page) {
      const match = matchDynamicRoute(path, dynamicRoutes);
      if (match) {
        Page = match.component;
        params = match.params;
      }
    }

    const root = document.querySelector(rootSelector);
    if (!root) {
      console.error("[Router] Root element not found:", rootSelector);
      return;
    }

    // Show enhanced 404 if no route found
    if (!Page) {
      root.innerHTML = "";
      const container = document.createElement("div");
      container.style.cssText =
        "padding: 2rem; text-align: center; font-family: system-ui, sans-serif;";

      const heading = document.createElement("h2");
      heading.textContent = "404 Not Found";
      heading.style.cssText = "color: #dc2626; margin-bottom: 1rem;";

      const pathInfo = document.createElement("p");
      const safePath = escapeHTML(sanitizeContent(path));
      pathInfo.textContent = `Path: ${safePath}`;
      pathInfo.style.cssText = "color: #6b7280; margin-bottom: 2rem;";

      const backButton = document.createElement("button");
      backButton.textContent = "Go Back";
      backButton.style.cssText =
        "padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;";
      backButton.onclick = () => window.history.back();

      container.appendChild(heading);
      container.appendChild(pathInfo);
      container.appendChild(backButton);
      root.appendChild(container);

      updateMetaTags({ title: "404 - Page Not Found" });

      return;
    }

    // Retrieve props from cache or history state with enhanced caching
    const state = (window.history.state || {}) as HistoryState;
    let passedProps: Record<string, any> = {};

    if (state.__fynixCacheKey && propsCache.has(state.__fynixCacheKey)) {
      passedProps = propsCache.get(state.__fynixCacheKey)!;
    } else if (state.serializedProps) {
      passedProps = deserializeProps(state.serializedProps);
    }

    // Get route-specific props
    if (Page.props) {
      routeProps = typeof Page.props === "function" ? Page.props() : Page.props;
    }

    // Update meta tags
    if (Page.meta) {
      const meta =
        typeof Page.meta === "function" ? Page.meta(params) : Page.meta;
      updateMetaTags(meta);
    }

    // Merge and sanitize all props
    // Sanitize props before mounting to prevent XSS
    // Note: passedProps from history/link are external (untrusted), routeProps are internal
    const safeProps = {
      ...sanitizeExternalProps(passedProps),
      ...sanitizeProps({ ...routeProps, params }),
    };

    window.__lastRouteProps = safeProps;

    // Update location signal
    location.value = {
      path,
      params,
      search: window.location.search,
    };

    // Mount the page component, wrapping in a layout if one is registered
    const layout = nestedLayouts.get(path);
    const mountComponent = layout
      ? (props: any) => layout({ children: Page!(props) })
      : Page;
    try {
      mount(mountComponent as RouteComponent, rootSelector, safeProps);
    } catch (err) {
      console.error("[Router] Mount failed:", err);
      // Safe error display without innerHTML
      root.innerHTML = "";
      const errorDiv = document.createElement("pre");
      errorDiv.style.color = "red";
      errorDiv.textContent = "Mount Error occurred";
      root.appendChild(errorDiv);
    }

    currentPath = path;
  }
  /**
   * Debounced route rendering to prevent race conditions
   */
  function renderRoute(): void {
    if (isDestroyed) return;

    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }

    renderTimeout = setTimeout(async () => {
      await renderRouteImmediate();
      renderTimeout = null;
    }, RENDER_DEBOUNCE);
  }
  // ---------------------- Navigation Methods ----------------------

  /**
   * Navigate to a new path with props - Enhanced with preloading
   */
  function navigate(path: string, props: Record<string, any> = {}): void {
    if (isDestroyed) return;

    // Rate limiting to prevent DoS
    const now = Date.now();
    if (now - lastNavigationTime < NAVIGATION_RATE_LIMIT) {
      console.warn("[Router] Security: Navigation rate limited");
      return;
    }
    lastNavigationTime = now;

    const normalizedPath = normalizePath(path);

    if (!isValidURL(window.location.origin + normalizedPath)) {
      console.error("[Router] Invalid navigation URL");
      return;
    }

    if (normalizedPath === currentPath) return;

    // Sanitize props before caching
    const sanitizedProps = sanitizeProps(props);
    const cacheKey = generateCacheKey();
    addToCache(propsCache, cacheKey, sanitizedProps);

    try {
      window.history.pushState(
        { __fynixCacheKey: cacheKey },
        "",
        normalizedPath
      );
      renderRoute();
    } catch (err) {
      console.error("[Router] Navigation failed:", err);
    }
  }

  /**
   * Replace current path with new path and props - Enhanced security
   */
  function replace(path: string, props: Record<string, any> = {}): void {
    if (isDestroyed) return;

    // Rate limiting to prevent DoS
    const now = Date.now();
    if (now - lastNavigationTime < NAVIGATION_RATE_LIMIT) {
      console.warn("[Router] Security: Replace rate limited");
      return;
    }
    lastNavigationTime = now;

    const normalizedPath = normalizePath(path);

    if (!isValidURL(window.location.origin + normalizedPath)) {
      console.error("[Router] Invalid replace URL");
      return;
    }

    // Sanitize props before caching
    const sanitizedProps = sanitizeProps(props);
    const cacheKey = generateCacheKey();
    addToCache(propsCache, cacheKey, sanitizedProps);

    try {
      window.history.replaceState(
        { __fynixCacheKey: cacheKey },
        "",
        normalizedPath
      );
      renderRoute();
    } catch (err) {
      console.error("[Router] Replace failed:", err);
    }
  }

  /**
   * Navigate back in history
   */
  function back(): void {
    if (isDestroyed) return;

    try {
      window.history.back();
    } catch (err) {
      console.error("[Router] Back navigation failed:", err);
    }
  }

  // ---------------------- Event Handlers ----------------------

  /**
   * Link click delegation handler
   */
  const clickHandler = (e: Event): void => {
    if (isDestroyed) return;

    const target = e.target as HTMLElement;
    const link = target.closest(
      "a[data-fynix-link]"
    ) as HTMLAnchorElement | null;

    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) {
      console.warn("[Router] Missing href attribute");
      return;
    }

    // Ignore external links
    if (isExternal(href)) {
      return; // Let the browser handle it
    }

    // Build full URL for validation (handles relative URLs)
    const fullUrl = new URL(link.href, window.location.origin).href;
    if (!isValidURL(fullUrl)) {
      console.warn("[Router] Invalid link href");
      return;
    }

    e.preventDefault();

    const path = normalizePath(
      new URL(link.href, window.location.origin).pathname
    );

    if (path === currentPath) return;

    let props: Record<string, any> = {};
    const propsKey = link.getAttribute("data-props-key");

    if (
      propsKey &&
      typeof propsKey === "string" &&
      !propsKey.startsWith("__")
    ) {
      if (window[PROPS_NAMESPACE]?.[propsKey]) {
        props = window[PROPS_NAMESPACE][propsKey];
      }
    }

    // Serialize props (extract values from reactive states)
    const serializableProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(props)) {
      if (typeof k !== "string" || k.startsWith("__")) continue;
      serializableProps[k] =
        v && (v._isNixState || v._isRestState) ? v.value : v;
    }

    const cacheKey = generateCacheKey();
    addToCache(propsCache, cacheKey, serializableProps);

    try {
      window.history.pushState(
        { __fynixCacheKey: cacheKey, serializedProps: serializableProps },
        "",
        path
      );
      renderRoute();
    } catch (err) {
      console.error("[Router] Link navigation failed:", err);
    }
  };

  // ---------------------- Event Listener Setup ----------------------

  // Only add listeners if not already added
  if (listenerCount < MAX_LISTENERS && !isRouterInitialized) {
    document.addEventListener("click", clickHandler);
    listeners.push({
      element: document,
      event: "click",
      handler: clickHandler,
    });
    listenerCount++;

    // BUG FIX: Wrap popstate in isDestroyed check to prevent race condition
    // where popstate fires after router.cleanup() but before removeEventListener completes
    const popstateHandler = (_e: PopStateEvent) => {
      if (!isDestroyed) renderRoute();
    };

    window.addEventListener("popstate", popstateHandler);
    listeners.push({
      element: window,
      event: "popstate",
      handler: popstateHandler as any,
    });
    listenerCount++;
  }

  // ---------------------- Public Methods ----------------------

  /**
   * Register routes with associated layout components for nested routing.
   * Each entry's component is added to the route table and its layout is stored
   * so that mountRouter() wraps the page inside the layout on render.
   */
  function enableNestedRouting(routeConfigs: NestedRoute[]): void {
    for (const config of routeConfigs) {
      const normalizedPath = normalizePath(config.path || "/");
      routes[normalizedPath] = config.component;
      nestedLayouts.set(normalizedPath, config.layout);
    }
  }

  /**
   * Mount the router to a DOM element
   */
  function mountRouter(selector: string = "#app-root"): void {
    if (isDestroyed) {
      console.error("[Router] Cannot mount destroyed router");
      return;
    }

    if (typeof selector !== "string" || selector.length === 0) {
      console.error("[Router] Invalid selector");
      return;
    }

    rootSelector = selector;
    renderRoute();
    isRouterInitialized = true;
  }

  /**
   * Enhanced cleanup function with enterprise router cleanup
   */
  function cleanup(): void {
    // Clear timeout FIRST to prevent pending renders
    if (renderTimeout) {
      clearTimeout(renderTimeout);
      renderTimeout = null;
    }

    // Mark as destroyed
    isDestroyed = true;

    // Clean up router storage internals

    // Remove all event listeners
    listeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (e) {
        console.error("[Router] Cleanup error:", e);
      }
    });
    listeners.length = 0;
    listenerCount = 0;

    // Clean up all cached props
    propsCache.forEach((props) => {
      if (props && typeof props === "object") {
        Object.values(props).forEach((val) => {
          if (val && typeof val === "object" && "cleanup" in val) {
            try {
              (val as any).cleanup();
            } catch (e) {
              // Silent cleanup failure
            }
          }
        });
      }
    });
    propsCache.clear();

    // Clean up global namespace
    if (window[PROPS_NAMESPACE]) {
      const ns = window[PROPS_NAMESPACE];
      if (ns && typeof ns === "object") {
        Object.keys(ns).forEach((key) => {
          delete ns[key];
        });
      }
      delete window[PROPS_NAMESPACE];
    }

    // Clear last route props
    if (window.__lastRouteProps) {
      delete window.__lastRouteProps;
    }

    // Reset singleton flags at the VERY end
    isRouterInitialized = false;
    routerInstance = null;

    console.log("[Router] Cleanup complete");
  }

  // ---------------------- HMR Support ----------------------

  // @ts-ignore - Vite HMR API
  if (import.meta.hot) {
    // @ts-ignore
    import.meta.hot.accept(() => {
      console.log("[Router] HMR detected, re-rendering route...");
      renderRoute();
    });

    // @ts-ignore
    import.meta.hot.dispose(() => {
      console.log("[Router] HMR dispose, cleaning up...");
      cleanup();
      // Reset singleton flags for HMR
      routerInstance = null;
      isRouterInitialized = false;
    });
  }

  // ---------------------- Router Instance ----------------------

  const router: FynixRouter = {
    mountRouter,
    navigate,
    replace,
    back,
    cleanup,
    routes,
    dynamicRoutes,
    enableNestedRouting,
  };

  routerInstance = router;
  return router;
}

// Export as both named and default
export { createFynix };
export default createFynix;
// ---------------------- Helper Exports ----------------------

/**
 * Set props for links
 */
export function setLinkProps(key: string, props: Record<string, any>): void {
  if (typeof key !== "string" || key.startsWith("__")) {
    console.error("[Router] Invalid props key");
    return;
  }

  if (!props || typeof props !== "object") {
    console.error("[Router] Invalid props object");
    return;
  }

  if (!window[PROPS_NAMESPACE]) {
    window[PROPS_NAMESPACE] = {};
  }

  if (Object.keys(window[PROPS_NAMESPACE]).length >= MAX_CACHE_SIZE) {
    console.warn("[Router] Props storage limit reached");
    return;
  }

  window[PROPS_NAMESPACE][key] = props;
}

/**
 * Clear link props
 */
export function clearLinkProps(key: string): void {
  if (typeof key !== "string") return;

  if (window[PROPS_NAMESPACE]?.[key]) {
    const props = window[PROPS_NAMESPACE][key];

    if (props && typeof props === "object") {
      Object.values(props).forEach((val) => {
        if (val && typeof val === "object" && "cleanup" in val) {
          try {
            (val as any).cleanup();
          } catch (e) {
            // Silent cleanup failure
          }
        }
      });
    }

    delete window[PROPS_NAMESPACE][key];
  }
}
