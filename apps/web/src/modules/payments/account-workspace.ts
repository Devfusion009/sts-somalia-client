export type ReceiptRecord = {
    id: string;
    order_number: string;
    status: string;
    total: number;
    currency: string;
    created_at: string;
    paid_at: string | null;
    invoices: Array<{
        invoice_number: string;
        status: string;
        issued_at: string | null;
    }>;
    payments: Array<{
        status: string;
        amount: number;
        currency: string;
        created_at: string;
        paid_at?: string | null;
    }>;
    order_items: Array<{
        id: string;
        item_type: string;
    }>;
    booking_requests: Array<{
        kind: string;
        status: string;
        approved_amount: number | null;
        currency: string;
    }>;
};
export type ReceiptFilters = {
    q?: string;
    status?: string;
    days?: string;
    sort?: string;
    page?: string;
    invoice?: string;
};
export function parseReceiptFilters(params: Record<string, string | string[] | undefined>): ReceiptFilters {
    const first = (key: string) => Array.isArray(params[key]) ? params[key][0] : params[key];
    const status = first("status");
    const days = first("days");
    return {
        q: first("q")?.slice(0, 100),
        status: ["paid", "pending", "refunded", "cancelled"].includes(status ?? "") ? status : "all",
        days: ["30", "90", "365"].includes(days ?? "") ? days : "all",
        sort: first("sort") === "oldest" ? "oldest" : "newest",
        page: first("page"),
        invoice: first("invoice"),
    };
}
const COLLECTED = new Set(["succeeded", "partially_refunded", "refunded"]);
const PAYABLE = new Set(["pending_payment", "held", "partially_paid"]);
const toCents = (amount: number) => Math.round(Number(amount) * 100);
export function receiptAmounts(receipt: Pick<ReceiptRecord, "payments" | "booking_requests" | "status" | "total" | "currency">) {
    const paid = receipt.payments.filter(payment => COLLECTED.has(payment.status) && payment.currency === receipt.currency).reduce((sum, p) => sum + toCents(p.amount), 0);
    const refunded = receipt.booking_requests.filter(request => request.status === "completed" && ["refund", "cancellation"].includes(request.kind) && request.currency === receipt.currency).reduce((sum, r) => sum + toCents(r.approved_amount ?? 0), 0);
    const actualRefund = Math.min(paid, Math.max(0, refunded));
    const due = PAYABLE.has(receipt.status) ? Math.max(0, toCents(receipt.total) - paid) : 0;
    return { paid: paid / 100, refunded: actualRefund / 100, netPaid: (paid - actualRefund) / 100, due: due / 100 };
}
export function receiptInvoice(row: Pick<ReceiptRecord, "invoices">) {
    return row.invoices.find(invoice => invoice.status === "paid" || invoice.status === "issued") ?? row.invoices.find(invoice => invoice.status === "void") ?? null;
}
export function receiptSummary(rows: ReceiptRecord[]) {
    const paid = new Map<string, number>(), pending = new Map<string, number>();
    for (const row of rows) {
        const amounts = receiptAmounts(row);
        if (amounts.paid > 0)
            paid.set(row.currency, (paid.get(row.currency) ?? 0) + toCents(amounts.paid));
        if (amounts.due > 0)
            pending.set(row.currency, (pending.get(row.currency) ?? 0) + toCents(amounts.due));
    }
    const values = (map: Map<string, number>) => Array.from(map, ([currency, cents]) => ({ currency, amount: cents / 100 })).sort((a, b) => a.currency.localeCompare(b.currency));
    return { paid: values(paid), pending: values(pending), invoices: rows.reduce((sum, row) => sum + row.invoices.filter(invoice => invoice.status !== "draft").length, 0) };
}
export function receiptDate(row: ReceiptRecord) {
    return row.paid_at ?? row.created_at;
}
export function filterReceipts(rows: ReceiptRecord[], filters: ReceiptFilters, now = Date.now()) {
    const term = (filters.q ?? "").trim().slice(0, 100).toLocaleLowerCase();
    return rows.filter(row => !term || [row.order_number, ...row.invoices.map(invoice => invoice.invoice_number), ...row.order_items.map(item => item.item_type)].some(value => value.toLocaleLowerCase().includes(term)))
        .filter(row => !filters.status || filters.status === "all" || (filters.status === "pending" ? PAYABLE.has(row.status) : filters.status === "paid" ? ["paid", "processing", "completed"].includes(row.status) : filters.status === "refunded" ? row.status === "refunded" || receiptAmounts(row).refunded > 0 : row.status === filters.status))
        .filter(row => !["30", "90", "365"].includes(filters.days ?? "") || Date.parse(receiptDate(row)) >= now - Number(filters.days) * 86400000)
        .sort((a, b) => (filters.sort === "oldest" ? 1 : -1) * (receiptDate(a).localeCompare(receiptDate(b)) || a.id.localeCompare(b.id)));
}
export function receiptPage(filters: ReceiptFilters, length: number, size = 10) {
    const parsed = Number(filters.page ?? 1);
    return Math.min(Math.max(1, Math.ceil(length / size)), Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1);
}
export function receiptHref(filters: ReceiptFilters, changes: ReceiptFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...changes }))
        if (value)
            params.set(key, value);
    return `/account/payments${params.size ? `?${params}` : ""}`;
}
