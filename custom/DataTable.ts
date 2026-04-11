/* MIT License
 * Copyright (c) 2026 Resty Gonzales
 */

import { Fynix } from "../runtime.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type TableVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "light"
  | "dark";

type ActionHandler<T = any> = (row: T, index: number) => void;

export interface ColumnDef<T = any> {
  key: keyof T | string;
  label: string;
  style?: Record<string, string>;
  class?: string;
  render?: (value: any, row: T, index: number) => any;
}

export interface ActionsDef<T = any> {
  view?: ActionHandler<T> | false;
  edit?: ActionHandler<T> | false;
  delete?: ActionHandler<T> | false;
  /** Extra custom action buttons beyond the standard three */
  extra?: Array<{
    label: string;
    handler: ActionHandler<T>;
    style?: Record<string, string>;
    class?: string;
  }>;
}

export interface DataTableProps<T = any> {
  columns: ColumnDef<T>[];
  data: T[];
  actions?: ActionsDef<T>;
  variant?: TableVariant;
  outline?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  style?: Record<string, string>;
  class?: string;
  tableStyle?: Record<string, string>;
  tableClass?: string;
  rc?: string;
  [key: string]: any;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

interface VariantTheme {
  headerBg: string;
  headerColor: string;
  headerBorder: string;
  rowBorder: string;
  rowHoverBg: string;
  stripeBg: string;
  /** Color used for view/primary action button */
  accentBg: string;
  accentColor: string;
  accentHoverBg: string;
  accentBorder: string;
}

const VARIANT_THEMES: Record<TableVariant, VariantTheme> = {
  primary: {
    headerBg: "rgba(13,110,253,0.08)",
    headerColor: "#0d6efd",
    headerBorder: "rgba(13,110,253,0.2)",
    rowBorder: "rgba(13,110,253,0.09)",
    rowHoverBg: "rgba(13,110,253,0.04)",
    stripeBg: "rgba(13,110,253,0.03)",
    accentBg: "#0d6efd",
    accentColor: "#fff",
    accentHoverBg: "#0b5ed7",
    accentBorder: "#0d6efd",
  },
  secondary: {
    headerBg: "rgba(108,117,125,0.08)",
    headerColor: "#6c757d",
    headerBorder: "rgba(108,117,125,0.2)",
    rowBorder: "rgba(108,117,125,0.09)",
    rowHoverBg: "rgba(108,117,125,0.04)",
    stripeBg: "rgba(108,117,125,0.03)",
    accentBg: "#6c757d",
    accentColor: "#fff",
    accentHoverBg: "#5c636a",
    accentBorder: "#6c757d",
  },
  success: {
    headerBg: "rgba(25,135,84,0.08)",
    headerColor: "#198754",
    headerBorder: "rgba(25,135,84,0.2)",
    rowBorder: "rgba(25,135,84,0.09)",
    rowHoverBg: "rgba(25,135,84,0.04)",
    stripeBg: "rgba(25,135,84,0.03)",
    accentBg: "#198754",
    accentColor: "#fff",
    accentHoverBg: "#157347",
    accentBorder: "#198754",
  },
  danger: {
    headerBg: "rgba(220,53,69,0.08)",
    headerColor: "#dc3545",
    headerBorder: "rgba(220,53,69,0.2)",
    rowBorder: "rgba(220,53,69,0.09)",
    rowHoverBg: "rgba(220,53,69,0.04)",
    stripeBg: "rgba(220,53,69,0.03)",
    accentBg: "#dc3545",
    accentColor: "#fff",
    accentHoverBg: "#bb2d3b",
    accentBorder: "#dc3545",
  },
  warning: {
    headerBg: "rgba(255,193,7,0.10)",
    headerColor: "#856404",
    headerBorder: "rgba(255,193,7,0.3)",
    rowBorder: "rgba(255,193,7,0.12)",
    rowHoverBg: "rgba(255,193,7,0.05)",
    stripeBg: "rgba(255,193,7,0.04)",
    accentBg: "#ffc107",
    accentColor: "#212529",
    accentHoverBg: "#ffca2c",
    accentBorder: "#ffc107",
  },
  info: {
    headerBg: "rgba(13,202,240,0.08)",
    headerColor: "#055160",
    headerBorder: "rgba(13,202,240,0.2)",
    rowBorder: "rgba(13,202,240,0.09)",
    rowHoverBg: "rgba(13,202,240,0.04)",
    stripeBg: "rgba(13,202,240,0.03)",
    accentBg: "#0dcaf0",
    accentColor: "#212529",
    accentHoverBg: "#31d2f2",
    accentBorder: "#0dcaf0",
  },
  light: {
    headerBg: "#f8f9fa",
    headerColor: "#495057",
    headerBorder: "#dee2e6",
    rowBorder: "#e9ecef",
    rowHoverBg: "#f1f3f5",
    stripeBg: "#f8f9fa",
    accentBg: "#f8f9fa",
    accentColor: "#212529",
    accentHoverBg: "#e2e6ea",
    accentBorder: "#dee2e6",
  },
  dark: {
    headerBg: "rgba(33,37,41,0.07)",
    headerColor: "inherit",
    headerBorder: "rgba(33,37,41,0.15)",
    rowBorder: "rgba(33,37,41,0.08)",
    rowHoverBg: "rgba(33,37,41,0.04)",
    stripeBg: "rgba(33,37,41,0.03)",
    accentBg: "#212529",
    accentColor: "#fff",
    accentHoverBg: "#424649",
    accentBorder: "#212529",
  },
};

// Outline mode flips to transparent header, colored border header text
const OUTLINE_THEMES: Record<TableVariant, VariantTheme> = Object.fromEntries(
  Object.entries(VARIANT_THEMES).map(([k, v]) => [
    k,
    {
      ...v,
      headerBg: "transparent",
      stripeBg: "transparent",
    },
  ])
) as Record<TableVariant, VariantTheme>;

// ─── CSS Injection ─────────────────────────────────────────────────────────────

let tableStylesInjected = false;

function injectTableStyles(): void {
  if (tableStylesInjected || typeof document === "undefined") return;
  tableStylesInjected = true;

  const rules: string[] = [
    `
    [data-fynix-dt] {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      font-family: inherit;
    }
    [data-fynix-dt] th,
    [data-fynix-dt] td {
      padding: 8px 12px;
      text-align: left;
      vertical-align: middle;
      border-bottom: 1px solid;
      white-space: nowrap;
    }
    [data-fynix-dt] th {
      font-weight: 500;
      font-size: 12px;
    }
    [data-fynix-dt] tr:last-child td {
      border-bottom: none;
    }
    [data-fynix-dt-actions] {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    [data-fynix-dt-btn] {
      display: inline-block;
      cursor: pointer;
      font-size: 12px;
      font-weight: 400;
      padding: 3px 9px;
      border-radius: 4px;
      border: 1px solid;
      line-height: 1.5;
      transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
      user-select: none;
      text-decoration: none;
      white-space: nowrap;
    }
    `,
  ];

  // Per-variant hover rules for action buttons and rows
  for (const [variant, theme] of Object.entries(VARIANT_THEMES) as [
    TableVariant,
    VariantTheme,
  ][]) {
    rules.push(`
      [data-fynix-dt="${variant}"] th {
        background-color: ${theme.headerBg} !important;
        color: ${theme.headerColor} !important;
        border-color: ${theme.headerBorder} !important;
      }
      [data-fynix-dt="${variant}"] td {
        border-color: ${theme.rowBorder} !important;
      }
      [data-fynix-dt="${variant}"][data-fynix-dt-hover] tr:hover td {
        background-color: ${theme.rowHoverBg} !important;
      }
      [data-fynix-dt="${variant}"][data-fynix-dt-stripe] tr:nth-child(even) td {
        background-color: ${theme.stripeBg} !important;
      }

      /* View button (filled with accent) */
      [data-fynix-dt="${variant}"] [data-fynix-dt-btn="view"] {
        background-color: ${theme.accentBg};
        color: ${theme.accentColor};
        border-color: ${theme.accentBorder};
      }
      [data-fynix-dt="${variant}"] [data-fynix-dt-btn="view"]:hover {
        background-color: ${theme.accentHoverBg} !important;
      }

      /* Edit button (outline accent) */
      [data-fynix-dt="${variant}"] [data-fynix-dt-btn="edit"] {
        background-color: transparent;
        color: ${theme.accentBg === "transparent" ? theme.headerColor : theme.accentBg};
        border-color: ${theme.accentBorder};
      }
      [data-fynix-dt="${variant}"] [data-fynix-dt-btn="edit"]:hover {
        background-color: ${theme.accentBg} !important;
        color: ${theme.accentColor} !important;
      }

      /* Delete button (always danger outline regardless of variant) */
      [data-fynix-dt="${variant}"] [data-fynix-dt-btn="delete"] {
        background-color: transparent;
        color: #dc3545;
        border-color: #dc3545;
      }
      [data-fynix-dt="${variant}"] [data-fynix-dt-btn="delete"]:hover {
        background-color: #dc3545 !important;
        color: #fff !important;
      }
    `);

    // Outline variants
    const outlineTheme = OUTLINE_THEMES[variant];
    rules.push(`
      [data-fynix-dt="outline-${variant}"] th {
        background-color: ${outlineTheme.headerBg} !important;
        color: ${theme.headerColor} !important;
        border-color: ${theme.accentBorder} !important;
      }
      [data-fynix-dt="outline-${variant}"] td {
        border-color: ${theme.rowBorder} !important;
      }
      [data-fynix-dt="outline-${variant}"][data-fynix-dt-hover] tr:hover td {
        background-color: ${theme.rowHoverBg} !important;
      }
      [data-fynix-dt="outline-${variant}"] [data-fynix-dt-btn="view"] {
        background-color: transparent;
        color: ${theme.accentBg};
        border-color: ${theme.accentBorder};
      }
      [data-fynix-dt="outline-${variant}"] [data-fynix-dt-btn="view"]:hover {
        background-color: ${theme.accentBg} !important;
        color: ${theme.accentColor} !important;
      }
      [data-fynix-dt="outline-${variant}"] [data-fynix-dt-btn="edit"] {
        background-color: transparent;
        color: #198754;
        border-color: #198754;
      }
      [data-fynix-dt="outline-${variant}"] [data-fynix-dt-btn="edit"]:hover {
        background-color: #198754 !important;
        color: #fff !important;
      }
      [data-fynix-dt="outline-${variant}"] [data-fynix-dt-btn="delete"] {
        background-color: transparent;
        color: #dc3545;
        border-color: #dc3545;
      }
      [data-fynix-dt="outline-${variant}"] [data-fynix-dt-btn="delete"]:hover {
        background-color: #dc3545 !important;
        color: #fff !important;
      }
    `);
  }

  const style = document.createElement("style");
  style.setAttribute("data-fynix", "datatable-styles");
  style.textContent = rules.join("\n");
  document.head.appendChild(style);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCellValue<T>(row: T, key: string): any {
  return (row as any)[key];
}

// ─── Headless DataTable (Core) ────────────────────────────────────────────────

/**
 * Headless datatable — zero styles, full control.
 * Renders a plain <table> with no visual opinions.
 * Pass `style`, `class`, and action handlers as you see fit.
 *
 * @example
 * <DataTable
 *   columns={[{ key: "name", label: "Name" }, { key: "email", label: "Email" }]}
 *   data={users}
 *   actions={{ view: (row) => console.log(row) }}
 *   style={{ width: "100%", borderCollapse: "collapse" }}
 * />
 */
export function DataTable<T = any>({
  columns,
  data,
  actions,
  style: wrapStyle = {},
  class: wrapClass = "",
  tableStyle = {},
  tableClass = "",
  rc,
  ...rest
}: DataTableProps<T>): any {
  const thead = Fynix(
    "thead",
    {},
    Fynix(
      "tr",
      {},
      ...columns.map((col) =>
        Fynix(
          "th",
          { style: col.style ?? {}, class: col.class ?? "" },
          col.label
        )
      ),
      actions ? Fynix("th", {}, "Actions") : null
    )
  );

  const tbody = Fynix(
    "tbody",
    {},
    ...data.map((row, rowIndex) =>
      Fynix(
        "tr",
        {},
        ...columns.map((col) => {
          const raw = getCellValue(row, col.key as string);
          const cell = col.render ? col.render(raw, row, rowIndex) : raw;
          return Fynix(
            "td",
            { style: col.style ?? {}, class: col.class ?? "" },
            cell
          );
        }),
        actions
          ? Fynix(
              "td",
              {},
              Fynix(
                "div",
                { style: { display: "flex", gap: "6px" } },
                actions.view !== false && actions.view
                  ? Fynix(
                      "button",
                      {
                        type: "button",
                        "r-click": () =>
                          (actions.view as ActionHandler)(row, rowIndex),
                      },
                      "View"
                    )
                  : null,
                actions.edit !== false && actions.edit
                  ? Fynix(
                      "button",
                      {
                        type: "button",
                        "r-click": () =>
                          (actions.edit as ActionHandler)(row, rowIndex),
                      },
                      "Edit"
                    )
                  : null,
                actions.delete !== false && actions.delete
                  ? Fynix(
                      "button",
                      {
                        type: "button",
                        "r-click": () =>
                          (actions.delete as ActionHandler)(row, rowIndex),
                      },
                      "Delete"
                    )
                  : null,
                ...(actions.extra ?? []).map((extra) =>
                  Fynix(
                    "button",
                    {
                      type: "button",
                      style: extra.style ?? {},
                      class: extra.class ?? "",
                      "r-click": () => extra.handler(row, rowIndex),
                    },
                    extra.label
                  )
                )
              )
            )
          : null
      )
    )
  );

  return Fynix(
    "div",
    { style: wrapStyle, class: wrapClass, rc },
    Fynix(
      "table",
      { style: tableStyle, class: tableClass, ...rest },
      thead,
      tbody
    )
  );
}

// ─── Styled DataTable (UI) ────────────────────────────────────────────────────

/**
 * Styled datatable with variant, outline, striped, hoverable, and bordered options.
 * Action icons: view (👁), edit (✏), delete (🗑) — delete is opt-in via `actions.delete`.
 *
 * @example
 * <UIDataTable
 *   variant="primary"
 *   columns={[{ key: "name", label: "Name" }, { key: "role", label: "Role" }]}
 *   data={users}
 *   actions={{
 *     view: (row) => router.push(`/users/${row.id}`),
 *     edit: (row) => openModal(row),
 *     delete: (row) => confirmDelete(row),   // omit to hide delete button
 *   }}
 *   striped
 *   hoverable
 *   bordered
 * />
 */
function UIDataTable<T = any>({
  columns,
  data,
  actions,
  variant = "primary",
  outline = false,
  striped = false,
  hoverable = true,
  bordered = true,
  style: wrapStyle = {},
  class: wrapClass = "",
  tableStyle = {},
  tableClass = "",
  rc,
}: DataTableProps<T>): any {
  injectTableStyles();

  const dataAttr = outline ? `outline-${variant}` : variant;

  const tableAttrs: Record<string, any> = {
    "data-fynix-dt": dataAttr,
    ...(hoverable ? { "data-fynix-dt-hover": "" } : {}),
    ...(striped ? { "data-fynix-dt-stripe": "" } : {}),
    style: tableStyle,
    class: tableClass,
  };

  const borderStyle: Record<string, string> = bordered
    ? {
        border: "1px solid",
        borderColor: "rgba(0,0,0,0.08)",
        borderRadius: "6px",
        overflow: "hidden",
      }
    : {};

  const wrapAttrs: Record<string, any> = {
    style: { display: "block", ...borderStyle, ...wrapStyle },
    class: wrapClass,
    rc,
  };

  const thead = Fynix(
    "thead",
    {},
    Fynix(
      "tr",
      {},
      ...columns.map((col) =>
        Fynix(
          "th",
          { style: col.style ?? {}, class: col.class ?? "" },
          col.label
        )
      ),
      actions ? Fynix("th", {}, "Actions") : null
    )
  );

  const tbody = Fynix(
    "tbody",
    {},
    ...data.map((row, rowIndex) =>
      Fynix(
        "tr",
        {},
        ...columns.map((col) => {
          const raw = getCellValue(row, col.key as string);
          const cell = col.render ? col.render(raw, row, rowIndex) : raw;
          return Fynix(
            "td",
            { style: col.style ?? {}, class: col.class ?? "" },
            cell
          );
        }),
        actions
          ? Fynix(
              "td",
              {},
              Fynix(
                "div",
                { "data-fynix-dt-actions": "" },
                actions.view !== false && actions.view
                  ? Fynix(
                      "button",
                      {
                        type: "button",
                        "data-fynix-dt-btn": "view",
                        "r-click": () =>
                          (actions.view as ActionHandler)(row, rowIndex),
                      },
                      "View"
                    )
                  : null,
                actions.edit !== false && actions.edit
                  ? Fynix(
                      "button",
                      {
                        type: "button",
                        "data-fynix-dt-btn": "edit",
                        "r-click": () =>
                          (actions.edit as ActionHandler)(row, rowIndex),
                      },
                      "Edit"
                    )
                  : null,
                actions.delete !== false && actions.delete
                  ? Fynix(
                      "button",
                      {
                        type: "button",
                        "data-fynix-dt-btn": "delete",
                        "r-click": () =>
                          (actions.delete as ActionHandler)(row, rowIndex),
                      },
                      "Delete"
                    )
                  : null,
                ...(actions.extra ?? []).map((extra) =>
                  Fynix(
                    "button",
                    {
                      type: "button",
                      "data-fynix-dt-btn": "extra",
                      style: extra.style ?? {},
                      class: extra.class ?? "",
                      "r-click": () => extra.handler(row, rowIndex),
                    },
                    extra.label
                  )
                )
              )
            )
          : null
      )
    )
  );

  return Fynix("div", wrapAttrs, Fynix("table", tableAttrs, thead, tbody));
}

// ─── Filled Variants ──────────────────────────────────────────────────────────

export const PrimaryDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "primary" });
export const SecondaryDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "secondary" });
export const SuccessDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "success" });
export const DangerDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "danger" });
export const WarningDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "warning" });
export const InfoDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "info" });
export const LightDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "light" });
export const DarkDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "dark" });

// ─── Outline Variants ─────────────────────────────────────────────────────────

export const OutlinePrimaryDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "primary", outline: true });
export const OutlineSecondaryDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "secondary", outline: true });
export const OutlineSuccessDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "success", outline: true });
export const OutlineDangerDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "danger", outline: true });
export const OutlineWarningDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "warning", outline: true });
export const OutlineInfoDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "info", outline: true });
export const OutlineLightDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "light", outline: true });
export const OutlineDarkDataTable = <T>(p: DataTableProps<T>) =>
  UIDataTable({ ...p, variant: "dark", outline: true });
