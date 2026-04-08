export const previtalTheme = {
  colors: {
    brand: {
      50: "#F4F8F4",
      100: "#EAF4EC",
      200: "#D6E8DA",
      300: "#BCD7C2",
      400: "#8FB79A",
      500: "#5E8F6C",
      600: "#4F6F5B",
      700: "#3D5848",
      800: "#314538",
      900: "#26352C",
    },
    surface: {
      background: "#F8F7F4",
      card: "#FFFFFF",
      muted: "#F3F5F1",
    },
    text: {
      primary: "#334155",
      secondary: "#64748B",
      muted: "#94A3B8",
    },
    border: "#E5E7EB",
    status: {
      nuevo: { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB" },
      pendiente: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
      interesado: { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" },
      "no responde": { bg: "#FFEDD5", text: "#C2410C", border: "#FDBA74" },
      contactado: { bg: "#E0F2FE", text: "#0369A1", border: "#7DD3FC" },
      agendado: { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
      "dato falso": { bg: "#FEE2E2", text: "#B91C1C", border: "#FCA5A5" },
      "no interesa": { bg: "#FDE2E2", text: "#991B1B", border: "#FCA5A5" },
      "en atención": { bg: "#E0E7FF", text: "#3730A3", border: "#A5B4FC" },
      asignado: { bg: "#F3E8FF", text: "#7E22CE", border: "#D8B4FE" },
      vendido: { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
      perdido: { bg: "#FEE2E2", text: "#B91C1C", border: "#FCA5A5" },
      cerrado: { bg: "#E2E8F0", text: "#334155", border: "#CBD5E1" },
      default: { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
    },
  },
  radius: {
    xl: "1rem",
    "2xl": "1.25rem",
    "3xl": "1.5rem",
  },
  shadow: {
    card: "0 10px 30px rgba(79, 111, 91, 0.08)",
    soft: "0 4px 18px rgba(15, 23, 42, 0.06)",
  },
};

export type PrevitalStatusKey = keyof typeof previtalTheme.colors.status;

export function getPrevitalStatusStyle(status?: string) {
  if (!status) return previtalTheme.colors.status.default;
  const normalized = status.trim().toLowerCase() as PrevitalStatusKey;
  return previtalTheme.colors.status[normalized] || previtalTheme.colors.status.default;
}
