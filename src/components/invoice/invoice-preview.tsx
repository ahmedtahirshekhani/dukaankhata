
"use client";

import React, { forwardRef } from "react";
import { useTranslations } from "next-intl";
import {
  calculateDiscountValue,
  calculateLineTotal,
} from "@/lib/invoice/calculations";
import { formatCurrencyString } from "@/lib/utils";

export interface InvoiceProduct {
  id: number | string;
  name: string;
  description?: string;
  quantity: number;
  quantity_str?: string;
  quantityType?: "prime" | "damaged";
  sell_price: number;
  unit_of_measurement?: string;
  discount?: number;
  discountType?: "value" | "percentage";
}

export interface InvoiceCharge {
  item: string;
  value: number;
}

export interface InvoicePreviewProps {
  invoiceNo: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    company_address?: string;
    address?: string;
  };
  saleDate: string;
  dueDate: string | null;
  products: InvoiceProduct[];
  subtotal: number;
  charges: InvoiceCharge[];
  overallDiscount?: number;
  shippingCharges?: number;
  total: number;
  noPaymentAtAll: boolean;
  paidAmount: number;
  paidDate: string | null;
  companyLogo?: string | null;
  signatureImage?: string | null;
  includeSignature?: boolean;
  requestCustomerSignature?: boolean;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerNotes?: string;
  printFormat?: "a4" | "thermal" | "letter";
}

const formatDateLong = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
};

const formatUom = (uom?: string) =>
  uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-";

const truncateDescription = (desc?: string, limit = 25) => {
  if (!desc) return "";
  return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
};

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
  (
    {
      invoiceNo,
      customer,
      saleDate,
      dueDate,
      products,
      subtotal,
      charges,
      overallDiscount = 0,
      shippingCharges = 0,
      total,
      noPaymentAtAll,
      paidAmount,
      paidDate,
      companyLogo,
      signatureImage,
      includeSignature = true,
      requestCustomerSignature = false,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      customerNotes = "",
      printFormat = "a4",
    },
    ref,
  ) => {
    const t = useTranslations("invoice");
    const remainingBalance = Math.max(0, total - paidAmount);
    const isThermal = printFormat === "thermal";

    // ─── Size tokens ────────────────────────────────────────────────────────────
    // All sizing via inline styles so html2canvas / print see identical values.
    const S = isThermal
      ? {
          outerPad: "12px",
          outerPadNum: 12,
          minHeight: "auto",       // Thermal has no fixed page height
          headerFontSize: "15px",
          textFontSize: "11px",
          boldFontSize: "13px",
          labelFontSize: "9px",
          logoH: "40px",
          sigH: "48px",
          sigW: "120px",
          headerGap: "8px",
          sectionGap: "12px",
        }
      : {
          outerPad: "24px",
          outerPadNum: 24,
          minHeight: "277mm",      // A4 / Letter — ensures footer sticks to bottom
          headerFontSize: "22px",
          textFontSize: "13px",
          boldFontSize: "16px",
          labelFontSize: "9px",
          logoH: "64px",
          sigH: "64px",
          sigW: "192px",
          headerGap: "16px",
          sectionGap: "24px",
        };

    return (
      /*
        OUTER DIV — the ref target that html2pdf / html2canvas captures.
        white background + border so it looks like a paper card.
      */
      <div
        ref={ref}
        className="invoice-preview-container"
        style={{
          background: "#ffffff",
          border: "1px solid #94a3b8",
          borderRadius: "6px",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          boxSizing: "border-box",
          width: "100%",
          position: "relative",
          margin: "0 auto",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen {
            .invoice-preview-inner {
              min-height: auto !important;
            }
          }
        `}} />
        {/*
          INNER FLEX COLUMN
          • minHeight keeps A4/Letter content area tall enough that the spacer
            pushes the footer to the bottom even with very few items.
          • Thermal has no fixed height — it just wraps content naturally.
        */}
        <div
          className="invoice-preview-inner"
          style={{
            minHeight: S.minHeight,
            display: "flex",
            flexDirection: "column",
            padding: S.outerPad,
            boxSizing: "border-box",
          }}
        >

          {/* ══════════════════════════════════════════════════════════════════
              HEADER  (Logo | Company Info | Document Title)
              Uses an HTML <table> so every renderer aligns cells identically.
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ borderBottom: "1px solid #94a3b8", paddingBottom: S.sectionGap, marginBottom: S.sectionGap }}>
            {isThermal ? (
              /* ── THERMAL HEADER: stacked centre ── */
              <div style={{ textAlign: "center" }}>
                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt="Company Logo"
                    style={{ height: S.logoH, width: "auto", objectFit: "contain", display: "block", margin: "0 auto 8px" }}
                  />
                )}
                {companyName && (
                  <div style={{ fontWeight: 900, fontSize: S.headerFontSize, color: "#0f172a", textTransform: "uppercase", letterSpacing: "-0.3px" }}>
                    {companyName}
                  </div>
                )}
                {companyAddress && (
                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "4px", lineHeight: 1.4, whiteSpace: "pre-line" }}>
                    {companyAddress}
                  </div>
                )}
                {(companyPhone || companyEmail) && (
                  <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "12px", marginTop: "4px", fontSize: "10px", color: "#334155" }}>
                    {companyPhone && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                        <span>&#9742;</span>
                        <span>{companyPhone}</span>
                      </span>
                    )}
                    {companyEmail && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                        <span>&#9993;</span>
                        <span style={{ textTransform: "lowercase" }}>{companyEmail}</span>
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontWeight: 900, fontSize: S.headerFontSize, color: "#0f172a", textTransform: "uppercase", marginTop: "8px", letterSpacing: "-0.3px" }}>
                  {t("invoiceTitle")}
                </div>
              </div>
            ) : (
              /* ── A4 / LETTER HEADER: three-column table ── */
              <table className="invoice-a4-header" style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    {/* Logo — LEFT */}
                    <td style={{ width: "25%", verticalAlign: "top" }}>
                      {companyLogo && (
                        <img
                          src={companyLogo}
                          alt="Company Logo"
                          style={{ height: S.logoH, width: "auto", objectFit: "contain", display: "block" }}
                        />
                      )}
                    </td>

                    {/* Company Info — CENTER */}
                    <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                      {companyName && (
                        <div style={{
                          fontWeight: 900,
                          fontSize: S.headerFontSize,
                          color: "#0f172a",
                          textTransform: "uppercase",
                          letterSpacing: "-0.5px",
                          lineHeight: 1.2,
                        }}>
                          {companyName}
                        </div>
                      )}
                      {companyAddress && (
                        <div style={{
                          fontSize: "11px",
                          color: "#334155",
                          marginTop: "4px",
                          lineHeight: 1.5,
                          whiteSpace: "pre-line",
                        }}>
                          {companyAddress}
                        </div>
                      )}
                      {/* Phone / Email — inner table keeps perfect vertical alignment */}
                      {(companyPhone || companyEmail) && (
                        <table style={{ margin: "6px auto 0", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              {companyPhone && (
                                <td style={{
                                  paddingRight: companyEmail ? "20px" : "0",
                                  fontSize: "11px",
                                  color: "#334155",
                                  verticalAlign: "middle",
                                  whiteSpace: "nowrap",
                                }}>
                                  <span style={{ fontSize: "12px", marginRight: "4px" }}>&#9742;</span>
                                  <span>{companyPhone}</span>
                                </td>
                              )}
                              {companyEmail && (
                                <td style={{
                                  fontSize: "11px",
                                  color: "#334155",
                                  verticalAlign: "middle",
                                  whiteSpace: "nowrap",
                                }}>
                                  <span style={{ fontSize: "12px", marginRight: "4px" }}>&#9993;</span>
                                  <span style={{ textTransform: "lowercase" }}>{companyEmail}</span>
                                </td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </td>

                    {/* Document Title — RIGHT */}
                    <td className="invoice-title-cell" style={{ width: "25%", textAlign: "right", verticalAlign: "top" }}>
                      <div style={{
                        fontWeight: 900,
                        fontSize: S.headerFontSize,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "-0.5px",
                      }}>
                        {t("invoiceTitle")}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CUSTOMER + INVOICE META
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: S.sectionGap }}>
            {isThermal ? (
              /* ── THERMAL: stacked ── */
              <div style={{ fontSize: S.textFontSize }}>
                <div style={{ fontSize: S.labelFontSize, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "4px" }}>
                  {t("customerDetails")}
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{customer.name}</div>
                {customer.company_name && <div style={{ color: "#334155" }}>{customer.company_name}</div>}
                {(customer.company_address || customer.address) && (
                  <div style={{ fontSize: "10px", color: "#334155", fontStyle: "italic" }}>{customer.company_address || customer.address}</div>
                )}
                {customer.phone && <div style={{ color: "#334155" }}>{customer.phone}</div>}
                {customer.email && <div style={{ color: "#334155" }}>{customer.email}</div>}

                <div style={{ marginTop: "8px", borderTop: "1px solid #94a3b8", paddingTop: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#334155" }}>{t("invoiceNoLabel")}:</span>
                    <span style={{ fontWeight: 700 }}>{invoiceNo}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                    <span style={{ color: "#334155" }}>{t("invoiceDate")}:</span>
                    <span style={{ fontWeight: 700 }}>{formatDateShort(saleDate)}</span>
                  </div>
                  {dueDate && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: "#ef4444" }}>
                      <span style={{ fontWeight: 500 }}>{t("dueDate")}:</span>
                      <span style={{ fontWeight: 700 }}>{formatDateShort(dueDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── A4 / LETTER: two-column table ── */
              <table className="invoice-customer-meta" style={{ width: "100%", borderCollapse: "collapse", fontSize: S.textFontSize }}>
                <tbody>
                  <tr>
                    {/* Customer details */}
                    <td style={{ verticalAlign: "top", width: "50%" }}>
                      <div style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#475569",
                        marginBottom: "6px",
                      }}>
                        {t("customerDetails") || "Party Details"}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                        {customer.name}
                      </div>
                      {customer.company_name && (
                        <div style={{ fontSize: "13px", color: "#334155", fontWeight: 500, marginTop: "2px" }}>
                          {customer.company_name}
                        </div>
                      )}
                      {(customer.company_address || customer.address) && (
                        <div style={{ fontSize: "11px", color: "#334155", fontStyle: "italic", marginTop: "2px", lineHeight: 1.4 }}>
                          {customer.company_address || customer.address}
                        </div>
                      )}
                      {customer.phone && (
                        <div style={{ fontSize: "12px", color: "#334155", marginTop: "2px" }}>
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div style={{ fontSize: "12px", color: "#334155", marginTop: "2px" }}>
                          {customer.email}
                        </div>
                      )}
                    </td>

                    {/* Invoice number / dates */}
                    <td style={{ verticalAlign: "top", textAlign: "right" }}>
                      <div style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#475569",
                        marginBottom: "6px",
                      }}>
                        {t("invoiceDetails") || "Invoice Details"}
                      </div>
                      <table style={{ marginLeft: "auto", borderCollapse: "collapse", fontSize: "13px" }}>
                        <tbody>
                          <tr>
                            <td style={{ color: "#334155", paddingRight: "16px", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {t("invoiceNoLabel") || "Invoice No:"}
                            </td>
                            <td style={{ fontWeight: 700, color: "#0f172a", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {invoiceNo}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#334155", paddingRight: "16px", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {t("invoiceDate") || "Date"}:
                            </td>
                            <td style={{ fontWeight: 700, color: "#0f172a", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {formatDateShort(saleDate)}
                            </td>
                          </tr>
                          {dueDate && (
                            <tr>
                              <td style={{ color: "#ef4444", paddingRight: "16px", whiteSpace: "nowrap" }}>
                                {t("dueDate") || "Due Date"}:
                              </td>
                              <td style={{ fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap" }}>
                                {formatDateShort(dueDate)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              ITEMS TABLE
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: S.sectionGap }}>
            <table className="invoice-items-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: S.textFontSize }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #94a3b8" }}>
                  <th style={{ textAlign: "left", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {t("item")}
                  </th>
                  {!isThermal && (
                    <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {t("sellPrice")}
                    </th>
                  )}
                  <th style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {t("qty")}
                  </th>
                  {!isThermal && (
                    <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {t("uom")}
                    </th>
                  )}
                  {!isThermal && (
                    <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {t("discount")}
                    </th>
                  )}
                  <th style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {t("total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const discountValue = calculateDiscountValue(product);
                  const lineTotal = calculateLineTotal(product);
                  return (
                    <tr key={product.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: isThermal ? "6px 4px" : "10px 8px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{product.name}</div>
                        {product.description && (
                          <div style={{
                            fontSize: "11px",
                            color: "#475569",
                            marginTop: "2px",
                            lineHeight: 1.4,
                            whiteSpace: "pre-line",
                            wordBreak: "break-word"
                          }}>
                            {product.description}
                          </div>
                        )}
                      </td>
                      {!isThermal && (
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>
                          {formatCurrencyString(product.sell_price)}
                        </td>
                      )}
                      <td style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", color: "#334155" }}>
                        {product.quantityType === "damaged" && (
                          <span style={{ fontSize: "10px", color: "#475569" }}>(dmg) </span>
                        )}
                        {product.quantity_str || (product as any).quantityInput || product.quantity}
                      </td>
                      {!isThermal && (
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>
                          {formatUom(product.unit_of_measurement)}
                        </td>
                      )}
                      {!isThermal && (
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>
                          {discountValue > 0 ? formatCurrencyString(discountValue) : "-"}
                        </td>
                      )}
                      <td style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                        {formatCurrencyString(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TOTALS
          ══════════════════════════════════════════════════════════════════ */}
          <div className="invoice-totals-container" style={{ borderTop: "1px solid #94a3b8", paddingTop: "12px", marginBottom: S.sectionGap }}>
            {/* Sub Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
              <span style={{ color: "#334155" }}>Sub Total:</span>
              <span style={{ color: "#334155" }}>{formatCurrencyString(subtotal)}</span>
            </div>

            {/* Overall Discount */}
            {overallDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
                <span style={{ color: "#334155" }}>Overall Discount:</span>
                <span style={{ color: "#ef4444" }}>- {formatCurrencyString(Math.min(overallDiscount, subtotal))}</span>
              </div>
            )}

            {/* Shipping */}
            {shippingCharges > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
                <span style={{ color: "#334155" }}>{t("shippingCharges")}</span>
                <span style={{ color: "#334155" }}>{formatCurrencyString(shippingCharges)}</span>
              </div>
            )}

            {/* Extra Charges */}
            {charges.map((charge, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
                <span style={{ color: "#334155" }}>{charge.item}:</span>
                <span style={{ color: "#334155" }}>{formatCurrencyString(charge.value)}</span>
              </div>
            ))}

            {/* Grand Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: S.boldFontSize, borderTop: "1px solid #94a3b8", paddingTop: "8px", marginTop: "4px" }}>
              <span style={{ color: "#0f172a" }}>{t("total")} :</span>
              <span style={{ color: "#0f172a" }}>{formatCurrencyString(total)}</span>
            </div>

            {/* Payment Info */}
            <div style={{ marginTop: "12px", textAlign: "right", fontSize: S.textFontSize }}>
              {!noPaymentAtAll && paidAmount > 0 && (
                <div style={{ marginBottom: "4px", color: "#334155" }}>
                  <span style={{ fontWeight: 600 }}>{t("paidOn")}</span>{" "}
                  {paidDate ? formatDateLong(paidDate) : "—"} —{" "}
                  {formatCurrencyString(paidAmount)}
                </div>
              )}
              <div style={{ color: "#334155" }}>
                <span style={{ fontWeight: 600 }}>{t("remainingBalance")}</span>{" "}
                {formatCurrencyString(remainingBalance)}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CUSTOMER NOTES
          ══════════════════════════════════════════════════════════════════ */}
          {customerNotes && (
            <div style={{
              marginBottom: S.sectionGap,
              borderLeft: "3px solid #94a3b8",
              paddingLeft: "12px",
              paddingTop: "6px",
              paddingBottom: "6px",
              backgroundColor: "#f8fafc",
              borderRadius: "0 6px 6px 0",
              maxWidth: "420px",
            }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "4px" }}>
                {t("customerNotes") || "Notes & Terms"}:
              </div>
              <div style={{ fontSize: "12px", color: "#334155", fontStyle: "italic", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {customerNotes}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SIGNATURES
          ══════════════════════════════════════════════════════════════════ */}
          {((signatureImage && includeSignature) || requestCustomerSignature) && (
            <div style={{ 
              marginTop: isThermal ? "16px" : "24px",
              marginBottom: isThermal ? "16px" : "24px"
            }}>
              {isThermal ? (
                /* ── THERMAL signatures: stacked ── */
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {signatureImage && includeSignature && (
                    <div>
                      <img src={signatureImage} alt="Company Signature" style={{ height: S.sigH, width: "auto", display: "block", marginBottom: "6px" }} />
                      <div style={{ width: "120px", borderTop: "1px solid #94a3b8", marginBottom: "4px" }} />
                      <div style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{companyName}</div>
                    </div>
                  )}
                  {requestCustomerSignature && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        width: "100%", height: S.sigH, border: "2px dashed #94a3b8", borderRadius: "6px",
                        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px",
                      }}>
                        <span style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                          {t("customerSignature")}
                        </span>
                      </div>
                      <div style={{ width: "120px", borderTop: "1px solid #94a3b8", marginBottom: "4px", marginLeft: "auto" }} />
                      <div style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{customer.name}</div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── A4 / LETTER signatures: side by side ── */
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      {signatureImage && includeSignature ? (
                        <td style={{ verticalAlign: "bottom", width: "50%" }}>
                          <img src={signatureImage} alt="Company Signature" style={{ height: S.sigH, width: "auto", display: "block", marginBottom: "6px" }} />
                          <div style={{ width: "160px", borderTop: "1px solid #94a3b8", marginBottom: "4px" }} />
                          <div style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{companyName}</div>
                        </td>
                      ) : (
                        <td style={{ width: "50%" }} />
                      )}
                      {requestCustomerSignature && (
                        <td style={{ verticalAlign: "bottom", textAlign: "right" }}>
                          <div style={{ display: "inline-block" }}>
                            <div className="invoice-sig-box" style={{
                              width: S.sigW, height: S.sigH,
                              border: "2px dashed #94a3b8", borderRadius: "8px",
                              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px",
                            }}>
                              <span style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                                {t("customerSignature")}
                              </span>
                            </div>
                            <div className="invoice-sig-line" style={{ width: "160px", borderTop: "1px solid #94a3b8", marginBottom: "4px", marginLeft: "auto" }} />
                            <div style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, textAlign: "right" }}>
                              {customer.name}
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SPACER — pushes footer to bottom on short-content pages.
              On multi-page docs this collapses and footer sits after content.
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ flex: 1 }} />

          {/* ══════════════════════════════════════════════════════════════════
              FOOTER / DISCLAIMER
              Normal-flow (not fixed/absolute) so:
              • 1-page  → flex spacer pushes it to bottom of page
              • Multi-page → appears naturally after last content block
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: isThermal ? "16px" : "32px", paddingTop: "10px", textAlign: "center" }}>
            <p style={{ fontSize: "10px", color: "#475569", fontStyle: "italic", margin: 0 }}>
              {t("computerGeneratedDisclaimer") || "This is a computer generated document from DukaanKhata.app"}
            </p>
          </div>

        </div>{/* end inner flex column */}
      </div>
    );
  },
);

InvoicePreview.displayName = "InvoicePreview";