/* MIT License
 * Copyright (c) 2026 Resty Gonzales
 */

import { Fynix } from "../runtime.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "light"
  | "dark"
  | "link";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  value?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  outline?: boolean;
  style?: Record<string, string>;
  class?: string;
  rc?: string;
  "r-click"?: (this: HTMLElement, event: MouseEvent) => void;
  [key: string]: any;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

interface VariantColors {
  bg: string;
  color: string;
  border: string;
  hoverBg: string;
  hoverColor: string;
  hoverBorder: string;
}

const VARIANT_STYLES: Record<ButtonVariant, VariantColors> = {
  primary: {
    bg: "#0d6efd",
    color: "#fff",
    border: "#0d6efd",
    hoverBg: "#0b5ed7",
    hoverColor: "#fff",
    hoverBorder: "#0a58ca",
  },
  secondary: {
    bg: "#6c757d",
    color: "#fff",
    border: "#6c757d",
    hoverBg: "#5c636a",
    hoverColor: "#fff",
    hoverBorder: "#565e64",
  },
  success: {
    bg: "#198754",
    color: "#fff",
    border: "#198754",
    hoverBg: "#157347",
    hoverColor: "#fff",
    hoverBorder: "#146c43",
  },
  danger: {
    bg: "#dc3545",
    color: "#fff",
    border: "#dc3545",
    hoverBg: "#bb2d3b",
    hoverColor: "#fff",
    hoverBorder: "#b02a37",
  },
  warning: {
    bg: "#ffc107",
    color: "#212529",
    border: "#ffc107",
    hoverBg: "#ffca2c",
    hoverColor: "#212529",
    hoverBorder: "#ffc720",
  },
  info: {
    bg: "#0dcaf0",
    color: "#212529",
    border: "#0dcaf0",
    hoverBg: "#31d2f2",
    hoverColor: "#212529",
    hoverBorder: "#25cff2",
  },
  light: {
    bg: "#f8f9fa",
    color: "#212529",
    border: "#dee2e6",
    hoverBg: "#f9fafb",
    hoverColor: "#212529",
    hoverBorder: "#d3d4d5",
  },
  dark: {
    bg: "#212529",
    color: "#fff",
    border: "#212529",
    hoverBg: "#424649",
    hoverColor: "#fff",
    hoverBorder: "#373b3e",
  },
  link: {
    bg: "transparent",
    color: "#0d6efd",
    border: "transparent",
    hoverBg: "transparent",
    hoverColor: "#0a58ca",
    hoverBorder: "transparent",
  },
};

const OUTLINE_STYLES: Record<ButtonVariant, VariantColors> = {
  primary: {
    bg: "transparent",
    color: "#0d6efd",
    border: "#0d6efd",
    hoverBg: "#0d6efd",
    hoverColor: "#fff",
    hoverBorder: "#0d6efd",
  },
  secondary: {
    bg: "transparent",
    color: "#6c757d",
    border: "#6c757d",
    hoverBg: "#6c757d",
    hoverColor: "#fff",
    hoverBorder: "#6c757d",
  },
  success: {
    bg: "transparent",
    color: "#198754",
    border: "#198754",
    hoverBg: "#198754",
    hoverColor: "#fff",
    hoverBorder: "#198754",
  },
  danger: {
    bg: "transparent",
    color: "#dc3545",
    border: "#dc3545",
    hoverBg: "#dc3545",
    hoverColor: "#fff",
    hoverBorder: "#dc3545",
  },
  warning: {
    bg: "transparent",
    color: "#ffc107",
    border: "#ffc107",
    hoverBg: "#ffc107",
    hoverColor: "#212529",
    hoverBorder: "#ffc107",
  },
  info: {
    bg: "transparent",
    color: "#0dcaf0",
    border: "#0dcaf0",
    hoverBg: "#0dcaf0",
    hoverColor: "#212529",
    hoverBorder: "#0dcaf0",
  },
  light: {
    bg: "transparent",
    color: "#adb5bd",
    border: "#adb5bd",
    hoverBg: "#f8f9fa",
    hoverColor: "#212529",
    hoverBorder: "#adb5bd",
  },
  dark: {
    bg: "transparent",
    color: "#212529",
    border: "#212529",
    hoverBg: "#212529",
    hoverColor: "#fff",
    hoverBorder: "#212529",
  },
  link: {
    bg: "transparent",
    color: "#0d6efd",
    border: "transparent",
    hoverBg: "transparent",
    hoverColor: "#0a58ca",
    hoverBorder: "transparent",
  },
};

const SIZE_STYLES: Record<ButtonSize, { padding: string; fontSize: string }> = {
  sm: { padding: "4px 8px", fontSize: "12px" },
  md: { padding: "6px 12px", fontSize: "14px" },
  lg: { padding: "8px 16px", fontSize: "16px" },
};

const BASE_STYLE: Record<string, string> = {
  display: "inline-block",
  fontWeight: "400",
  lineHeight: "1.5",
  textAlign: "center",
  textDecoration: "none",
  verticalAlign: "middle",
  cursor: "pointer",
  userSelect: "none",
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "4px",
  transition:
    "color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out",
};

// ─── CSS Injection (runs once) ────────────────────────────────────────────────
// Uses native CSS :hover — no r-mouseenter/r-mouseleave needed.
// This bypasses the delegation issue entirely.

let stylesInjected = false;

function injectButtonStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;

  const rules: string[] = [];

  // Generate hover rules for filled variants
  for (const [variant, colors] of Object.entries(VARIANT_STYLES) as [
    ButtonVariant,
    VariantColors,
  ][]) {
    rules.push(`
      button[data-fynix-btn="${variant}"]:not([disabled]):hover {
        background-color: ${colors.hoverBg} !important;
        color: ${colors.hoverColor} !important;
        border-color: ${colors.hoverBorder} !important;
        ${variant === "link" ? "text-decoration: underline !important;" : ""}
      }
    `);
  }

  // Generate hover rules for outline variants
  for (const [variant, colors] of Object.entries(OUTLINE_STYLES) as [
    ButtonVariant,
    VariantColors,
  ][]) {
    rules.push(`
      button[data-fynix-btn="outline-${variant}"]:not([disabled]):hover {
        background-color: ${colors.hoverBg} !important;
        color: ${colors.hoverColor} !important;
        border-color: ${colors.hoverBorder} !important;
      }
    `);
  }

  const style = document.createElement("style");
  style.setAttribute("data-fynix", "button-styles");
  style.textContent = rules.join("\n");
  document.head.appendChild(style);
}

// ─── Core (Headless) ──────────────────────────────────────────────────────────

/**
 * Headless button — zero styles, full control.
 * @example
 * <Button value="Click me" class="my-class" r-click={handler} />
 */
export function Button({ value = "", ...props }: ButtonProps): any {
  const { value: _stripped, ...cleanProps } = props as any;
  return Fynix("button", cleanProps, value);
}

// ─── UI (Styled) ──────────────────────────────────────────────────────────────

/**
 * Styled button with CSS hover, variant, size, and outline support.
 * @example
 * <UIButton value="Save"    variant="primary" />
 * <UIButton value="Delete"  variant="danger"    size="sm" />
 * <UIButton value="Cancel"  variant="secondary" outline />
 * <UIButton value="Confirm" variant="success"   size="lg" outline />
 */
function UIButton({
  value = "",
  variant = "primary",
  size = "md",
  outline = false,
  style: customStyle = {},
  disabled = false,
  ...props
}: ButtonProps): any {
  // Inject CSS hover rules once on first render
  injectButtonStyles();

  const colors = outline ? OUTLINE_STYLES[variant] : VARIANT_STYLES[variant];
  const sizing = SIZE_STYLES[size];

  // data-fynix-btn is the CSS hook for :hover rules above
  const dataAttr = outline ? `outline-${variant}` : variant;

  const computedStyle: Record<string, string> = {
    ...BASE_STYLE,
    backgroundColor: colors.bg,
    color: colors.color,
    borderColor: colors.border,
    padding: sizing.padding,
    fontSize: sizing.fontSize,
    opacity: disabled ? "0.65" : "1",
    pointerEvents: disabled ? "none" : "auto",
    ...customStyle,
  };

  return Button({
    value,
    style: computedStyle,
    disabled,
    "data-fynix-btn": dataAttr,
    ...props,
  });
}

// ─── Filled Variants ──────────────────────────────────────────────────────────

export const PrimaryButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "primary" });
export const SecondaryButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "secondary" });
export const SuccessButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "success" });
export const DangerButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "danger" });
export const WarningButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "warning" });
export const InfoButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "info" });
export const LightButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "light" });
export const DarkButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "dark" });
export const LinkButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "link" });

// ─── Outline Variants ─────────────────────────────────────────────────────────

export const OutlinePrimaryButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "primary", outline: true });
export const OutlineSecondaryButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "secondary", outline: true });
export const OutlineSuccessButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "success", outline: true });
export const OutlineDangerButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "danger", outline: true });
export const OutlineWarningButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "warning", outline: true });
export const OutlineInfoButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "info", outline: true });
export const OutlineLightButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "light", outline: true });
export const OutlineDarkButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "dark", outline: true });
export const OutlineLinkButton = (p: ButtonProps) =>
  UIButton({ ...p, variant: "link", outline: true });
