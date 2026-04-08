import { CalendarDays, Phone, Printer, Search, UserPlus } from "lucide-react";
import { PrevitalPageHeader } from "@/components/layout/prevital-page-header";
import {
  PrevitalFilterBar,
  PrevitalFilterGroup,
  PrevitalInput,
  PrevitalSelect,
} from "@/components/layout/prevital-filter-bar";
import { PrevitalButton } from "@/components/ui/prevital-button";
import {
  PrevitalCard,
  PrevitalCardContent,
  PrevitalCardHeader,
} from "@/components/ui/prevital-card";
import { PrevitalBadge } from "@/components/ui/prevital-badge";
import {
  PrevitalTable,
  PrevitalTableBody,
  PrevitalTableCell,
  PrevitalTableHead,
  PrevitalTableHeaderCell,
  PrevitalTableRow,
  PrevitalTableShell,
} from "@/components/tables/prevital-table-shell";

const leads = [
  { nombre: "María Gómez", estado: "Nuevo", modulo: "Call Center", fecha: "Hoy" },
  { nombre: "Carlos Pérez", estado: "Agendado", modulo: "Recepción", fecha: "Hoy" },
  { nombre: "Ana Ruiz", estado: "En atención", modulo: "Comercial", fecha: "Hoy" },
  { nombre: "Jorge López", estado: "Pendiente", modulo: "Gerencia comercial", fecha: "Hoy" },
];

export default function DemoPrevitalPage() {
  return (
    <main className="min-h-screen bg-[#F8F7F4] p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PrevitalPageHeader
          title="CRM Prevital"
          subtitle="Vista de ejemplo del estilo visual sugerido para el sistema."
          actions={
            <>
              <PrevitalButton variant="secondary" leftIcon={<Printer size={16} />}>
                Vista previa
              </PrevitalButton>
              <PrevitalButton leftIcon={<UserPlus size={16} />}>
                Nuevo lead
              </PrevitalButton>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Leads hoy", value: "28", icon: <Phone size={18} /> },
            { title: "Citas del día", value: "14", icon: <CalendarDays size={18} /> },
            { title: "Pendientes", value: "9", icon: <Search size={18} /> },
            { title: "Impresiones", value: "6", icon: <Printer size={18} /> },
          ].map((item) => (
            <PrevitalCard key={item.title}>
              <PrevitalCardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{item.title}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-800">{item.value}</p>
                </div>
                <div className="rounded-2xl bg-[#EAF4EC] p-3 text-[#4F6F5B]">
                  {item.icon}
                </div>
              </PrevitalCardContent>
            </PrevitalCard>
          ))}
        </section>

        <PrevitalFilterBar>
          <PrevitalFilterGroup>
            <PrevitalInput placeholder="Buscar por nombre o teléfono" />
            <PrevitalSelect defaultValue="hoy">
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="manana">Mañana</option>
            </PrevitalSelect>
            <PrevitalSelect defaultValue="todos">
              <option value="todos">Todos los estados</option>
              <option value="nuevo">Nuevo</option>
              <option value="agendado">Agendado</option>
              <option value="pendiente">Pendiente</option>
            </PrevitalSelect>
          </PrevitalFilterGroup>

          <div className="flex items-center gap-3">
            <PrevitalButton variant="ghost">Limpiar</PrevitalButton>
            <PrevitalButton>Filtrar</PrevitalButton>
          </div>
        </PrevitalFilterBar>

        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <PrevitalTableShell>
            <PrevitalTable>
              <PrevitalTableHead>
                <tr>
                  <PrevitalTableHeaderCell>Paciente</PrevitalTableHeaderCell>
                  <PrevitalTableHeaderCell>Estado</PrevitalTableHeaderCell>
                  <PrevitalTableHeaderCell>Módulo</PrevitalTableHeaderCell>
                  <PrevitalTableHeaderCell>Fecha</PrevitalTableHeaderCell>
                  <PrevitalTableHeaderCell className="text-right">Acciones</PrevitalTableHeaderCell>
                </tr>
              </PrevitalTableHead>
              <PrevitalTableBody>
                {leads.map((lead) => (
                  <PrevitalTableRow key={lead.nombre}>
                    <PrevitalTableCell className="font-medium text-slate-800">
                      {lead.nombre}
                    </PrevitalTableCell>
                    <PrevitalTableCell>
                      <PrevitalBadge status={lead.estado}>{lead.estado}</PrevitalBadge>
                    </PrevitalTableCell>
                    <PrevitalTableCell>{lead.modulo}</PrevitalTableCell>
                    <PrevitalTableCell>{lead.fecha}</PrevitalTableCell>
                    <PrevitalTableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <PrevitalButton variant="secondary" size="sm">
                          Ver
                        </PrevitalButton>
                        <PrevitalButton size="sm">Atender</PrevitalButton>
                      </div>
                    </PrevitalTableCell>
                  </PrevitalTableRow>
                ))}
              </PrevitalTableBody>
            </PrevitalTable>
          </PrevitalTableShell>

          <PrevitalCard>
            <PrevitalCardHeader
              title="Accesos rápidos"
              description="Pensado para Inicio o Recepción."
            />
            <PrevitalCardContent className="grid gap-3">
              <PrevitalButton className="justify-start" leftIcon={<UserPlus size={16} />}>
                Crear lead
              </PrevitalButton>
              <PrevitalButton
                variant="secondary"
                className="justify-start"
                leftIcon={<CalendarDays size={16} />}
              >
                Agenda del día
              </PrevitalButton>
              <PrevitalButton
                variant="secondary"
                className="justify-start"
                leftIcon={<Printer size={16} />}
              >
                Imprimir cita
              </PrevitalButton>
              <PrevitalButton variant="ghost" className="justify-start">
                Configurar cupos
              </PrevitalButton>
            </PrevitalCardContent>
          </PrevitalCard>
        </div>
      </div>
    </main>
  );
}
