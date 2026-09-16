// src/components/reports/report-pdf-header.tsx

import React from "react";
import Image from "next/image";
import { formatReadableDate, formatReadableDateTime } from "@/lib/date-utils";

export interface ReportBranding {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
}

export interface ReportPdfKpi {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

export interface ReportPdfMetaItem {
  label: string;
  value: React.ReactNode;
}

export interface ReportPdfHeaderProps {
  branding: ReportBranding;
  title: string;
  subtitle?: string;
  fromDate?: string;
  toDate?: string;
  periodLabel?: string;
  generatedAt?: string | Date;
  metaItems?: ReportPdfMetaItem[];
  kpis?: ReportPdfKpi[];
  className?: string;
}

export function ReportPdfHeader({
  branding,
  title,
  subtitle,
  fromDate,
  toDate,
  periodLabel,
  generatedAt,
  metaItems,
  kpis,
  className = "",
}: ReportPdfHeaderProps) {
  const generatedDateStr = React.useMemo(() => {
    return formatReadableDateTime(generatedAt || new Date());
  }, [generatedAt]);

  const displayPeriod = periodLabel || (
    fromDate && toDate ? (
      <>
        <strong style={{ color: "#0f172a" }}>{formatReadableDate(fromDate)}</strong> to{" "}
        <strong style={{ color: "#0f172a" }}>{formatReadableDate(toDate)}</strong>
      </>
    ) : null
  );

  return (
    <div className={`pdf-header ${className}`} style={{ backgroundColor: "white" }}>
      {/* 1. Main Business Branding & Title Section */}
      <div style={{ paddingBottom: "12px", marginBottom: "12px", borderBottom: "2px solid #0f172a" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "48%", verticalAlign: "top" }}>
                {branding.logo && (
                  <Image
                    src={branding.logo}
                    alt="Company Logo"
                    width={130}
                    height={42}
                    unoptimized
                    style={{
                      height: "42px",
                      width: "auto",
                      objectFit: "contain",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  />
                )}
                <div style={{ fontWeight: 900, fontSize: "17px", color: "#0f172a", textTransform: "uppercase" }}>
                  {branding.name || "Dukan Khata"}
                </div>
                {branding.address && (
                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "2px", lineHeight: 1.3 }}>
                    {branding.address}
                  </div>
                )}
                {(branding.phone || branding.email) && (
                  <div style={{ fontSize: "9px", color: "#475569", marginTop: "2px" }}>
                    {branding.phone ? `Phone: ${branding.phone}` : ""}
                    {branding.phone && branding.email ? " | " : ""}
                    {branding.email ? `Email: ${branding.email}` : ""}
                  </div>
                )}
              </td>
              <td style={{ width: "52%", textAlign: "right", verticalAlign: "top" }}>
                <div style={{ fontWeight: 900, fontSize: "19px", color: "#0f172a", textTransform: "uppercase" }}>
                  {title}
                </div>
                {subtitle && (
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                    {subtitle}
                  </div>
                )}
                {displayPeriod && (
                  <div style={{ fontSize: "10px", color: "#475569", marginTop: "3px" }}>
                    Period: {displayPeriod}
                  </div>
                )}
                <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>
                  Generated on: {generatedDateStr}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Optional Metadata Bar (e.g. Customer Name, ID, Category filter) */}
      {metaItems && metaItems.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}>
            <tbody>
              <tr>
                {metaItems.map((meta, idx) => (
                  <td
                    key={idx}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      borderRight: idx < metaItems.length - 1 ? "1px solid #cbd5e1" : "none",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <div style={{ fontSize: "8px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#0f172a", marginTop: "1px" }}>
                      {meta.value}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Optional KPI Summary Strip (e.g. Total Revenue, Units Sold, Gross Profit) */}
      {kpis && kpis.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
            <tbody>
              <tr>
                {kpis.map((kpi, idx) => (
                  <td
                    key={idx}
                    style={{
                      padding: "6px 8px",
                      textAlign: "center",
                      borderRight: idx < kpis.length - 1 ? "1px solid #cbd5e1" : "none",
                      backgroundColor: kpi.highlight ? "#f1f5f9" : "#f8fafc",
                    }}
                  >
                    <div style={{ fontSize: "8px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0f172a", marginTop: "1px" }}>
                      {kpi.value}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

