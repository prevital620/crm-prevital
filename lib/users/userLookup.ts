export type UserLookupLike = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  ciudad?: string | null;
};

export function normalizeLookupValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function digitsOnly(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function isExactUserLookupMatch<T extends UserLookupLike>(
  user: T,
  lookup: string | null | undefined
) {
  const normalizedLookup = normalizeLookupValue(lookup);
  const lookupDigits = digitsOnly(lookup);

  if (!normalizedLookup && !lookupDigits) return false;

  const normalizedName = normalizeLookupValue(user.nombre);
  const normalizedDocument = normalizeLookupValue(user.documento);
  const normalizedPhone = normalizeLookupValue(user.telefono);
  const documentDigits = digitsOnly(user.documento);
  const phoneDigits = digitsOnly(user.telefono);

  return (
    (!!normalizedLookup &&
      (normalizedName === normalizedLookup ||
        normalizedDocument === normalizedLookup ||
        normalizedPhone === normalizedLookup)) ||
    (!!lookupDigits && (documentDigits === lookupDigits || phoneDigits === lookupDigits))
  );
}
