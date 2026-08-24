import React, { useState } from "react";
import { History, Search, User, Calendar, CheckSquare, ListTodo, FileText, Trash2, AlertCircle } from "lucide-react";
import { PM, Intervencion } from "../types";

interface InterventionsHistoryProps {
  pms: PM[];
  onDeleteIntervention: (pmId: string, interventionId: string) => void;
}

export default function InterventionsHistory({ pms, onDeleteIntervention }: InterventionsHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Gather all interventions across all PMs
  const allInterventions: { pmId: string; pmCodigo: string; pmNombre: string; int: Intervencion }[] = [];

  pms.forEach((pm) => {
    pm.intervenciones.forEach((int) => {
      allInterventions.push({
        pmId: pm.id,
        pmCodigo: pm.codigoPM,
        pmNombre: pm.nombrePM,
        int
      });
    });
  });

  // Sort interventions by date descending (most recent first)
  const sortedInterventions = allInterventions.sort((a, b) => {
    return new Date(b.int.fecha).getTime() - new Date(a.int.fecha).getTime();
  });

  // Filter based on search query and date range
  const filteredInterventions = sortedInterventions.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.pmCodigo.toLowerCase().includes(q) ||
      item.pmNombre.toLowerCase().includes(q) ||
      item.int.tecnico.toLowerCase().includes(q) ||
      item.int.descripcion.toLowerCase().includes(q);

    let matchesDate = true;
    if (item.int.fecha) {
      const itemDateStr = item.int.fecha.split("T")[0];
      if (startDate && itemDateStr < startDate) {
        matchesDate = false;
      }
      if (endDate && itemDateStr > endDate) {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-4">
      {/* HEADER & SEARCH / DATE FILTERS */}
      <div className="bg-slate-50 dark:bg-zinc-900/50 backdrop-blur-md p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              Historial de Intervenciones Sucesivas (Logs)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Registro de reparaciones completas o parciales ejecutadas sobre los puntos de medida.
            </p>
          </div>

          <div className="w-full md:w-72 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por PM, técnico, descripción..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-amber-500 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 font-medium"
            />
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-500 dark:text-zinc-500" />
          </div>
        </div>

        {/* DATE RANGE FILTER BAR */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800/60 text-xs">
          <span className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            Rango de Fechas:
          </span>

          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 dark:text-zinc-500 font-medium">Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 dark:text-zinc-500 font-medium">Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {(startDate || endDate || searchTerm) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSearchTerm("");
              }}
              className="text-[11px] font-extrabold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 cursor-pointer ml-auto uppercase"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* TIMELINE / LIST OF LOGS */}
      {filteredInterventions.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl animate-pulse">
          <History className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">No se han registrado intervenciones aún.</p>
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
            Para registrar una, vaya al Directorio y haga clic en &ldquo;Intervenir&rdquo; sobre un PM en falla.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInterventions.map(({ pmId, pmCodigo, pmNombre, int }) => (
            <div
              key={int.id}
              className="relative bg-slate-50 dark:bg-zinc-900/50 backdrop-blur-md p-5 pr-12 md:pr-14 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col md:flex-row gap-5 group/item"
            >
              {/* Trash/Delete button absolute on top-right with stateful confirm */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                {confirmDeleteId === int.id ? (
                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-950 p-1 rounded-lg border border-red-500/30 shadow-md animate-fade-in">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 px-1.5 uppercase font-mono flex items-center gap-0.5">
                      <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400 animate-pulse" />
                      ¿Eliminar?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteIntervention(pmId, int.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer transition-all uppercase"
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded cursor-pointer transition-all uppercase"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(int.id);
                      // Auto-reset after 5 seconds if not clicked
                      setTimeout(() => setConfirmDeleteId(prev => prev === int.id ? null : prev), 5000);
                    }}
                    className="p-2 text-slate-500 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-zinc-950/60 hover:bg-red-500/10 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-red-500/20 transition-all cursor-pointer shadow-sm md:opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                    title="Eliminar registro de intervención"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>

              {/* LEFT INFO: PM & TECHNICIAN */}
              <div className="md:w-1/4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-zinc-800/80 pb-3 md:pb-0 md:pr-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Solucionado
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">ID: {int.id}</span>
                  </div>
                  <h4 className="font-mono font-extrabold text-slate-900 dark:text-zinc-100 text-sm leading-tight">
                    PM: {pmCodigo}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">{pmNombre}</p>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <User className="w-4 h-4 text-slate-500 dark:text-zinc-500" />
                    <span>{int.tecnico}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium font-mono">
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-500" />
                    <span>{int.fecha}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT INFO: REPAIRED FAILURES & DETAILS */}
              <div className="flex-1 space-y-4">
                
                {/* WORK REPORT */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" />
                    Informe de Trabajo / Acción
                  </div>
                  <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-medium bg-white dark:bg-zinc-950 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 italic">
                    &ldquo;{int.descripcion}&rdquo;
                  </p>
                </div>

                {/* DETAILS COMPLETED & PENDING */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1.5 border-t border-slate-200 dark:border-zinc-800/80">
                  
                  {/* CORRECTED */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      Fallas Corregidas ({int.fallasCorregidas.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {int.fallasCorregidas.map((fc) => (
                        <span
                          key={fc.id}
                          className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 px-2.5 py-1 rounded-md text-xs font-bold"
                        >
                          {fc.componente} ({fc.detalle})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* PENDING */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <ListTodo className="w-3.5 h-3.5 text-amber-500" />
                      Quedaron Pendientes ({int.fallasPendientes.length})
                    </div>
                    {int.fallasPendientes.length === 0 ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15 inline-block uppercase tracking-wider">
                        🎉 PM Totalmente Reparado
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {int.fallasPendientes.map((fp) => (
                          <span
                            key={fp.id}
                            className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15 px-2.5 py-1 rounded-md text-xs font-bold"
                          >
                            {fp.componente} ({fp.detalle})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
