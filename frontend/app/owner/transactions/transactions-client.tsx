"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  TrendingUp,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { getTransactionDetail, refundTransaction } from "./actions";
import type { ProfitSummary, TransactionDetail, TransactionRow } from "./types";
import { TablePagination } from "@/components/table-pagination";

type Tab = "riwayat" | "laba";
type MethodFilter = "ALL" | "CASH" | "QRIS" | "DEBIT";
type StatusFilter = "ALL" | "COMPLETED" | "REFUNDED";

// Same color language as the owner dashboard method cards.
const METHOD_META: Record<string, { label: string; badge: string }> = {
  CASH: { label: "Tunai", badge: "bg-blue-50 text-blue-700" },
  QRIS: { label: "QRIS", badge: "bg-emerald-50 text-emerald-700" },
  DEBIT: { label: "Debit", badge: "bg-amber-50 text-amber-700" },
};

const HANDOVER_META: Record<string, { label: string; badge: string }> = {
  COURIER_CLAIMED: {
    label: "Diklaim kurir",
    badge: "bg-amber-50 text-amber-700",
  },
  CONFIRMED: {
    label: "Terkonfirmasi",
    badge: "bg-emerald-50 text-emerald-700",
  },
  DISPUTED: { label: "Sengketa", badge: "bg-red-50 text-red-700" },
};

const PERIOD_FILTERS: { key: 7 | 30; label: string }[] = [
  { key: 7, label: "7 hari" },
  { key: 30, label: "30 hari" },
];

const METHOD_FILTERS: { key: MethodFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "CASH", label: "Tunai" },
  { key: "QRIS", label: "QRIS" },
  { key: "DEBIT", label: "Debit" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "COMPLETED", label: "Selesai" },
  { key: "REFUNDED", label: "Refund" },
];

// Rows per page on the history & profit tables (shared footer).
const PAGE_SIZE = 20;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPct = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ProfitStat({
  label,
  value,
  sub,
  valueClass,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p
          className={`mt-0.5 truncate text-xl font-bold tabular-nums ${
            valueClass ?? "text-slate-900"
          }`}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
      {options.map((option) => (
        <button
          key={String(option.key)}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === option.key
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          valueClass ?? "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailPanel({
  detail,
  detailLoading,
  detailError,
  onRetry,
  refundReason,
  onRefundReasonChange,
  onRefundSubmit,
  refundPending,
  refundError,
}: {
  detail: TransactionDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onRetry: () => void;
  refundReason: string;
  onRefundReasonChange: (next: string) => void;
  onRefundSubmit: () => void;
  refundPending: boolean;
  refundError: string | null;
}) {
  if (detailLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat detail…
      </div>
    );
  }

  if (detailError || !detail) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-6">
        <p className="text-sm text-red-600">
          {detailError ?? "Detail tidak tersedia."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const method = METHOD_META[detail.paymentMethod];
  const handover = detail.handoverStatus
    ? HANDOVER_META[detail.handoverStatus]
    : null;

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold">Produk</th>
              <th className="px-3 py-2 text-center font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Harga</th>
              <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {detail.items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2 text-slate-900">
                  {item.productName}
                  <span className="text-xs text-slate-400"> / {item.unit}</span>
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-slate-700">
                  {item.quantity}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {formatRupiah(item.priceAtSaleRupiah)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                  {formatRupiah(item.subtotalRupiah)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <DetailRow
            label="Subtotal"
            value={formatRupiah(detail.subtotalRupiah)}
          />
          {detail.discountRupiah > 0 && (
            <DetailRow
              label="Diskon"
              value={`− ${formatRupiah(detail.discountRupiah)}`}
              valueClass="text-red-600"
            />
          )}
          <div className="my-1 border-t border-slate-100" />
          <DetailRow
            label="Total"
            value={formatRupiah(detail.totalRupiah)}
            valueClass="text-base font-bold"
          />
          <DetailRow label="Dibayar" value={formatRupiah(detail.paidRupiah)} />
          <DetailRow
            label="Kembalian"
            value={formatRupiah(detail.changeRupiah)}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <DetailRow label="Waktu" value={formatTime(detail.createdAtIso)} />
          <DetailRow label="Kasir" value={detail.cashierName} />
          <DetailRow
            label="Metode"
            value={method?.label ?? detail.paymentMethod}
          />
          <DetailRow
            label="Kode klaim"
            value={detail.claimCode ?? "—"}
            valueClass="font-mono"
          />
          <DetailRow
            label="Serah terima"
            value={handover?.label ?? "—"}
            valueClass={
              handover ? `text-xs ${handover.badge}` : "text-slate-400"
            }
          />
        </div>
      </div>

      {detail.status === "COMPLETED" ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p className="text-sm font-semibold text-red-800">
            Refund transaksi ini
          </p>
          <p className="mt-0.5 text-xs text-red-700/80">
            Stok setiap produk dikembalikan otomatis dan tercatat di kartu stok
            sebagai IN. Tindakan ini tidak bisa dibatalkan.
          </p>
          <textarea
            value={refundReason}
            onChange={(event) => onRefundReasonChange(event.target.value)}
            rows={2}
            maxLength={120}
            placeholder="Alasan (opsional, mis. barang rusak / salah input)"
            className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
          />
          {refundError && (
            <p className="mt-2 text-xs font-semibold text-red-700">
              {refundError}
            </p>
          )}
          <button
            type="button"
            onClick={onRefundSubmit}
            disabled={refundPending}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refundPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {refundPending ? "Memproses…" : "Refund & kembalikan stok"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          Transaksi ini sudah direfund — stok telah dikembalikan dan uang
          dianggap kembali ke pembeli.
        </div>
      )}
    </div>
  );
}

export function TransactionsClient({
  outletName,
  userName,
  rows,
  weekSummary,
  monthSummary,
}: {
  outletName: string;
  userName: string;
  rows: TransactionRow[];
  weekSummary: ProfitSummary;
  monthSummary: ProfitSummary;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("riwayat");
  const [days, setDays] = useState<7 | 30>(30);
  const [method, setMethod] = useState<MethodFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundPending, setRefundPending] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [profitDays, setProfitDays] = useState<7 | 30>(30);
  const [profitPage, setProfitPage] = useState(1);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (method !== "ALL" && row.paymentMethod !== method) return false;
      if (new Date(row.createdAtIso).getTime() < cutoff) return false;
      if (needle && !row.code.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, days, method, status, query]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const completedOmzet = filtered
    .filter((row) => row.status === "COMPLETED")
    .reduce((sum, row) => sum + row.totalRupiah, 0);
  const refundCount = filtered.filter(
    (row) => row.status === "REFUNDED",
  ).length;

  async function loadDetail(transactionId: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await getTransactionDetail(transactionId);
      if (result.ok) {
        setDetail(result.detail);
      } else {
        setDetailError(result.error);
      }
    } catch {
      setDetailError("Gagal memuat detail transaksi.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleDetail(transactionId: string) {
    if (expandedId === transactionId) {
      setExpandedId(null);
      setDetail(null);
      setDetailError(null);
      return;
    }
    setExpandedId(transactionId);
    setDetail(null);
    setDetailError(null);
    setRefundReason("");
    setRefundError(null);
    await loadDetail(transactionId);
  }

  async function submitRefund() {
    if (!expandedId || refundPending) return;
    setRefundPending(true);
    setRefundError(null);
    try {
      const result = await refundTransaction({
        transactionId: expandedId,
        reason: refundReason.trim() || undefined,
      });
      if (result.ok) {
        // Refresh the detail panel (status flips to REFUNDED, the
        // refund box disappears) and the server-rendered list.
        await loadDetail(expandedId);
        router.refresh();
      } else {
        setRefundError(result.error);
      }
    } catch {
      setRefundError("Gagal memproses refund.");
    } finally {
      setRefundPending(false);
    }
  }

  const activeSummary = profitDays === 7 ? weekSummary : monthSummary;

  // Pagination for the per-product profit table (same 20 rows rule).
  useEffect(() => {
    setProfitPage(1);
  }, [profitDays]);
  const profitPageCount = Math.max(
    1,
    Math.ceil(activeSummary.rows.length / PAGE_SIZE),
  );
  const safeProfitPage = Math.min(profitPage, profitPageCount);
  const profitPageRows = activeSummary.rows.slice(
    (safeProfitPage - 1) * PAGE_SIZE,
    safeProfitPage * PAGE_SIZE,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                Riwayat Transaksi — {outletName}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {userName} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <div className="flex w-fit gap-1 rounded-2xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("riwayat")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === "riwayat"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Riwayat
          </button>
          <button
            type="button"
            onClick={() => setTab("laba")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === "laba"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Laba
          </button>
        </div>

        {tab === "riwayat" ? (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari kode struk… (mis. TRX-20261022)"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <ChipGroup
                  options={PERIOD_FILTERS}
                  value={days}
                  onChange={setDays}
                />
                <ChipGroup
                  options={METHOD_FILTERS}
                  value={method}
                  onChange={setMethod}
                />
                <ChipGroup
                  options={STATUS_FILTERS}
                  value={status}
                  onChange={setStatus}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Transaksi tampil"
                value={String(filtered.length)}
              />
              <MiniStat
                label="Omzet selesai"
                value={formatRupiah(completedOmzet)}
              />
              <MiniStat label="Refund" value={`${refundCount} transaksi`} />
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Transaksi
                </h2>
                <p className="text-[11px] text-slate-400">
                  {rows.length} transaksi terakhir dimuat
                </p>
              </div>
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-slate-400">
                    Tidak ada transaksi yang cocok dengan filter.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pageRows.map((row) => {
                    const methodMeta = METHOD_META[row.paymentMethod];
                    const isRefunded = row.status === "REFUNDED";
                    const expanded = expandedId === row.id;
                    return (
                      <div key={row.id}>
                        <button
                          type="button"
                          onClick={() => toggleDetail(row.id)}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {row.code}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {formatTime(row.createdAtIso)} · {row.itemCount}{" "}
                              item · {row.cashierName}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              methodMeta?.badge ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {methodMeta?.label ?? row.paymentMethod}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isRefunded
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isRefunded ? "Refund" : "Selesai"}
                          </span>
                          <p
                            className={`shrink-0 text-sm font-bold tabular-nums ${
                              isRefunded
                                ? "text-slate-400 line-through"
                                : "text-slate-900"
                            }`}
                          >
                            {formatRupiah(row.totalRupiah)}
                          </p>
                          {expanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                        </button>
                        {expanded && (
                          <DetailPanel
                            detail={detail}
                            detailLoading={detailLoading}
                            detailError={detailError}
                            onRetry={() => {
                              if (expandedId) loadDetail(expandedId);
                            }}
                            refundReason={refundReason}
                            onRefundReasonChange={setRefundReason}
                            onRefundSubmit={submitRefund}
                            refundPending={refundPending}
                            refundError={refundError}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <TablePagination
                page={safePage}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                unit="transaksi"
                onPage={setPage}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex w-fit rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setProfitDays(7)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profitDays === 7
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                7 hari
              </button>
              <button
                type="button"
                onClick={() => setProfitDays(30)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profitDays === 30
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                30 hari
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProfitStat
                label="Omzet"
                value={formatRupiah(activeSummary.omzetRupiah)}
                sub={`${activeSummary.transactionCount} transaksi selesai`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <ProfitStat
                label="Harga pokok (HPP)"
                value={formatRupiah(activeSummary.costRupiah)}
                sub="memakai harga beli terkini"
                icon={<Calculator className="h-4 w-4" />}
              />
              <ProfitStat
                label="Laba kotor"
                value={formatRupiah(activeSummary.profitRupiah)}
                sub="omzet dikurangi HPP"
                valueClass={
                  activeSummary.profitRupiah >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }
                icon={<Calculator className="h-4 w-4" />}
              />
              <ProfitStat
                label="Margin"
                value={formatPct(activeSummary.marginPct)}
                sub="laba dibagi omzet"
                valueClass={
                  (activeSummary.marginPct ?? 0) >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>

            {activeSummary.rows.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                  Belum ada penjualan selesai pada periode ini.
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    Laba per Produk
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {activeSummary.rows.length} produk terjual
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2 font-semibold">Produk</th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Terjual
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Omzet
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          HPP
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Laba
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Margin
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profitPageRows.map((row) => (
                        <tr key={row.productId}>
                          <td className="px-4 py-2.5 text-slate-900">
                            {row.name}
                            <span className="text-xs text-slate-400">
                              {" "}
                              / {row.unit}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                            {row.soldQuantity}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                            {formatRupiah(row.revenueRupiah)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                            {formatRupiah(row.costRupiah)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                              row.profitRupiah >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatRupiah(row.profitRupiah)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                            {formatPct(row.marginPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={safeProfitPage}
                  pageCount={profitPageCount}
                  pageSize={PAGE_SIZE}
                  total={activeSummary.rows.length}
                  unit="produk"
                  onPage={setProfitPage}
                />
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Catatan: HPP dihitung memakai harga beli terkini tiap produk
              (harga beli tidak di-snapshot saat penjualan) — angka laba adalah
              perkiraan yang wajar untuk warung. Transaksi refund tidak
              dihitung.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
