import { type VNode, Fragment, TEXT, BOOLEAN_ATTRS } from "../runtime";

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

function escapeHTML(str: unknown): string {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
      if (BOOLEAN_ATTRS.has(name)) {
        if (value) attrParts.push(name);
      } else if (value != null && value !== false) {
        attrParts.push(`${name}="${escapeHTML(String(value))}"`);
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
