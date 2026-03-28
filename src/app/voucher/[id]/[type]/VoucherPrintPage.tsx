"use client";

import { useState } from "react";

const COMPANY_NAME = "21 Hectares Agrotech Private Limited";

function fmt(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(val));
}

function fmtWeight(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${(kg / 1000).toFixed(3)} MT (${kg.toLocaleString("en-IN")} kg)`;
}

function getVoucherNo(id: string, type: "advance" | "final"): string {
  const suffix = id.slice(-8).toUpperCase();
  return type === "advance" ? `ADV-${suffix}` : `FIN-${suffix}`;
}

function getCenterNames(delivery: any): string {
  const pickups = delivery.masterRequest?.childPickups ?? [];
  const names = pickups.map((p: any) =>
    p.pickupLocType === "BFH" && p.villageName ? p.villageName : p.center?.centerName ?? "—"
  );
  const unique = [...new Set(names)] as string[];
  return unique.length > 0 ? unique.join(", ") : "—";
}

function numberToWords(amount: number): string {
  if (!amount || isNaN(amount)) return "Zero Rupees";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function toWords(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + toWords(n % 100);
    if (n < 100000) return toWords(Math.floor(n / 1000)) + "Thousand " + toWords(n % 1000);
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + "Lakh " + toWords(n % 100000);
    return toWords(Math.floor(n / 10000000)) + "Crore " + toWords(n % 10000000);
  }
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = toWords(rupees).trim() + " Rupees";
  if (paise > 0) result += " and " + toWords(paise).trim() + " Paise";
  return result;
}

interface Props {
  delivery: any;
  type: "advance" | "final";
}

export default function VoucherPrintPage({ delivery, type }: Props) {
  const [printing, setPrinting] = useState(false);
  const [rcm, setRcm] = useState(true);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 100);
  };

  const voucherNo = getVoucherNo(delivery.id, type);
  const centerNames = getCenterNames(delivery);
  const isAdvance = type === "advance";

  const ratePerTon = delivery.ratePerTon ?? 0;
  const totalWeight = delivery.totalWeightFinal ?? 0;
  const grossAmount = delivery.idealPayment ?? ratePerTon * (totalWeight / 1000);
  const advancePaid = delivery.advancePaid ?? 0;
  const waitingCharges = delivery.waitingCharges ?? 0;
  const netFinalPayment = delivery.actuallyPaid ?? 0;
  const totalPayment = advancePaid + netFinalPayment;
  // Implied misc charges: shown when gross - advance doesn't equal net final
  const impliedMisc = Math.round((totalPayment - grossAmount) * 100) / 100;
  const hasMisc = Math.abs(grossAmount - advancePaid - netFinalPayment) > 0.01;
  const paymentAmount = isAdvance ? advancePaid : netFinalPayment;
  const voucherDate = isAdvance ? delivery.createdAt : delivery.actualDeliveryDt ?? delivery.updatedAt;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
          background: #f5f5f5;
          min-height: 100dvh;
          -webkit-font-smoothing: antialiased;
          color: #111;
        }

        /* Top bar */
        .top-bar {
          position: sticky; top: 0; z-index: 50;
          background: #111;
          padding: 11px 16px;
          display: flex; align-items: center; gap: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .top-bar-title { color: #fff; font-size: 14px; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .top-bar-sub { color: #999; font-size: 10px; margin-top: 1px; }
        .btn-back {
          background: transparent; color: #ccc; border: 1px solid #444;
          border-radius: 6px; padding: 7px 12px; font-size: 12px; font-weight: 600;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .btn-back:active { background: #222; }
        .btn-print {
          background: #fff; color: #111; border: none;
          border-radius: 6px; padding: 8px 14px; font-size: 12px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; gap: 6px;
          white-space: nowrap; flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .btn-print:active { background: #e5e5e5; }
        .rcm-toggle {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.08); border: 1px solid #444;
          border-radius: 6px; padding: 6px 10px; cursor: pointer;
          flex-shrink: 0; -webkit-tap-highlight-color: transparent;
        }
        .rcm-toggle-label { font-size: 11px; color: #aaa; white-space: nowrap; }
        .rcm-chip {
          font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 4px;
        }
        .rcm-chip.yes { background: #fff; color: #111; }
        .rcm-chip.no  { background: #333; color: #888; }

        /* Scroll container */
        .voucher-scroll { padding: 16px; max-width: 680px; margin: 0 auto; }

        /* Card */
        .voucher-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #ddd;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }

        /* Header */
        .v-header {
          background: #fff;
          border-bottom: 2px solid #111;
          padding: 18px 20px 14px;
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
        }
        .v-logo-row { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .v-logo-box { flex-shrink: 0; display: flex; align-items: center; }
        .v-logo-box img { height: 40px; width: auto; display: block; }
        .v-company { min-width: 0; }
        .v-company-name { font-size: 13px; font-weight: 800; line-height: 1.25; color: #111; }
        .v-company-sub { font-size: 10px; color: #777; margin-top: 2px; }
        .v-type-badge { text-align: right; flex-shrink: 0; }
        .v-type-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        .v-type-value { font-size: 13px; font-weight: 800; color: #111; margin-top: 2px; }

        /* Meta row */
        .v-meta {
          background: #f9f9f9;
          border-bottom: 1px solid #e5e5e5;
          padding: 10px 20px;
          display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px;
        }
        .v-meta-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 3px; }
        .v-meta-value { font-size: 12px; font-weight: 700; color: #111; }
        .v-meta-item:nth-child(2) { text-align: center; }
        .v-meta-item:last-child { text-align: right; }

        /* Body */
        .v-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }

        /* Section blocks */
        .v-block {
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 12px 14px;
          background: #fff;
        }
        .v-section-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 6px; }
        .v-payto-name { font-size: 16px; font-weight: 800; color: #111; }
        .v-payto-contact { font-size: 11px; color: #555; margin-top: 3px; }

        /* Info grid */
        .v-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .v-info-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .v-info-table td { font-size: 11px; padding-bottom: 5px; vertical-align: top; }
        .v-info-table td:first-child { color: #777; width: 46%; padding-right: 6px; }
        .v-info-table td:last-child { color: #111; font-weight: 600; }

        /* Delivery bar */
        .v-delivery-bar {
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex; justify-content: space-between; align-items: center; gap: 8px;
          background: #fafafa;
        }
        .v-bar-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.7px; }
        .v-bar-value { font-size: 13px; font-weight: 700; color: #111; margin-top: 3px; }
        .v-bar-right { text-align: right; }

        /* Ledger */
        .v-ledger { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
        .v-ledger-head {
          background: #111;
          padding: 8px 14px;
          font-size: 10px; font-weight: 700; color: #fff;
          text-transform: uppercase; letter-spacing: 0.7px;
        }
        .v-ledger-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 14px;
          border-bottom: 1px solid #f0f0f0;
          background: #fff;
        }
        .v-ledger-row.subtotal { background: #f9f9f9; }
        .v-ledger-row.total {
          background: #f0f0f0;
          border-top: 1.5px solid #ccc;
          border-bottom: none;
        }
        .v-ledger-row.divider {
          background: #f9f9f9;
          padding: 3px 14px;
          border-bottom: 1px solid #ebebeb;
        }
        .v-row-label { font-size: 11px; color: #444; }
        .v-row-label.strong { font-weight: 700; color: #111; }
        .v-row-value { font-size: 12px; font-weight: 700; color: #111; }
        .v-row-value.muted { font-weight: 500; color: #555; }
        .v-row-value.large { font-size: 15px; font-weight: 800; }
        .v-divider-line { height: 1px; background: #e5e5e5; flex: 1; margin-left: 8px; }
        .v-divider-text { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.7px; white-space: nowrap; }

        /* Words */
        .v-words {
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 10px 14px;
          background: #fafafa;
        }
        .v-words-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 4px; }
        .v-words-value { font-size: 12px; font-weight: 700; color: #111; line-height: 1.4; font-style: italic; }

        /* Footer */
        .v-footer {
          border-top: 1px solid #ddd;
          padding: 8px 20px;
          background: #fafafa;
        }
        .v-footer-note { font-size: 10px; color: #aaa; }
        .v-footer-ref { font-size: 9px; color: #ccc; margin-top: 1px; word-break: break-all; }

        /* Print */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: #fff !important; }
          .top-bar { display: none !important; }
          .voucher-scroll { padding: 0 !important; max-width: none !important; }
          .voucher-card { border-radius: 0 !important; box-shadow: none !important; border: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Top bar */}
      <div className="top-bar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="top-bar-title">{isAdvance ? "Advance" : "Final"} Payment Voucher</div>
          <div className="top-bar-sub">{voucherNo}</div>
        </div>
        <button className="btn-back" onClick={() => window.history.back()}>← Back</button>
        <button className="rcm-toggle" onClick={() => setRcm(p => !p)} title="Toggle RCM">
          <span className="rcm-toggle-label">RCM</span>
          <span className={`rcm-chip ${rcm ? "yes" : "no"}`}>{rcm ? "YES" : "NO"}</span>
        </button>
        <button className="btn-print" onClick={handlePrint} disabled={printing}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7" /><rect x="6" y="14" width="12" height="8" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          </svg>
          {printing ? "Opening…" : "Download PDF"}
        </button>
      </div>

      {/* Voucher */}
      <div className="voucher-scroll">
        <div className="voucher-card">

          {/* Header */}
          <div className="v-header">
            <div className="v-logo-row">
              <div className="v-logo-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bullLogo.ico" alt="Bull Logo" />
              </div>
              <div className="v-company">
                <div className="v-company-name">{COMPANY_NAME}</div>
                <div className="v-company-sub">Agricultural Commodity Logistics</div>
              </div>
            </div>
            <div className="v-type-badge">
              <div className="v-type-label">Payment Voucher</div>
              <div className="v-type-value">{isAdvance ? "Advance" : "Final"}</div>
            </div>
          </div>

          {/* Meta */}
          <div className="v-meta">
            <div className="v-meta-item">
              <div className="v-meta-label">Voucher No.</div>
              <div className="v-meta-value" style={{ fontSize: 10 }}>{voucherNo}</div>
            </div>
            <div className="v-meta-item">
              <div className="v-meta-label">Date</div>
              <div className="v-meta-value" style={{ fontSize: 10 }}>{fmtDate(voucherDate)}</div>
            </div>
            <div className="v-meta-item">
              <div className="v-meta-label">Mode</div>
              <div className="v-meta-value" style={{ fontSize: 10 }}>Bank Transfer</div>
            </div>
            <div className="v-meta-item" style={{ textAlign: "right" }}>
              <div className="v-meta-label">RCM Applicable</div>
              <div className="v-meta-value" style={{ fontSize: 10 }}>{rcm ? "YES" : "NO"}</div>
            </div>
          </div>

          {/* Body */}
          <div className="v-body">

            {/* Pay To */}
            <div className="v-block">
              <div className="v-section-label">Pay To (Transporter)</div>
              <div className="v-payto-name">{delivery.transporterName || "—"}</div>
              {delivery.transpContact && (
                <div className="v-payto-contact">Contact: {delivery.transpContact}</div>
              )}
            </div>

            {/* Vehicle + Shipment */}
            <div className="v-info-grid">
              <div className="v-block">
                <div className="v-section-label">Vehicle Details</div>
                <table className="v-info-table">
                  <tbody>
                    <tr><td>Vehicle No.</td><td>{delivery.vehicleNumber || "—"}</td></tr>
                    <tr><td>Driver</td><td>{delivery.driverName || "—"}</td></tr>
                    <tr><td>Contact</td><td>{delivery.driverContact || "—"}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="v-block">
                <div className="v-section-label">Shipment</div>
                <table className="v-info-table">
                  <tbody>
                    <tr><td>Commodity</td><td>{delivery.masterRequest?.commodity || "Castor"}</td></tr>
                    <tr><td>Invoice No.</td><td>{delivery.invoiceNo || "—"}</td></tr>
                    <tr><td>Centers</td><td style={{ fontSize: 10 }}>{centerNames}</td></tr>
                    <tr><td>Delivery</td><td style={{ fontSize: 10 }}>{delivery.factory?.factoryName || delivery.deliveryLoc || "—"}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actual delivery date (final only) */}
            {!isAdvance && delivery.actualDeliveryDt && (
              <div className="v-delivery-bar">
                <div>
                  <div className="v-bar-label">Actual Delivery Date</div>
                  <div className="v-bar-value">{fmtDate(delivery.actualDeliveryDt)}</div>
                </div>
                <div className="v-bar-right">
                  <div className="v-bar-label">Final Weight</div>
                  <div className="v-bar-value">{fmtWeight(delivery.totalWeightFinal)}</div>
                </div>
              </div>
            )}

            {/* Payment Ledger */}
            <div className="v-ledger">
              <div className="v-ledger-head">Payment Details</div>

              {isAdvance ? (
                <>
                  <div className="v-ledger-row">
                    <span className="v-row-label">Transport Rate</span>
                    <span className="v-row-value muted">₹{ratePerTon.toLocaleString("en-IN")} / MT</span>
                  </div>
                  <div className="v-ledger-row">
                    <span className="v-row-label">Estimated Weight</span>
                    <span className="v-row-value muted">{fmtWeight(delivery.totalWeightFinal)}</span>
                  </div>
                  <div className="v-ledger-row subtotal">
                    <span className="v-row-label">Gross Transport Amount</span>
                    <span className="v-row-value">{fmt(grossAmount)}</span>
                  </div>
                  <div className="v-ledger-row total">
                    <span className="v-row-label strong">Advance Payment</span>
                    <span className="v-row-value large">{fmt(advancePaid)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="v-ledger-row">
                    <span className="v-row-label">Final Weight</span>
                    <span className="v-row-value muted">{fmtWeight(delivery.totalWeightFinal)}</span>
                  </div>
                  <div className="v-ledger-row">
                    <span className="v-row-label">Transport Rate</span>
                    <span className="v-row-value muted">₹{ratePerTon.toLocaleString("en-IN")} / MT</span>
                  </div>
                  <div className="v-ledger-row subtotal">
                    <span className="v-row-label">Gross Transport Amount</span>
                    <span className="v-row-value">{fmt(grossAmount)}</span>
                  </div>
                  <div className="v-ledger-row divider">
                    <span className="v-divider-text">Deductions</span>
                    <div className="v-divider-line" />
                  </div>
                  <div className="v-ledger-row">
                    <span className="v-row-label">Advance Paid</span>
                    <span className="v-row-value">({fmt(advancePaid)})</span>
                  </div>
                  {hasMisc && (
                    <div className="v-ledger-row">
                      <span className="v-row-label">Misc Charges</span>
                      <span className="v-row-value">+ {fmt(impliedMisc)}</span>
                    </div>
                  )}
                  {waitingCharges > 0 && (
                    <div className="v-ledger-row">
                      <span className="v-row-label">Waiting Charges</span>
                      <span className="v-row-value">+ {fmt(waitingCharges)}</span>
                    </div>
                  )}
                  <div className="v-ledger-row subtotal">
                    <span className="v-row-label">Net Final Payment</span>
                    <span className="v-row-value">{fmt(netFinalPayment)}</span>
                  </div>
                  <div className="v-ledger-row divider">
                    <span className="v-divider-text">Summary</span>
                    <div className="v-divider-line" />
                  </div>
                  <div className="v-ledger-row total">
                    <span className="v-row-label strong">Total Payment (Advance + Final)</span>
                    <span className="v-row-value large">{fmt(totalPayment)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Amount in words */}
            <div className="v-words">
              <div className="v-words-label">Amount in Words</div>
              <div className="v-words-value">{numberToWords(paymentAmount)} Only</div>
            </div>

          </div>

          {/* Footer */}
          <div className="v-footer">
            <div className="v-footer-note">Computer generated voucher &nbsp;·&nbsp; Ref: {delivery.id}</div>
          </div>

        </div>
      </div>
    </>
  );
}
