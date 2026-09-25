// src/components/reports/pdf-table.tsx

import React from "react";
import { cn } from "@/lib/utils";

export interface PdfTableColumn<T = any> {
  id?: string;
  header: React.ReactNode;
  accessorKey?: keyof T | string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  headerStyle?: React.CSSProperties;
  cellStyle?: React.CSSProperties | ((row: T, index: number) => React.CSSProperties | undefined);
}

export interface PdfTableFooterCell {
  content: React.ReactNode;
  colSpan?: number;
  align?: "left" | "center" | "right";
  className?: string;
  style?: React.CSSProperties;
}

export interface PdfTableProps<T = any> {
  columns?: PdfTableColumn<T>[];
  data?: T[];
  footerCells?: PdfTableFooterCell[];
  emptyMessage?: string;
  striped?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  rowKey?: (row: T, index: number) => string | number;
  rowClassName?: (row: T, index: number) => string | undefined;
  rowStyle?: (row: T, index: number) => React.CSSProperties | undefined;
}

/**
 * Reusable PDF Table Component for Reports & Statements.
 * Ensures consistent high-contrast, dark slate header, crisp borders, and reliable html2canvas rendering.
 */
export function PdfTable<T = any>({
  columns,
  data,
  footerCells,
  emptyMessage = "No records found",
  striped = true,
  className,
  style,
  children,
  rowKey,
  rowClassName,
  rowStyle,
}: PdfTableProps<T>) {
  // If compound children are provided, render as styled table wrapper
  if (children) {
    return (
      <div className={cn("w-full bg-white overflow-hidden my-2", className)} style={style}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
            backgroundColor: "#ffffff",
          }}
        >
          {children}
        </table>
      </div>
    );
  }

  // If declarative columns and data are provided
  return (
    <div className={cn("w-full bg-white overflow-hidden my-2", className)} style={style}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "10px",
          backgroundColor: "#ffffff",
        }}
      >
        {columns && columns.length > 0 && (
          <thead>
            <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
              {columns.map((col, idx) => {
                const align = col.align || "left";
                return (
                  <th
                    key={col.id || (typeof col.header === "string" ? col.header : idx)}
                    className={col.headerClassName}
                    style={{
                      width: col.width,
                      padding: "6px 8px",
                      textAlign: align,
                      fontWeight: 700,
                      fontSize: "9.5px",
                      textTransform: "uppercase",
                      letterSpacing: "0.025em",
                      color: "#ffffff",
                      borderBottom: "1px solid #0f172a",
                      ...col.headerStyle,
                    }}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}

        <tbody>
          {!data || data.length === 0 ? (
            <tr>
              <td
                colSpan={columns?.length || 1}
                style={{
                  padding: "16px 8px",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "10px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => {
              const key = rowKey ? rowKey(row, rowIdx) : (row as any)?.id || rowIdx;
              const isEven = rowIdx % 2 === 0;
              const bg = striped ? (isEven ? "#ffffff" : "#f8fafc") : "#ffffff";
              const extraRowClass = rowClassName ? rowClassName(row, rowIdx) : "";
              const extraRowStyle = rowStyle ? rowStyle(row, rowIdx) : {};

              return (
                <tr
                  key={key}
                  className={extraRowClass}
                  style={{
                    backgroundColor: bg,
                    borderBottom: "1px solid #e2e8f0",
                    ...extraRowStyle,
                  }}
                >
                  {columns?.map((col, colIdx) => {
                    const align = col.align || "left";
                    let content: React.ReactNode = null;
                    if (col.render) {
                      content = col.render(row, rowIdx);
                    } else if (col.accessorKey) {
                      content = (row as any)[col.accessorKey];
                    }

                    const dynamicCellStyle =
                      typeof col.cellStyle === "function"
                        ? col.cellStyle(row, rowIdx)
                        : col.cellStyle;

                    return (
                      <td
                        key={col.id || colIdx}
                        className={col.cellClassName}
                        style={{
                          padding: "5.5px 8px",
                          textAlign: align,
                          color: "#0f172a",
                          fontSize: "10px",
                          verticalAlign: "middle",
                          ...dynamicCellStyle,
                        }}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>

        {footerCells && footerCells.length > 0 && (
          <tfoot>
            <tr
              style={{
                backgroundColor: "#f1f5f9",
                borderTop: "2px solid #0f172a",
                borderBottom: "1px solid #cbd5e1",
                fontWeight: "bold",
              }}
            >
              {footerCells.map((cell, idx) => (
                <td
                  key={idx}
                  colSpan={cell.colSpan || 1}
                  className={cell.className}
                  style={{
                    padding: "6px 8px",
                    textAlign: cell.align || "left",
                    color: "#0f172a",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    ...cell.style,
                  }}
                >
                  {cell.content}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// Subcomponents for custom layout mode:

export function PdfTableHeader({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <thead className={className} style={{ ...style }}>
      {children}
    </thead>
  );
}

export function PdfTableBody({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <tbody className={className} style={{ ...style }}>
      {children}
    </tbody>
  );
}

export function PdfTableFooter({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <tfoot className={className} style={{ borderTop: "2px solid #0f172a", ...style }}>
      {children}
    </tfoot>
  );
}

export function PdfTableRow({
  children,
  isHeader = false,
  isFooter = false,
  isOdd = false,
  className,
  style,
}: {
  children: React.ReactNode;
  isHeader?: boolean;
  isFooter?: boolean;
  isOdd?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  let defaultBg = "#ffffff";
  if (isHeader) defaultBg = "#0f172a";
  else if (isFooter) defaultBg = "#f1f5f9";
  else if (isOdd) defaultBg = "#f8fafc";

  return (
    <tr
      className={className}
      style={{
        backgroundColor: defaultBg,
        borderBottom: isHeader ? "1px solid #0f172a" : "1px solid #e2e8f0",
        color: isHeader ? "#ffffff" : "#0f172a",
        fontWeight: isHeader || isFooter ? "bold" : "normal",
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

export function PdfTableHead({
  children,
  align = "left",
  width,
  colSpan,
  className,
  style,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  colSpan?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <th
      colSpan={colSpan}
      className={className}
      style={{
        width,
        padding: "6px 8px",
        textAlign: align,
        fontWeight: 700,
        fontSize: "9.5px",
        textTransform: "uppercase",
        letterSpacing: "0.025em",
        color: "#ffffff",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function PdfTableCell({
  children,
  align = "left",
  colSpan,
  width,
  bold = false,
  highlight = false,
  className,
  style,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  colSpan?: number;
  width?: string;
  bold?: boolean;
  highlight?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      className={className}
      style={{
        width,
        padding: "5.5px 8px",
        textAlign: align,
        fontSize: "10px",
        color: highlight ? "#0284c7" : "#0f172a",
        fontWeight: bold ? 700 : 400,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
