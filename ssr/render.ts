import { type VNode, Fragment, TEXT, BOOLEAN_ATTRS } from "../runtime";
import { escapeHTML } from "../utils/escapeHTML";

const SELF_CLOSING_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Pattern for valid HTML attribute names.
 * Allows letters, digits, hyphens, underscores, and dots.
 * A single colon is permitted only as a namespace separator (e.g. xmlns:xlink),
 * following the XML namespace convention: prefix:localname.
 */
const VALID_ATTR_NAME = /^[a-zA-Z][a-zA-Z0-9_\-.]*(?::[a-zA-Z][a-zA-Z0-9_\-.]*)?$/;

async function renderChildren(children: unknown): Promise<string> {
  if (children == null) return "";
  if (Array.isArray(children)) {
    const parts = await Promise.all(
      (children as unknown[]).map((c) => renderToHTML(c))
    );
    return parts.join("");
  }
  return renderToHTML(children);
}

export async function renderToHTML(node: unknown): Promise<string> {
  if (node == null || node === false) return "";

  if (typeof node === "string") return escapeHTML(node);
  if (typeof node === "number" || typeof node === "boolean")
    return escapeHTML(String(node));

  if (typeof node !== "object") return "";

  const vnode = node as VNode;

  // TEXT node (created by h() when children are strings/numbers)
  if (vnode.type === TEXT) {
    return escapeHTML(String(vnode.props?.nodeValue ?? ""));
  }

  // Fragment — render children directly with no wrapper element
  if (vnode.type === Fragment) {
    return renderChildren(vnode.props?.children);
  }

  // Component function — call it and render the result
  if (typeof vnode.type === "function") {
    const result = await vnode.type(vnode.props || {});
    return renderToHTML(result);
  }

  // HTML element
  if (typeof vnode.type === "string") {
    const tag = vnode.type;
    const { children, ...attrs } = vnode.props || {};

    let attrStr = "";
    const attrParts: string[] = [];
    for (const [name, value] of Object.entries(attrs)) {
      if (!VALID_ATTR_NAME.test(name)) continue;
      if (BOOLEAN_ATTRS.has(name)) {
        if (value) attrParts.push(name);
      } else if (value != null && value !== false) {
        attrParts.push(`${escapeHTML(name)}="${escapeHTML(String(value))}"`);
      }
    }
    attrStr = attrParts.length > 0 ? " " + attrParts.join(" ") : "";

    if (SELF_CLOSING_TAGS.has(tag)) {
      return `<${tag}${attrStr}>`;
    }

    const childHTML = await renderChildren(children);
    return `<${tag}${attrStr}>${childHTML}</${tag}>`;
  }

  return "";
}
