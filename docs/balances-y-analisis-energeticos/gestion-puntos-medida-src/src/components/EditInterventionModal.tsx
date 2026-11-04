import React, { useState } from "react";
import { X, Calendar, User, FileText, CheckCircle2, AlertTriangle, Trash2, Save, ArrowLeft } from "lucide-react";
import { PM, Intervencion, IntervencionFalla, ActiveFailure } from "../types";

interface EditInterventionModalProps {
  pm: PM;
  intervention: Intervencion;
  onClose: () => void;
  onSave: (pmId: string, updatedIntervention: Intervencion, restoredFailures: ActiveFailure[]) => void;
  onRestoreSingleFailure?: (pmId: string, interventionId: string, failureId: string) => void;
}

const COMPONENTES_VALIDOS = ["CTs", "PTs", "Medidor", "Cableado", "Telemedida", "Compacto", "Para Revisión", "Instalación"] as const;

export default function EditInterventionModal({
  pm,
  intervention,
  onClose,
  onSave,
  onRestoreSingleFailure
}: EditInterventionModalProps) {
  // Intervention metadata
  const [fecha, setFecha] = useState(intervention.fecha ? intervention.fecha.split("T")[0] : "");
  const [tecnico, setTecnico] = useState(intervention.tecnico || "");
  const [descripcion, setDescripcion] = useState(intervention.descripcion || "");
  const [resultado, setResultado] = useState<"Corregido" | "Seguimiento">(intervention.resultado || "Corregido");
  const [loQueQuedoPendiente, setLoQueQuedoPendiente] = useState(intervention.loQueQuedoPendiente || "");

  // Failures lists
  const [fallasCorregidas, setFallasCorregidas] = useState<IntervencionFalla[]>(
    intervention.fallasCorregidas.map(f => ({ ...f }))
  );
  const [fallasPendientes, setFallasPendientes] = useState<IntervencionFalla[]>(
    (intervention.fallasPendientes || []).map(f => ({ ...f }))
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update a field on a corrected failure
  const handleUpdateCorrectedFailure = (index: number, field: keyof IntervencionFalla, value: any) => {
    setFallasCorregidas(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Update a field on a pending failure
  const handleUpdatePendingFailure = (index: number, field: keyof IntervencionFalla, value: any) => {
    setFallasPendientes(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Save changes
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tecnico.trim()) {
      setErrorMsg("Ingrese el nombre del técnico o responsable.");
      return;
    }

    if (!descripcion.trim()) {
      setErrorMsg("Ingrese la descripción o informe de trabajo.");
      return;
    }

    const updatedIntervention: Intervencion = {
      ...intervention,
      fecha,
      tecnico: tecnico.trim(),
      descripcion: descripcion.trim(),
      resultado,
      loQueQuedoPendiente: resultado === "Seguimiento" ? loQueQuedoPendiente.trim() : "",
      fallasCorregidas,
      fallasPendientes
    };

    onSave(pm.id, updatedIntervention, []);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-zinc-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-50 dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* HEADER */}
        <div className="bg-white dark:bg-zinc-950/90 border-b border-slate-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Editar Intervención
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-bold">
                ID: {intervention.id}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 font-mono mt-1">
              PM: {pm.codigoPM} <span className="text-xs font-sans text-slate-500 dark:text-zinc-400 font-normal">({pm.nombrePM})</span>
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* BASIC INTERVENTION INFO */}
          <div className="bg-white dark:bg-zinc-950/60 p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              Datos Generales de la Intervención
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">
                  Fecha de la Intervención
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                  <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-500 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">
                  Técnico / Responsable
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tecnico}
                    onChange={(e) => setTecnico(e.target.value)}
                    placeholder="Ej. Ing. Carlos Pérez"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    required
                  />
                  <User className="w-4 h-4 text-slate-500 dark:text-zinc-500 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">
                  Resultado de la Intervención
                </label>
                <select
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value as "Corregido" | "Seguimiento")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="Corregido">Corregido / Solucionado</option>
                  <option value="Seguimiento">En Seguimiento (No resuelta)</option>
                </select>
              </div>

              {resultado === "Seguimiento" && (
                <div>
                  <label className="block text-[11px] font-extrabold text-amber-600 dark:text-amber-400 mb-1.5 uppercase">
                    ¿Qué quedó pendiente?
                  </label>
                  <input
                    type="text"
                    value={loQueQuedoPendiente}
                    onChange={(e) => setLoQueQuedoPendiente(e.target.value)}
                    placeholder="Motivo del seguimiento o pendientes..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-amber-500/50 text-slate-900 dark:text-zinc-100 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">
                Informe de Trabajo / Acción Realizada
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Detalle el trabajo realizado..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
                required
              />
            </div>
          </div>

          {/* SECTION: CORRECTED FAILURES */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Fallas Corregidas en esta Intervención ({fallasCorregidas.length})
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Puede editar el detalle de cada falla corregida
              </span>
            </div>

            {fallasCorregidas.length === 0 ? (
              <div className="p-4 bg-white dark:bg-zinc-950/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                <p className="text-xs text-slate-500 dark:text-zinc-500 italic">No hay fallas corregidas en esta intervención.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fallasCorregidas.map((f, idx) => (
                  <div
                    key={f.id || idx}
                    className="p-3 bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">Falla #{idx + 1}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* COMPONENTE */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Componente</label>
                        <select
                          value={f.componente}
                          onChange={(e) => handleUpdateCorrectedFailure(idx, "componente", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                        >
                          {COMPONENTES_VALIDOS.map((comp) => (
                            <option key={comp} value={comp} className="bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200">
                              {comp}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* DETALLE */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Detalle de la Falla</label>
                        <input
                          type="text"
                          value={f.detalle || ""}
                          onChange={(e) => handleUpdateCorrectedFailure(idx, "detalle", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="Detalle..."
                        />
                      </div>

                      {/* PRIORIDAD */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Prioridad</label>
                        <select
                          value={f.prioridad || "Normal"}
                          onChange={(e) => handleUpdateCorrectedFailure(idx, "prioridad", e.target.value)}
                          className={`w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border rounded-lg text-xs font-bold focus:outline-none ${
                            f.prioridad === "Alta"
                              ? "border-red-500/60 text-red-600 dark:text-red-400"
                              : "border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                          }`}
                        >
                          <option value="Normal">Normal</option>
                          <option value="Alta">Alta 🔥</option>
                        </select>
                      </div>
                    </div>

                    {/* OBSERVACIONES */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Observaciones</label>
                      <input
                        type="text"
                        value={f.observaciones || ""}
                        onChange={(e) => handleUpdateCorrectedFailure(idx, "observaciones", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:border-emerald-500"
                        placeholder="Observaciones de la falla..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION: PENDING FAILURES IN THIS RECORD */}
          {fallasPendientes.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <h4 className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Fallas que quedaron Pendientes ({fallasPendientes.length})</span>
              </h4>

              <div className="space-y-2">
                {fallasPendientes.map((fp, idx) => (
                  <div
                    key={fp.id || idx}
                    className="p-3 bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800/80 rounded-xl flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{fp.componente}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">({fp.detalle})</span>
                        {fp.prioridad === "Alta" && (
                          <span className="text-[9px] bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.2 rounded font-bold uppercase">
                            Alta
                          </span>
                        )}
                      </div>
                      {fp.observaciones && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500 italic">{fp.observaciones}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Move to corrected
                          setFallasPendientes(prev => prev.filter(p => p.id !== fp.id));
                          setFallasCorregidas(prev => [...prev, fp]);
                        }}
                        className="text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded cursor-pointer uppercase"
                      >
                        Mover a Corregida
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2 text-xs font-extrabold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
