"use client";

export function ProfileSaleRow({ sale }: { sale: any }) {
  return (
    <div key={sale.id} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3" data-rl-component="ProfileSaleRow">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{sale.listing_title}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">{sale.created_at ? new Date(sale.created_at).toLocaleDateString() : ""}</p>
      </div>
      <span className="text-sm font-bold text-primary-700">€{(sale.amount_cents / 100).toFixed(2)}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
        sale.payment_status === "paid" ? "bg-green-100 text-green-700" :
        sale.payment_status === "pending" ? "bg-amber-100 text-amber-700" :
        "bg-red-100 text-red-700"
      }`}>{sale.payment_status}</span>
    </div>
  );
}
