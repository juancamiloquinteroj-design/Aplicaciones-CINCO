import React, { useState } from "react";
import { X, CheckCircle2, AlertTriangle, User, Calendar, FileText } from "lucide-react";
import { PM, ActiveFailure, Intervencion } from "../types";

interface InterventionModalProps {
  pm: PM;
  onClose: () => void;
  onSaveIntervention: (pmId: string, updatedPM: PM) => void;
}

export default function InterventionModal({
  pm,
  onClose,
  onSaveIntervention
}: InterventionModalProps) {
  const [tecnico, setTecnico] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleFailure = (id: string) => {
    if (resolvedIds.includes(id)) {
      setResolvedIds(resolvedIds.filter(fId => fId !== id));
    } else {
      setResolvedIds([...resolvedIds, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (resolvedIds.length === 0) {
      setErrorMsg("Debe seleccionar al menos una falla que se haya corregido en esta intervención.");
      return;
    }

    if (!tecnico.trim()) {
      setErrorMsg("Ingrese el nombre del técnico o responsable.");
      return;
    }

    if (!descripcion.trim()) {
      setErrorMsg("Ingrese una descripción detallada de los trabajos realizados.");
      return;
    }

    // Split failures into corrected and remaining
    const fallasCorregidas: { id: string; componente: string; detalle: string }[] = [];
    const fallasPendientes: { id: string; componente: string; detalle: string }[] = [];
    const remainingActiveFailures: ActiveFailure[] = [];

    pm.activeFailures.forEach((f) => {
      if (resolvedIds.includes(f.id)) {
        fallasCorregidas.push({
          id: f.id,
          componente: f.componente,
          detalle: f.detalle
        });
      } else {
        fallasPendientes.push({
          id: f.id,
          componente: f.componente,
          detalle: f.detalle
        });
        remainingActiveFailures.push(f);
      }
    });

    // Create intervention log
    const nuevaIntervencion: Intervencion = {
      id: `int_${Date.now()}`,
      fecha,
      descripcion: descripcion.trim(),
      tecnico: tecnico.trim(),
      fallasCorregidas,
      fallasPendientes
    };

    // Determine new state
    let nuevoEstadoGral = pm.estadoGral;
    if (remainingActiveFailures.length === 0) {
      nuevoEstadoGral = "Ok";
    }

    const updatedPM: PM = {
      ...pm,
      estadoGral: nuevoEstadoGral,
      activeFailures: remainingActiveFailures,
      intervenciones: [...pm.intervenciones, nuevaIntervencion],
      updatedAt: new Date().toISOString()
    };

    onSaveIntervention(pm.id, updatedPM);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex justify-between items-center">
          <div>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Registrar Intervención
            </span>
            <h3 className="text-lg font-bold text-slate-800 font-sans tracking-tight">
              PM: <span className="font-mono">{pm.codigoPM}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">{pm.nombrePM}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-all focus:outline-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* CHECKLIST DE FALLAS ACTIVAS */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Marcar Fallas Solucionadas</span>
              <span className="text-[10px] text-blue-600 font-semibold normal-case">
                {resolvedIds.length} seleccionadas de {pm.activeFailures.length}
              </span>
            </label>
            
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-3 space-y-2">
              {pm.activeFailures.map((f) => {
                const isChecked = resolvedIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      isChecked
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-white border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleFailure(f.id)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold mb-0.5">
                        <span className="text-slate-800">
                          {f.componente === "Medidor" && f.detalle === "Instalación" ? "Instalación" : f.componente}
                        </span>
                        {f.detalle && f.detalle !== f.componente && !(f.componente === "Medidor" && f.detalle === "Instalación") && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                            isChecked ? "bg-emerald-200/50 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {f.detalle}
                          </span>
                        )}
                        {f.prioridad === "Alta" ? (
                          <span className="text-[10px] bg-red-100 text-red-800 border border-red-200 font-extrabold px-1.5 py-0.5 rounded">
                            Prioridad Alta 🔥
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded">
                            Prioridad Normal
                          </span>
                        )}
                      </div>
                      {f.observaciones && (
                        <p className={`italic mb-1 leading-normal ${isChecked ? "text-emerald-700/85" : "text-slate-500"}`}>
                          &ldquo;{f.observaciones}&rdquo;
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">
                        Reportado: {f.fechaReporte} | Programado: {f.fechaReparacion}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* CAMPOS DE INTERVENCION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-600" />
                Técnico / Responsable
              </label>
              <input
                type="text"
                value={tecnico}
                onChange={(e) => setTecnico(e.target.value)}
                placeholder="Nombre del operador..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 font-semibold bg-white placeholder-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                Fecha de Intervención
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 font-semibold bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              Trabajo Realizado / Notas de Cierre
            </label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa el trabajo realizado, materiales cambiados, repuestos..."
              className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 font-semibold bg-white placeholder-slate-500"
              required
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

        </form>

        {/* FOOTER */}
        <div className="bg-slate-50 border-t border-slate-100 p-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Guardar Intervención
          </button>
        </div>

      </div>
    </div>
  );
}
