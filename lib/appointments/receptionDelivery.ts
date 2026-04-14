export type DeliverySource = "nutricion" | "fisioterapia";

export type DeliveryRecommendation = {
  productName: string;
  quantity: number;
  instructions?: string;
};

function sourceLabel(source: DeliverySource) {
  return source === "nutricion" ? "nutricion" : "fisioterapia";
}

function pendingPattern(source: DeliverySource) {
  const label = sourceLabel(source);
  return new RegExp(`^Entrega\\s+${label}\\s+pendiente:\\s*(Si|Sí|No)$`, "i");
}

function productPattern(source: DeliverySource) {
  const label = sourceLabel(source);
  return new RegExp(`^Producto\\s+${label}:\\s*(.+)$`, "i");
}

function quantityPattern(source: DeliverySource) {
  const label = sourceLabel(source);
  return new RegExp(`^Cantidad\\s+${label}:\\s*(.+)$`, "i");
}

function instructionsPattern(source: DeliverySource) {
  const label = sourceLabel(source);
  return new RegExp(`^Indicaciones\\s+${label}:\\s*(.+)$`, "i");
}

function cleanLines(notes: string | null | undefined, source: DeliverySource) {
  return (notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      return (
        !pendingPattern(source).test(line) &&
        !productPattern(source).test(line) &&
        !quantityPattern(source).test(line) &&
        !instructionsPattern(source).test(line)
      );
    });
}

export function buildPendingDeliveryNotes(
  notes: string | null | undefined,
  source: DeliverySource,
  recommendation?: DeliveryRecommendation | null
) {
  const lines = cleanLines(notes, source);
  lines.unshift(`Entrega ${sourceLabel(source)} pendiente: Si`);

  if (recommendation?.productName?.trim()) {
    lines.push(`Producto ${sourceLabel(source)}: ${recommendation.productName.trim()}`);
  }

  if (recommendation?.quantity && recommendation.quantity > 0) {
    lines.push(`Cantidad ${sourceLabel(source)}: ${recommendation.quantity}`);
  }

  if (recommendation?.instructions?.trim()) {
    lines.push(`Indicaciones ${sourceLabel(source)}: ${recommendation.instructions.trim()}`);
  }

  return lines.join("\n");
}

export function parseDeliveryRecommendation(
  notes: string | null | undefined,
  source: DeliverySource
): DeliveryRecommendation | null {
  const lines = (notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let productName = "";
  let quantity = 1;
  let instructions = "";

  for (const line of lines) {
    const productMatch = line.match(productPattern(source));
    if (productMatch) {
      productName = productMatch[1]?.trim() || "";
      continue;
    }

    const quantityMatch = line.match(quantityPattern(source));
    if (quantityMatch) {
      const nextQuantity = Number(quantityMatch[1]?.trim() || "1");
      quantity = nextQuantity > 0 ? nextQuantity : 1;
      continue;
    }

    const instructionsMatch = line.match(instructionsPattern(source));
    if (instructionsMatch) {
      instructions = instructionsMatch[1]?.trim() || "";
    }
  }

  if (!productName) return null;

  return {
    productName,
    quantity,
    instructions,
  };
}

export function hasPendingDelivery(notes: string | null | undefined, source: DeliverySource) {
  const lines = (notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.some((line) => {
    const match = line.match(pendingPattern(source));
    return !!match && /^si|sí$/i.test(match[1] || "");
  });
}

export function markDeliveryResolved(notes: string | null | undefined, source: DeliverySource) {
  const lines = cleanLines(notes, source);
  lines.unshift(`Entrega ${sourceLabel(source)} pendiente: No`);
  return lines.join("\n").trim();
}
