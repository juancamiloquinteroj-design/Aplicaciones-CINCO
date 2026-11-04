import React, { useState } from "react";
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCheck, 
  History, 
  ChevronDown, 
  ChevronUp, 
  Wrench,
  AlertCircle,
  HelpCircle
} from "lucide-react";
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
  // Outcomes: "Seguimiento" (not fixed / pending follow-up) or "Corregido" (fixed)
  const [resultado, setResultado] = useState<"Seguimiento" | "Corregido">("Seguimiento");
  const [tecnico, setTecnico] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loQueQuedoPendiente, setLoQueQuedoPendiente] = useState(pm.loQueQuedoPendiente || "");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [proximaFecha, setProximaFecha] = useState("");
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const activeFailures = pm.activeFailures || [];
  const revisionCount = (pm.intervenciones?.length || 0) + 1;

  const handleToggleFailure = (id: string) => {
    if (resolvedIds.includes(id)) {
      setResolvedIds(resolvedIds.filter(fId => fId !== id));
    } else {
      setResolvedIds([...resolvedIds, id]);
    }
  };

  const handleSelectAllFailures = () => {
    if (resolvedIds.length === activeFailures.length) {
      setResolvedIds([]);
    } else {
      setResolvedIds(activeFailures.map(f => f.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tecnico.trim()) {
      setErrorMsg("Ingrese el nombre del técnico o responsable de la revisión.");
      return;
    }

    if (!descripcion.trim()) {
      setErrorMsg("Ingrese una descripción detallada o informe de los trabajos realizados.");
      return;
    }

    if (resultado === "Seguimiento" && !loQueQuedoPendiente.trim()) {
      setErrorMsg("Para registrar el punto en Seguimiento, debe indicar qué quedó pendiente o el motivo por el cual no se pudo solucionar.");
      return;
    }

    if (resultado === "Corregido" && activeFailures.length > 0 && resolvedIds.length === 0) {
      setErrorMsg("Si el resultado fue 'Corregido', debe marcar al menos una falla como solucionada, o seleccione 'Quedó en Seguimiento'.");
      return;
    }

    // Split failures into corrected and remaining
    const fallasCorregidas: Intervencion["fallasCorregidas"] = [];
    const fallasPendientes: Intervencion["fallasPendientes"] = [];
    const remainingActiveFailures: ActiveFailure[] = [];

    // Capture pristine snapshot of PM state before this intervention so it can be restored "como si no hubiera pasado nada"
    const snapshotPrevio = {
      estadoGral: pm.estadoGral,
      revisado: pm.revisado,
      prioridad: pm.prioridad,
      loQueQuedoPendiente: pm.loQueQuedoPendiente,
      activeFailures: JSON.parse(JSON.stringify(activeFailures))
    };

    activeFailures.forEach((f) => {
      const isResolved = resolvedIds.includes(f.id);

      const fallaSnapshot = {
        id: f.id,
        componente: f.componente,
        detalle: f.detalle,
        fechaReporte: f.fechaReporte,
        observaciones: f.observaciones || "",
        fechaReparacion: f.fechaReparacion,
        prioridad: f.prioridad,
        vecesReprogramada: f.vecesReprogramada
      };

      if (isResolved) {
        fallasCorregidas.push(fallaSnapshot);
      } else {
        fallasPendientes.push(fallaSnapshot);
        // If remaining active, optionally update programmed date if a new follow-up date was specified
        remainingActiveFailures.push({
          ...f,
          observaciones: f.observaciones || "",
          fechaReparacion: proximaFecha.trim() ? proximaFecha.trim() : f.fechaReparacion
        });
      }
    });

    // If no active failures existed originally (e.g. only state), create a fallback active failure if Seguimiento
    if (resultado === "Seguimiento" && remainingActiveFailures.length === 0) {
      remainingActiveFailures.push({
        id: `fail_seg_${Date.now()}`,
        componente: "Para Revisión",
        detalle: "Seguimiento en campo",
        fechaReporte: fecha,
        observaciones: loQueQuedoPendiente.trim(),
        fechaReparacion: proximaFecha.trim() || "Sin definir",
        vecesReprogramada: 0,
        prioridad: pm.prioridad || "Normal"
      });
    }

    // Create new intervention record with full snapshot
    const nuevaIntervencion: Intervencion = {
      id: `int_${Date.now()}`,
      fecha,
      descripcion: descripcion.trim(),
      tecnico: tecnico.trim(),
      resultado,
      loQueQuedoPendiente: resultado === "Seguimiento" ? loQueQuedoPendiente.trim() : "",
      proximaRevision: proximaFecha.trim() || undefined,
      fallasCorregidas,
      fallasPendientes,
      snapshotPrevio
    };

    // Determine final PM state
    let nuevoEstadoGral = pm.estadoGral;
    let nuevoLoQueQuedoPendiente = "";

    if (resultado === "Corregido") {
      if (remainingActiveFailures.length === 0) {
        nuevoEstadoGral = "Ok";
        nuevoLoQueQuedoPendiente = "";
      } else {
        // Some were corrected, but others remained -> falls into Seguimiento with the pending ones
        nuevoEstadoGral = "Seguimiento";
        nuevoLoQueQuedoPendiente = loQueQuedoPendiente.trim() || "Fallas residuales pendientes de atención.";
      }
    } else {
      // User explicitly set to "Seguimiento"
      nuevoEstadoGral = "Seguimiento";
      nuevoLoQueQuedoPendiente = loQueQuedoPendiente.trim();
    }

    const updatedPM: PM = {
      ...pm,
      estadoGral: nuevoEstadoGral,
      loQueQuedoPendiente: nuevoLoQueQuedoPendiente,
      ultimoReporteTecnico: {
        fecha,
        tecnico: tecnico.trim(),
        descripcion: descripcion.trim(),
        loQueQuedoPendiente: nuevoLoQueQuedoPendiente
      },
      activeFailures: remainingActiveFailures,
      intervenciones: [...(pm.intervenciones || []), nuevaIntervencion],
      updatedAt: new Date().toISOString()
    };

    onSaveIntervention(pm.id, updatedPM);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-zinc-950/80 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="bg-slate-50 dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* HEADER */}
        <div className="bg-white dark:bg-zinc-950/90 border-b border-slate-200 dark:border-zinc-800 p-5 flex justify-between items-start sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Registrar Intervención / Revisión #{revisionCount}
              </span>
              {pm.estadoGral === "Seguimiento" && (
                <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Actualmente en Seguimiento
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 font-sans tracking-tight">
              PM: <span className="font-mono text-amber-600 dark:text-amber-400">{pm.codigoPM}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{pm.nombrePM}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 p-2 rounded-lg transition-all focus:outline-none cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* SECCIÓN 1: ESTADO INICIAL */}
          <div className="bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    1. Estado Inicial
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Condición técnica y novedades con las que se inicia esta revisión
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                pm.prioridad === "Alta"
                  ? "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700"
              }`}>
                Prioridad: {pm.prioridad || "Normal"}
              </span>
            </div>

            {/* RESUMEN DE ESTADO Y ANTECEDENTES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/80 rounded-xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-500 block mb-0.5">Estado Previo</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{pm.estadoGral}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/80 rounded-xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-500 block mb-0.5">Fallas Reportadas</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{activeFailures.length} activa(s)</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/80 rounded-xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-500 block mb-0.5">Revisiones Previas</span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{pm.intervenciones?.length || 0}</span>
              </div>
            </div>

            {/* ANTECEDENTE PENDIENTE DE REVISIÓN ANTERIOR (SI EXISTE) */}
            {pm.loQueQuedoPendiente && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Quedó pendiente en la revisión anterior:
                </span>
                <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed italic bg-white dark:bg-zinc-950/70 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800/80">
                  &ldquo;{pm.loQueQuedoPendiente}&rdquo;
                </p>
              </div>
            )}

            {/* LISTA DE FALLAS ACTIVAS INICIALES */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                Fallas activas para inspeccionar:
              </span>
              {activeFailures.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-zinc-500 italic bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                  No hay fallas catalogadas activas. Se registrará la revisión general de rutina o seguimiento.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeFailures.map((f, idx) => (
                    <div
                      key={f.id || idx}
                      className="p-3 bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 font-mono">
                            {f.componente === "Medidor" && f.detalle === "Instalación" ? "Instalación" : f.componente}
                          </span>
                          {f.detalle && f.detalle !== f.componente && !(f.componente === "Medidor" && f.detalle === "Instalación") && (
                            <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-zinc-700">
                              {f.detalle}
                            </span>
                          )}
                          {f.prioridad === "Alta" && (
                            <span className="text-[9px] bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-extrabold uppercase">
                              Alta
                            </span>
                          )}
                        </div>
                        {f.fechaReporte && (
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500 dark:text-zinc-500" />
                            Reportado: {f.fechaReporte}
                          </span>
                        )}
                      </div>

                      {f.observaciones && !f.observaciones.startsWith("Devuelta a pendientes desde intervención") && (
                        <p className="text-[11px] text-slate-700 dark:text-zinc-300 italic bg-white dark:bg-zinc-950/60 p-2 rounded-lg border border-slate-200 dark:border-zinc-800/80">
                          &ldquo;{f.observaciones}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* HISTORIAL PREVIO DESPLEGABLE */}
            {pm.intervenciones && pm.intervenciones.length > 0 && (
              <div className="border border-slate-200 dark:border-zinc-800/90 rounded-xl overflow-hidden bg-slate-50 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Ver revisiones anteriores ({pm.intervenciones.length})</span>
                  </div>
                  {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showHistory && (
                  <div className="p-3 border-t border-slate-200 dark:border-zinc-800 space-y-2 max-h-44 overflow-y-auto">
                    {pm.intervenciones.map((prevInt, idx) => (
                      <div key={prevInt.id || idx} className="p-2.5 bg-white dark:bg-zinc-950/80 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap font-mono text-[10px]">
                          <span className="font-bold text-amber-600 dark:text-amber-400">Revisión {idx + 1} - {prevInt.fecha}</span>
                          <span className="text-slate-500 dark:text-zinc-400">Por: {prevInt.tecnico}</span>
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                            prevInt.resultado === "Seguimiento"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {prevInt.resultado}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-zinc-300 italic text-[11px]">&ldquo;{prevInt.descripcion}&rdquo;</p>
                        {prevInt.loQueQuedoPendiente && (
                          <p className="text-amber-700 dark:text-amber-300/90 text-[10px] font-medium bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                            <span className="font-bold">Quedó pendiente:</span> {prevInt.loQueQuedoPendiente}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: VERIFICACIÓN / CORRECCIÓN */}
          <div className="bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800/80 pb-3">
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  2. Verificación / Corrección
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Trabajos realizados en terreno, pruebas diagnósticas y resolución de fallas
                </p>
              </div>
            </div>

            {/* DATOS DE LA VISITA: TÉCNICO Y FECHA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  Técnico / Responsable de la Revisión <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={tecnico}
                  onChange={(e) => setTecnico(e.target.value)}
                  placeholder="Nombre del técnico o responsable..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-zinc-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  Fecha de la Revisión <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-zinc-100 font-mono font-medium"
                  required
                />
              </div>
            </div>

            {/* DESCRIPCIÓN DE TRABAJOS Y VERIFICACIONES */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                Descripción de la Verificación y Trabajos Realizados <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalle el trabajo realizado en terreno, mediciones efectuadas, pruebas diagnósticas, materiales probados o reemplazados..."
                className="w-full p-3 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-zinc-500 font-medium leading-relaxed"
                required
              />
            </div>

            {/* CHECKLIST DE FALLAS VERIFICADAS Y SOLUCIONADAS */}
            {activeFailures.length > 0 && (
              <div className="space-y-2.5 bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                      Fallas Solucionadas en esta Revisión
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      Marque las fallas que fueron corregidas y resueltas con éxito
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllFailures}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {resolvedIds.length === activeFailures.length ? "Desmarcar todas" : "Marcar todas como solucionadas"}
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {activeFailures.map((f) => {
                    const isChecked = resolvedIds.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                            : "bg-white dark:bg-zinc-950/70 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFailure(f.id)}
                          className="mt-0.5 rounded text-emerald-500 focus:ring-0 border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 cursor-pointer"
                        />
                        <div className="flex-1 text-xs">
                          <div className="flex items-center gap-1.5 font-bold mb-0.5 flex-wrap">
                            <span className="text-slate-900 dark:text-zinc-100 font-mono">
                              {f.componente === "Medidor" && f.detalle === "Instalación" ? "Instalación" : f.componente}
                            </span>
                            {f.detalle && f.detalle !== f.componente && !(f.componente === "Medidor" && f.detalle === "Instalación") && (
                              <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-zinc-700">
                                {f.detalle}
                              </span>
                            )}
                            {isChecked && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold ml-auto">
                                Solucionada ✓
                              </span>
                            )}
                          </div>
                          {f.observaciones && (
                            <p className={`italic mb-1 leading-normal text-[11px] ${isChecked ? "text-emerald-300/80" : "text-slate-500 dark:text-zinc-400"}`}>
                              &ldquo;{f.observaciones}&rdquo;
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 3: ESTADO FINAL */}
          <div className="bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800/80 pb-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  3. Estado Final
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Resultado de la revisión y definición del nuevo estado del punto de medida
                </p>
              </div>
            </div>

            {/* SELECCIÓN DE RESULTADO */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                Resultado de la Revisión <span className="text-red-600 dark:text-red-400">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* OPCION 1: SEGUIMIENTO */}
                <div
                  onClick={() => setResultado("Seguimiento")}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    resultado === "Seguimiento"
                      ? "bg-amber-500/15 border-amber-500 text-amber-200 ring-2 ring-amber-500/30"
                      : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        resultado === "Seguimiento" ? "bg-amber-500/30 text-amber-700 dark:text-amber-300" : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Quedó en Seguimiento
                        </h4>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400/80 font-bold block">
                          (Requiere nueva revisión / tareas pendientes)
                        </span>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="resultadoIntervencion"
                      checked={resultado === "Seguimiento"}
                      onChange={() => setResultado("Seguimiento")}
                      className="text-amber-500 focus:ring-0 cursor-pointer mt-1"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5 leading-relaxed">
                    La falla no se pudo resolver por completo o requiere repuestos, permisos o pruebas adicionales. El PM pasará/continuará en el Directorio de Pendientes con estado &ldquo;En Seguimiento&rdquo;.
                  </p>
                </div>

                {/* OPCION 2: CORREGIDO */}
                <div
                  onClick={() => setResultado("Corregido")}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    resultado === "Corregido"
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30"
                      : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        resultado === "Corregido" ? "bg-emerald-500/30 text-emerald-300" : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                          Quedó Corregido
                        </h4>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-bold block">
                          (Fallas resueltas / Operativo)
                        </span>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="resultadoIntervencion"
                      checked={resultado === "Corregido"}
                      onChange={() => setResultado("Corregido")}
                      className="text-emerald-500 focus:ring-0 cursor-pointer mt-1"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2.5 leading-relaxed">
                    Las fallas reportadas quedaron totalmente solucionadas. Si no quedan fallas pendientes, el punto pasa a estado &ldquo;Ok&rdquo; y se archiva en el historial.
                  </p>
                </div>
              </div>
            </div>

            {/* SI QUEDÓ EN SEGUIMIENTO: DETALLE DE LO PENDIENTE */}
            {resultado === "Seguimiento" && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ¿Qué quedó pendiente? / Motivo del Seguimiento <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400/80 font-bold uppercase">Obligatorio</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-zinc-300 leading-normal">
                  Especifique qué impidió corregir totalmente la falla y qué se requiere para la siguiente intervención (repuestos, corte programado, etc.):
                </p>
                <textarea
                  rows={2}
                  value={loQueQuedoPendiente}
                  onChange={(e) => setLoQueQuedoPendiente(e.target.value)}
                  placeholder="Ej: Se realizaron pruebas diagnósticas, pendiente cambio de módem y coordinación de corte con cliente..."
                  className="w-full p-3 text-xs bg-white dark:bg-zinc-950 border border-amber-500/40 rounded-lg focus:outline-none focus:border-amber-400 text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-zinc-500 font-medium"
                  required
                />

                {/* PRÓXIMA FECHA ESTIMADA DE REVISIÓN */}
                <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Próxima fecha programada de revisión (opcional):
                  </label>
                  <input
                    type="date"
                    value={proximaFecha}
                    onChange={(e) => setProximaFecha(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* RESUMEN DEL DESTINO FINAL DEL PM */}
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              resultado === "Corregido"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300"
            }`}>
              {resultado === "Corregido" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    El PM <strong>{pm.codigoPM}</strong> se marcará como intervenido y corregido. Si todas las fallas se resolvieron, pasará a estado <strong>&ldquo;Ok&rdquo;</strong>.
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    El PM <strong>{pm.codigoPM}</strong> pasará/permanecerá en el <strong>Directorio de Pendientes</strong> con estado <strong>&ldquo;En Seguimiento&rdquo;</strong> con las tareas y fallas pendientes registradas.
                  </span>
                </>
              )}
            </div>

          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

        </form>

        {/* FOOTER */}
        <div className="bg-white dark:bg-zinc-950/90 border-t border-slate-200 dark:border-zinc-800 p-4 flex justify-between items-center gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-lg cursor-pointer transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className={`px-5 py-2 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg transition-all ${
              resultado === "Seguimiento"
                ? "bg-amber-600 hover:bg-amber-500 text-zinc-950 font-black"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {resultado === "Seguimiento" ? (
              <>
                <Clock className="w-4 h-4 text-zinc-950" />
                Guardar como &ldquo;En Seguimiento&rdquo;
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Guardar como &ldquo;Corregido&rdquo;
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
