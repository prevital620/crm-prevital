export type QuickAction = {
  title: string;
  subtitle: string;
  href: string;
  roles: string[];
};

export const quickActions: QuickAction[] = [
  {
    title: "Nuevo lead",
    subtitle: "Registrar un lead nuevo.",
    href: "/leads/nuevo",
    roles: ["super_user", "promotor_opc", "supervisor_opc", "supervisor_call_center", "confirmador", "tmk"],
  },
  {
    title: "Consultar leads",
    subtitle: "Revisar leads creados y su estado.",
    href: "/leads",
    roles: ["super_user", "promotor_opc", "supervisor_opc", "supervisor_call_center", "confirmador", "tmk"],
  },
  {
    title: "Importar leads",
    subtitle: "Subir plantilla CSV de redes con repetidos ignorados.",
    href: "/leads/importar",
    roles: ["super_user", "supervisor_call_center", "confirmador"],
  },
  {
    title: "Crear usuario",
    subtitle: "Registrar usuario y asignar departamento y rol.",
    href: "/usuarios/nuevo",
    roles: ["super_user"],
  },
  {
    title: "Usuarios y roles",
    subtitle: "Consultar usuarios y administrar personal de tu grupo.",
    href: "/usuarios",
    roles: ["super_user", "supervisor_opc", "supervisor_call_center"],
  },
  {
    title: "Vista por rol",
    subtitle: "Previsualizar los modulos visibles para cada rol.",
    href: "/roles-vista",
    roles: ["super_user"],
  },
  {
    title: "Carga historica",
    subtitle: "Registrar casos anteriores con fechas reales.",
    href: "/carga-historica",
    roles: ["super_user"],
  },
  {
    title: "Gestion de leads",
    subtitle: "Asignar y gestionar leads del call center.",
    href: "/call-center",
    roles: ["super_user", "supervisor_call_center", "confirmador"],
  },
  {
    title: "Ver agenda",
    subtitle: "Consultar agenda visible y gestionar citas.",
    href: "/recepcion?view=agenda",
    roles: ["super_user", "supervisor_call_center", "confirmador"],
  },
  {
    title: "Agendar nuevo",
    subtitle: "Ver tus pendientes por agendar y crear citas.",
    href: "/leads?filter=pendientes_cita&date=all",
    roles: ["tmk"],
  },
  {
    title: "Configurar cupos",
    subtitle: "Abrir agenda y organizar cupos del dia.",
    href: "/recepcion?view=config",
    roles: ["super_user"],
  },
  {
    title: "Recepcion",
    subtitle: "Incluye agenda, citas, admision y configuracion de cupos.",
    href: "/recepcion",
    roles: ["super_user", "recepcion"],
  },
  {
    title: "Manifiestos",
    subtitle: "Consultar e imprimir manifiestos sin abrir recepcion completa.",
    href: "/manifiestos",
    roles: [
      "super_user",
      "administrador",
      "recepcion",
      "gerencia_comercial",
      "supervisor_opc",
      "supervisor_call_center",
      "confirmador",
    ],
  },
  {
    title: "Consulta cliente",
    subtitle: "Ver trazabilidad operativa y comercial sin mostrar contenido clinico.",
    href: "/consulta-cliente",
    roles: [
      "super_user",
      "administrador",
      "recepcion",
      "comercial",
      "gerencia_comercial",
      "gerente",
      "gerente_comercial",
      "tmk",
      "nutricionista",
      "fisioterapeuta",
      "medico_general",
      "coordinador_clinico",
      "auditor_clinico",
    ],
  },
  {
    title: "Nutricion",
    subtitle: "Ver agenda, pacientes y valoracion nutricional.",
    href: "/nutricion",
    roles: ["super_user", "nutricionista"],
  },
  {
    title: "Fisioterapia",
    subtitle: "Ver agenda, pacientes y atencion de fisioterapia.",
    href: "/fisioterapia",
    roles: ["super_user", "fisioterapeuta"],
  },
  {
    title: "Comercial",
    subtitle: "Gestionar seguimiento y cierre comercial.",
    href: "/comercial",
    roles: ["super_user", "comercial", "gerencia_comercial"],
  },
  {
    title: "Crear cliente nuevo",
    subtitle: "Abrir el formulario comercial para registrar un cliente nuevo.",
    href: "/comercial#crear-cliente",
    roles: ["super_user", "comercial", "gerencia_comercial", "gerente_comercial", "gerente"],
  },
  {
    title: "Registro de clientes",
    subtitle: "Registrar clientes desde el formulario de recepcion comercial.",
    href: "/recepcion?view=comercial",
    roles: ["super_user", "gerencia_comercial", "gerente_comercial", "gerente"],
  },
  {
    title: "Retractos y renegociaciones",
    subtitle: "Preparar ajustes de ventas con impacto financiero y comisional.",
    href: "/comercial/ajustes",
    roles: ["super_user", "gerente", "gerente_comercial", "gerencia_comercial"],
  },
  {
    title: "Gerencia comercial",
    subtitle: "Supervisar cartera, ventas y desempeno comercial.",
    href: "/gerencia/comercial",
    roles: ["super_user", "gerencia_comercial"],
  },
  {
    title: "Admin",
    subtitle: "Ver resumen administrativo, ventas, cartera y base comisionable.",
    href: "/admin",
    roles: ["super_user", "administrador"],
  },
  {
    title: "Consultar comisiones",
    subtitle: "Ver comisiones propias y, si aplica, las del equipo.",
    href: "/admin/comisiones",
    roles: [
      "super_user",
      "administrador",
      "promotor_opc",
      "supervisor_opc",
      "tmk",
      "supervisor_call_center",
      "confirmador",
      "comercial",
      "gerencia_comercial",
      "gerente_comercial",
      "gerente",
    ],
  },
];

export function getVisibleQuickActions(roleCodes: Array<string | null | undefined>) {
  const effectiveRoles = Array.from(new Set(roleCodes.filter(Boolean))) as string[];

  if (effectiveRoles.length === 0) return [];

  const base = quickActions.filter((action) =>
    action.roles.some((role) => effectiveRoles.includes(role))
  );

  const isCommercialProfile =
    effectiveRoles.includes("comercial") ||
    effectiveRoles.includes("gerencia_comercial") ||
    effectiveRoles.includes("gerente_comercial") ||
    effectiveRoles.includes("gerente");

  const withCommercialEssentials = [...base];

  if (isCommercialProfile) {
    const commercialEssentials = ["/comercial#crear-cliente", "/admin/comisiones"];

    commercialEssentials.forEach((href) => {
      if (!withCommercialEssentials.some((action) => action.href === href)) {
        const found = quickActions.find((action) => action.href === href);
        if (found) {
          withCommercialEssentials.push(found);
        }
      }
    });
  }

  if (effectiveRoles.includes("promotor_opc")) {
    return withCommercialEssentials.sort((a, b) => {
      const order: Record<string, number> = {
        "/leads/nuevo": 1,
        "/leads": 2,
      };
      return (order[a.href] ?? 99) - (order[b.href] ?? 99);
    });
  }

  if (effectiveRoles.includes("tmk")) {
    return withCommercialEssentials.sort((a, b) => {
      const order: Record<string, number> = {
        "/leads/nuevo": 1,
        "/leads": 2,
        "/consulta-cliente": 3,
        "/leads?filter=pendientes_cita&date=all": 4,
        "/admin/comisiones": 5,
      };
      return (order[a.href] ?? 99) - (order[b.href] ?? 99);
    });
  }

  if (effectiveRoles.includes("confirmador")) {
    return withCommercialEssentials.sort((a, b) => {
      const order: Record<string, number> = {
        "/call-center": 1,
        "/leads": 2,
        "/admin/comisiones": 3,
        "/manifiestos": 4,
        "/recepcion?view=agenda": 5,
        "/leads/nuevo": 6,
        "/leads/importar": 7,
      };
      return (order[a.href] ?? 99) - (order[b.href] ?? 99);
    });
  }

  if (effectiveRoles.includes("super_user")) {
    return withCommercialEssentials.filter(
      (action) => !["/recepcion?view=agenda", "/recepcion?view=config"].includes(action.href)
    );
  }

  if (isCommercialProfile) {
    return withCommercialEssentials.sort((a, b) => {
      const order: Record<string, number> = {
        "/consulta-cliente": 1,
        "/recepcion?view=comercial": 2,
        "/comercial#crear-cliente": 3,
        "/comercial": 4,
        "/admin/comisiones": 5,
        "/fisioterapia": 6,
        "/nutricion": 7,
      };
      return (order[a.href] ?? 99) - (order[b.href] ?? 99);
    });
  }

  return withCommercialEssentials;
}
