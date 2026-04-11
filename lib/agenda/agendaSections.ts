export type ReceptionSection =
  | "agenda"
  | "especialistas"
  | "tratamientos"
  | "impresiones"
  | "inventario"
  | "comercial";

export const generalServiceOptions = [
  { value: "valoracion", label: "Valoración" },
  { value: "otro", label: "Otro" },
];

export const specialistOptions = [
  { value: "nutricion", label: "Nutrición" },
  { value: "medico", label: "Médico" },
];

export const treatmentOptions = [
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "detox", label: "Detox" },
];

const specialistValues = new Set(specialistOptions.map((item) => item.value));
const treatmentValues = new Set(treatmentOptions.map((item) => item.value));

export function getSectionForService(serviceType: string | null | undefined): ReceptionSection {
  const value = (serviceType || "").trim().toLowerCase();
  if (specialistValues.has(value)) return "especialistas";
  if (treatmentValues.has(value)) return "tratamientos";
  return "agenda";
}

export function getSectionLabel(section: ReceptionSection) {
  if (section === "especialistas") return "Especialistas";
  if (section === "tratamientos") return "Tratamientos";
  if (section === "impresiones") return "Impresiones y entregas";
  if (section === "inventario") return "Inventario";
  if (section === "comercial") return "Ingreso comercial";
  return "Agenda";
}

export function getServiceFieldLabel(section: ReceptionSection) {
  if (section === "especialistas") return "Especialista";
  if (section === "tratamientos") return "Tratamiento";
  if (section === "impresiones" || section === "inventario" || section === "comercial") return "Servicio";
  return "Servicio";
}

export function getServiceOptionsBySection(section: ReceptionSection) {
  if (section === "especialistas") return specialistOptions;
  if (section === "tratamientos") return treatmentOptions;
  if (section === "impresiones" || section === "inventario" || section === "comercial") return [];
  return generalServiceOptions;
}
