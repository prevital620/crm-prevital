"use client";

import type { ReactNode } from "react";

type Appointment = {
  id: string;
  usuario_nombre: string | null;
  documento: string | null;
  telefono: string | null;
  tipo_cita: string;
  profesional: string | null;
  sede: string | null;
  fecha: string;
  hora: string;
  estado: string | null;
  observaciones: string | null;
};

export type ViewMode = "dia" | "semana" | "mes";

type AgendaScheduleViewProps = {
  appointments: Appointment[];
  selectedDate: string;
  viewMode: ViewMode;
  onChangeDate: (date: string) => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onConfirmAppointment?: (id: string) => void;
  onAttendAppointment?: (id: string) => void;
  onMissAppointment?: (id: string) => void;
  onRescheduleAppointment?: (appointment: Appointment) => void;
  onCancelAppointment?: (id: string) => void;
  renderDetailExtra?: (appointment: Appointment) => ReactNode;
  emptyDetailLabel?: string;
};

const secondaryButtonClass =
  "rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]";

const smallActionButtonClass =
  "rounded-2xl border border-[#CFE4D8] bg-white/90 px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F4FAF6]";

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysToISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekISO(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function addMonthsKeepingDay(isoDate: string, monthOffset: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const base = new Date(year, month - 1 + monthOffset, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const result = new Date(base.getFullYear(), base.getMonth(), Math.min(day, lastDay));
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(
    result.getDate()
  ).padStart(2, "0")}`;
}

function buildMonthDates(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const calendarStart = startOfWeekISO(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDaysToISO(calendarStart, index));
}

function isSameMonthISO(dateA: string, dateB: string) {
  return dateA.slice(0, 7) === dateB.slice(0, 7);
}

function formatWeekdayShort(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatMonthLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });
}

function formatHourLabel(hour: string) {
  const [hh, mm] = hour.split(":");
  const h = Number(hh);
  if (h === 12) return `12:${mm} m`;
  if (h === 0) return `12:${mm} am`;
  if (h < 12) return `${h}:${mm} am`;
  return `${h - 12}:${mm} pm`;
}

function badgeEstado(status: string | null) {
  switch (status) {
    case "agendada":
      return "bg-blue-100 text-blue-700";
    case "confirmada":
      return "bg-emerald-100 text-emerald-700";
    case "asisti\u00F3":
      return "bg-teal-100 text-teal-700";
    case "no asisti\u00F3":
      return "bg-red-100 text-red-700";
    case "reagendada":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function AppointmentCard({
  appointment,
  onConfirmAppointment,
  onAttendAppointment,
  onMissAppointment,
  onRescheduleAppointment,
  onCancelAppointment,
  renderDetailExtra,
}: {
  appointment: Appointment;
  onConfirmAppointment?: (id: string) => void;
  onAttendAppointment?: (id: string) => void;
  onMissAppointment?: (id: string) => void;
  onRescheduleAppointment?: (appointment: Appointment) => void;
  onCancelAppointment?: (id: string) => void;
  renderDetailExtra?: (appointment: Appointment) => ReactNode;
}) {
  const showActions =
    !!onConfirmAppointment ||
    !!onAttendAppointment ||
    !!onMissAppointment ||
    !!onRescheduleAppointment ||
    !!onCancelAppointment;

  return (
    <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_16px_34px_rgba(95,125,102,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[#24312A]">{formatHourLabel(appointment.hora)}</p>
            <span className="rounded-full border border-[#D7EADF] bg-white/85 px-3 py-1 text-xs font-medium text-[#4F6F5B] shadow-sm">
              {appointment.tipo_cita}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs ${badgeEstado(appointment.estado)}`}>
              {appointment.estado || "Sin estado"}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#32453A]">{appointment.usuario_nombre || "Sin usuario"}</p>
          <p className="mt-1 text-sm text-[#607368]">
            {appointment.documento || "Sin documento"} · {appointment.telefono || "Sin telefono"}
          </p>
          <p className="mt-1 text-sm text-[#607368]">
            Profesional: {appointment.profesional || "No registrado"} · Sede:{" "}
            {appointment.sede || "No registrada"}
          </p>
        </div>
        {showActions ? (
          <div className="flex flex-wrap gap-2">
            {onConfirmAppointment ? (
              <button onClick={() => onConfirmAppointment(appointment.id)} className={smallActionButtonClass}>Confirmar</button>
            ) : null}
            {onAttendAppointment ? (
              <button onClick={() => onAttendAppointment(appointment.id)} className={smallActionButtonClass}>Asistio</button>
            ) : null}
            {onMissAppointment ? (
              <button onClick={() => onMissAppointment(appointment.id)} className={smallActionButtonClass}>No asistio</button>
            ) : null}
            {onRescheduleAppointment ? (
              <button onClick={() => onRescheduleAppointment(appointment)} className={smallActionButtonClass}>Reagendar</button>
            ) : null}
            {onCancelAppointment ? (
              <button onClick={() => onCancelAppointment(appointment.id)} className={smallActionButtonClass}>Cancelar</button>
            ) : null}
          </div>
        ) : null}
      </div>
      {renderDetailExtra ? <div className="mt-4">{renderDetailExtra(appointment)}</div> : null}
    </div>
  );
}

export function AgendaScheduleView({
  appointments,
  selectedDate,
  viewMode,
  onChangeDate,
  onChangeViewMode,
  onConfirmAppointment,
  onAttendAppointment,
  onMissAppointment,
  onRescheduleAppointment,
  onCancelAppointment,
  renderDetailExtra,
  emptyDetailLabel = "No hay citas para este dia.",
}: AgendaScheduleViewProps) {
  const weekDates = Array.from({ length: 7 }, (_, index) => addDaysToISO(startOfWeekISO(selectedDate), index));
  const monthDates = buildMonthDates(selectedDate);
  const visibleAppointments =
    viewMode === "dia"
      ? appointments.filter((appointment) => appointment.fecha === selectedDate)
      : viewMode === "semana"
      ? appointments.filter((appointment) => weekDates.includes(appointment.fecha))
      : appointments.filter((appointment) => appointment.fecha.slice(0, 7) === selectedDate.slice(0, 7));
  const selectedDayAppointments = appointments.filter((appointment) => appointment.fecha === selectedDate);

  const groupedDates = (dates: string[]) =>
    dates.reduce<Map<string, Appointment[]>>((acc, date) => {
      acc.set(date, appointments.filter((appointment) => appointment.fecha === date));
      return acc;
    }, new Map<string, Appointment[]>());

  const weekMap = groupedDates(weekDates);
  const monthMap = groupedDates(monthDates);
  const periodLabel =
    viewMode === "dia"
      ? formatWeekdayShort(selectedDate)
      : viewMode === "semana"
      ? `${formatWeekdayShort(weekDates[0])} al ${formatWeekdayShort(weekDates[6])}`
      : formatMonthLabel(selectedDate);

  const movePeriod = (step: number) => {
    if (viewMode === "mes") {
      onChangeDate(addMonthsKeepingDay(selectedDate, step));
      return;
    }
    onChangeDate(addDaysToISO(selectedDate, viewMode === "semana" ? step * 7 : step));
  };

  return (
    <div className="mt-4 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#24312A]">
            {viewMode === "dia" ? "Agenda del dia" : viewMode === "semana" ? "Agenda semanal" : "Agenda mensual"}
          </h3>
          <p className="mt-1 text-sm text-[#607368]">Periodo visible: {periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["dia", "semana", "mes"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeViewMode(mode as ViewMode)}
              className={viewMode === mode ? "rounded-2xl bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_45%,_#5F7D66_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(63,105,82,0.22)]" : secondaryButtonClass}
            >
              {mode === "dia" ? "Dia" : mode === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[auto_auto_1fr]">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => movePeriod(-1)} className={secondaryButtonClass}>Anterior</button>
          <button type="button" onClick={() => onChangeDate(hoyISO())} className={secondaryButtonClass}>Hoy</button>
          <button type="button" onClick={() => movePeriod(1)} className={secondaryButtonClass}>Siguiente</button>
        </div>
        <input className="rounded-2xl border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]" type="date" value={selectedDate} onChange={(event) => onChangeDate(event.target.value)} />
        <div className="flex items-center rounded-[26px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm">
          {visibleAppointments.length} citas visibles
        </div>
      </div>

      {viewMode === "dia" ? (
        <div className="space-y-4">
          {visibleAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onConfirmAppointment={onConfirmAppointment}
              onAttendAppointment={onAttendAppointment}
              onMissAppointment={onMissAppointment}
              onRescheduleAppointment={onRescheduleAppointment}
              onCancelAppointment={onCancelAppointment}
              renderDetailExtra={renderDetailExtra}
            />
          ))}
        </div>
      ) : viewMode === "semana" ? (
        <div className="space-y-5">
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(248,252,249,0.98)_0%,_rgba(240,248,242,0.98)_100%)] p-4 shadow-inner">
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[980px] grid-cols-7 gap-3">
                {weekDates.map((date) => {
                  const items = weekMap.get(date) || [];
                  return (
                    <div key={date} className={`rounded-[24px] border p-4 ${date === selectedDate ? "border-[#7FA287] bg-white shadow-[0_18px_36px_rgba(95,125,102,0.14)]" : "border-[#E1ECE4] bg-white/80"}`}>
                      <button type="button" onClick={() => onChangeDate(date)} className="flex w-full items-center justify-between gap-2 text-left">
                        <p className="text-sm font-semibold text-[#24312A]">{formatWeekdayShort(date)}</p>
                        <span className="rounded-full bg-[#EEF7F1] px-2.5 py-1 text-xs font-semibold text-[#4F6F5B]">{items.length}</span>
                      </button>
                      <div className="mt-3 space-y-2">
                        {items.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-3 text-xs text-[#607368]">Sin citas</div>
                        ) : (
                          items.map((appointment) => (
                            <button key={appointment.id} type="button" onClick={() => onChangeDate(appointment.fecha)} className="w-full rounded-2xl border border-[#DCEBE1] bg-[#FCFEFC] p-3 text-left transition hover:border-[#A9CCB5] hover:bg-[#F5FCF7]">
                              <p className="text-xs font-semibold text-[#4F6F5B]">{formatHourLabel(appointment.hora)}</p>
                              <p className="mt-1 text-sm font-semibold text-[#24312A]">{appointment.usuario_nombre || "Sin usuario"}</p>
                              <p className="mt-1 text-xs text-[#607368]">{appointment.tipo_cita}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_16px_34px_rgba(95,125,102,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-[#24312A]">Detalle del dia seleccionado</h4>
                <p className="mt-1 text-sm text-[#607368]">{formatWeekdayShort(selectedDate)}</p>
              </div>
              <button type="button" onClick={() => onChangeViewMode("dia")} className={secondaryButtonClass}>Abrir vista diaria</button>
            </div>
            <div className="mt-4 space-y-4">
              {selectedDayAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-4 text-sm text-[#607368]">{emptyDetailLabel}</div>
              ) : (
                selectedDayAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onConfirmAppointment={onConfirmAppointment}
                    onAttendAppointment={onAttendAppointment}
                    onMissAppointment={onMissAppointment}
                    onRescheduleAppointment={onRescheduleAppointment}
                    onCancelAppointment={onCancelAppointment}
                    renderDetailExtra={renderDetailExtra}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(248,252,249,0.98)_0%,_rgba(240,248,242,0.98)_100%)] p-4 shadow-inner">
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[980px]">
                <div className="mb-3 grid grid-cols-7 gap-3">
                  {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((day) => (
                    <div key={day} className="rounded-2xl bg-[#EEF7F1] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#4F6F5B]">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {monthDates.map((date) => {
                    const items = monthMap.get(date) || [];
                    return (
                      <div key={date} className={`min-h-[190px] rounded-[24px] border p-3 ${date === selectedDate ? "border-[#7FA287] bg-white shadow-[0_18px_36px_rgba(95,125,102,0.14)]" : isSameMonthISO(date, selectedDate) ? "border-[#DCEBE1] bg-white/90" : "border-[#E7EFE9] bg-[#F7FAF8]"}`}>
                        <button type="button" onClick={() => onChangeDate(date)} className="flex w-full items-center justify-between gap-2 text-left">
                          <p className={`text-sm font-semibold ${isSameMonthISO(date, selectedDate) ? "text-[#24312A]" : "text-[#8A998F]"}`}>{date.slice(8, 10)}</p>
                          <span className="rounded-full bg-[#EEF7F1] px-2.5 py-1 text-xs font-semibold text-[#4F6F5B]">{items.length}</span>
                        </button>
                        <div className="mt-3 space-y-2">
                          {items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-3 text-xs text-[#607368]">Libre</div>
                          ) : (
                            items.slice(0, 3).map((appointment) => (
                              <button key={appointment.id} type="button" onClick={() => onChangeDate(appointment.fecha)} className="w-full rounded-2xl border border-[#DCEBE1] bg-[#FCFEFC] p-3 text-left transition hover:border-[#A9CCB5] hover:bg-[#F5FCF7]">
                                <p className="text-xs font-semibold text-[#4F6F5B]">{formatHourLabel(appointment.hora)}</p>
                                <p className="mt-1 text-sm font-semibold text-[#24312A]">{appointment.usuario_nombre || "Sin usuario"}</p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_16px_34px_rgba(95,125,102,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-[#24312A]">Detalle del dia seleccionado</h4>
                <p className="mt-1 text-sm text-[#607368]">{formatWeekdayShort(selectedDate)}</p>
              </div>
              <button type="button" onClick={() => onChangeViewMode("dia")} className={secondaryButtonClass}>Abrir vista diaria</button>
            </div>
            <div className="mt-4 space-y-4">
              {selectedDayAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-4 text-sm text-[#607368]">{emptyDetailLabel}</div>
              ) : (
                selectedDayAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onConfirmAppointment={onConfirmAppointment}
                    onAttendAppointment={onAttendAppointment}
                    onMissAppointment={onMissAppointment}
                    onRescheduleAppointment={onRescheduleAppointment}
                    onCancelAppointment={onCancelAppointment}
                    renderDetailExtra={renderDetailExtra}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
