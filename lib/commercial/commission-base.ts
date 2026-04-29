const CREDIT_PAYMENT_METHODS = new Set(["creditos", "addi", "welly", "medipay", "sumaspay"]);
const CREDIT_PROVIDERS = new Set(["addi", "welly", "medipay", "sumaspay"]);

export function isCreditCommissionPayment(params: {
  paymentMethod?: string | null;
  creditProvider?: string | null;
}) {
  const paymentMethod = (params.paymentMethod || "").trim().toLowerCase();
  const creditProvider = (params.creditProvider || "").trim().toLowerCase();

  return CREDIT_PAYMENT_METHODS.has(paymentMethod) || CREDIT_PROVIDERS.has(creditProvider);
}

export function calculateNetCommissionBase(params: {
  cashAmount?: number | null;
  paymentMethod?: string | null;
  creditProvider?: string | null;
}) {
  const cashAmount = Number(params.cashAmount || 0);
  const creditDiscount = isCreditCommissionPayment(params)
    ? Math.round(cashAmount * 0.1)
    : 0;

  return Math.max(0, cashAmount - creditDiscount - 200000);
}
