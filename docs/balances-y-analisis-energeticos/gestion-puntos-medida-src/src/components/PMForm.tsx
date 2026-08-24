import React, { useState, useEffect } from "react";
import { 
  Wrench, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  HelpCircle, 
  Search, 
  Eye, 
  MapPin, 
  Activity,
  Pencil,
  X
} from "lucide-react";
import { Estructura, PMBase, PM, ActiveFailure } from "../types";

interface PMFormProps {
  estructurasDict: Record<string, Estructura>;
  pmsDict: Record<string, PMBase>;
  existingPMs: PM[];
  onSavePM: (pm: PM) => void;
  initialPMCode?: string;
  onClearEdit?: () => void;
}

const diccFallas = {
  "CTs": ["Saturados", "Quemados", "Invertidos"],
  "PTs": ["Saturados", "Quemados", "Invertidos", "Fusibles quemados"],
  "Medidor": ["Quemado", "Mal parametrizado", "Calibrado", "Conexión"],
  "Cableado": ["Quemado"],
  "Telemedida": ["Sin señal", "Modem (quemado)", "Modem (mal parametrizado)", "Pendiente diagnóstico"],
  "Para Revisión": ["Monitoreo especial", "Pendiente diagnóstico"]
};

type FailureComponent = keyof typeof diccFallas;

export default function PMForm({
  estructurasDict,
  pmsDict,
  existingPMs,
  onSavePM,
  initialPMCode,
  onClearEdit
}: PMFormProps) {
  // Main form states
  const [codigoPM, setCodigoPM] = useState("");
  const [estadoGral, setEstadoGral] = useState<"En falla" | "Instalación" | "Ok">("En falla");
  const [revisado, setRevisado] = useState(false);
  
  // States for matching from uploaded Base Database
  const [nombrePM, setNombrePM] = useState("Sin Nombre");
  const [estructurasAfectadas, setEstructurasAfectadas] = useState<string[]>([]);
  const [esPMRonocido, setEsPMReconocido] = useState(false);

  // Failure staging (For adding multiple simultaneous failures)
  const [tempFallas, setTempFallas] = useState<ActiveFailure[]>([]);
  const [editingFallaId, setEditingFallaId] = useState<string | null>(null);
  const [selComponente, setSelComponente] = useState<FailureComponent | "">("");
  const [selDetalle, setSelDetalle] = useState("");
  const [fechaReporte, setFechaReporte] = useState(new Date().toISOString().split("T")[0]);
  const [observacionesFalla, setObservacionesFalla] = useState("");
  const [fechaReparacion, setFechaReparacion] = useState("");
  const [chkSinDefinir, setChkSinDefinir] = useState(false);
  const [prioridadFalla, setPrioridadFalla] = useState<"Normal" | "Alta">("Normal");

  // States for generic action (Instalación)
  const [accionObservaciones, setAccionObservaciones] = useState("");
  const [accionFecha, setAccionFecha] = useState("");
  const [accionSinDefinir, setAccionSinDefinir] = useState(false);
  const [accionPrioridad, setAccionPrioridad] = useState<"Normal" | "Alta">("Normal");

  // Message banners
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Load edit code if provided
  useEffect(() => {
    if (initialPMCode) {
      setCodigoPM(initialPMCode);
    }
  }, [initialPMCode]);

  // Detect and preload if selected PM already has active failures in DB
  useEffect(() => {
    const pmClean = codigoPM.trim();
    if (!pmClean) {
      setNombrePM("Sin Nombre");
      setEstructurasAfectadas([]);
      setEsPMReconocido(false);
      return;
    }

    // Check if PM code is in loaded networks dictionary
    const networkPM = pmsDict[pmClean];
    if (networkPM) {
      setNombrePM(networkPM.nombre);
      setEstructurasAfectadas(networkPM.estructuras);
      setEsPMReconocido(true);
    } else {
      setNombrePM("Sin Nombre");
      setEstructurasAfectadas([]);
      setEsPMReconocido(false);
    }

    // Auto-detect if this PM is already logged in active PMs
    const activePM = existingPMs.find(p => p.codigoPM === pmClean);
    if (activePM) {
      setRevisado(!!activePM.revisado || activePM.estadoGral === "Revisado");
      if (activePM.estadoGral === "Instalación" || activePM.activeFailures?.[0]?.componente === "Instalación") {
        setEstadoGral("Instalación");
        const act = activePM.activeFailures?.[0];
        if (act) {
          setAccionFecha(act.fechaReparacion === "Sin definir" ? "" : act.fechaReparacion);
          setAccionSinDefinir(act.fechaReparacion === "Sin definir");
          setAccionObservaciones(act.observaciones || "");
          setAccionPrioridad(act.prioridad || "Normal");
        }
      } else if (activePM.estadoGral === "En falla" || (activePM as any).estadoGral === "Para Revisión" || (activePM.activeFailures && activePM.activeFailures.length > 0)) {
        setEstadoGral("En falla");
        setTempFallas(activePM.activeFailures || []);
      } else {
        setEstadoGral("Ok");
      }
    } else {
      // Reset only if not matching initial code logic
      if (!initialPMCode || pmClean !== initialPMCode) {
        setEstadoGral("En falla");
        setRevisado(false);
        setTempFallas([]);
        setAccionFecha("");
        setAccionSinDefinir(false);
        setAccionObservaciones("");
        setAccionPrioridad("Normal");
      }
    }
  }, [codigoPM, pmsDict, existingPMs, initialPMCode]);

  // Adjust details dropdown when component changes
  const handleComponentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as FailureComponent | "";
    setSelComponente(val);
    setSelDetalle("");
  };

  // Staging or updating a failure
  const handleAddFallaToStaging = () => {
    setErrorBanner(null);

    if (!selComponente) {
      setErrorBanner("Seleccione un componente afectado para la falla.");
      return;
    }
    if (!selDetalle) {
      setErrorBanner("Seleccione el detalle específico de la falla.");
      return;
    }
    if (!chkSinDefinir && !fechaReparacion) {
      setErrorBanner("Defina una fecha programada de reparación o marque 'Sin definir'.");
      return;
    }

    if (editingFallaId) {
      // Update existing staged failure
      setTempFallas(tempFallas.map((f) => {
        if (f.id === editingFallaId) {
          return {
            ...f,
            componente: selComponente,
            detalle: selDetalle,
            fechaReporte: fechaReporte || new Date().toISOString().split("T")[0],
            observaciones: observacionesFalla.trim(),
            fechaReparacion: chkSinDefinir ? "Sin definir" : fechaReparacion,
            prioridad: prioridadFalla
          };
        }
        return f;
      }));
      setEditingFallaId(null);
    } else {
      // Add new staged failure
      const nuevaFallaStaged: ActiveFailure = {
        id: `fail_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        componente: selComponente,
        detalle: selDetalle,
        fechaReporte: fechaReporte || new Date().toISOString().split("T")[0],
        observaciones: observacionesFalla.trim(),
        fechaReparacion: chkSinDefinir ? "Sin definir" : fechaReparacion,
        vecesReprogramada: 0,
        prioridad: prioridadFalla
      };
      setTempFallas([...tempFallas, nuevaFallaStaged]);
    }

    // Reset staging fields
    setSelComponente("");
    setSelDetalle("");
    setObservacionesFalla("");
    setFechaReparacion("");
    setChkSinDefinir(false);
    setPrioridadFalla("Normal");
  };

  // Load a staged failure into form for editing
  const handleEditStagedFalla = (f: ActiveFailure) => {
    setEditingFallaId(f.id);
    setSelComponente(f.componente as FailureComponent);
    setSelDetalle(f.detalle);
    setFechaReporte(f.fechaReporte || new Date().toISOString().split("T")[0]);
    setObservacionesFalla(f.observaciones || "");
    setPrioridadFalla(f.prioridad || "Normal");
    if (f.fechaReparacion === "Sin definir") {
      setChkSinDefinir(true);
      setFechaReparacion("");
    } else {
      setChkSinDefinir(false);
      setFechaReparacion(f.fechaReparacion || "");
    }
  };

  // Cancel editing staged failure
  const handleCancelEditFalla = () => {
    setEditingFallaId(null);
    setSelComponente("");
    setSelDetalle("");
    setObservacionesFalla("");
    setFechaReparacion("");
    setChkSinDefinir(false);
    setPrioridadFalla("Normal");
  };

  // Remove a failure from staging
  const handleRemoveStagedFalla = (id: string) => {
    if (editingFallaId === id) {
      handleCancelEditFalla();
    }
    setTempFallas(tempFallas.filter((f) => f.id !== id));
  };

  // Reset complete form
  const handleResetForm = () => {
    setCodigoPM("");
    setEstadoGral("En falla");
    setRevisado(false);
    setTempFallas([]);
    setEditingFallaId(null);
    setSelComponente("");
    setSelDetalle("");
    setObservacionesFalla("");
    setFechaReparacion("");
    setChkSinDefinir(false);
    setAccionObservaciones("");
    setAccionFecha("");
    setAccionSinDefinir(false);
    setErrorBanner(null);
    onClearEdit?.();
  };

  // Save/Submit the form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    const pmCodeClean = codigoPM.trim();
    if (!pmCodeClean) {
      setErrorBanner("El Código de Punto de Medida (PM) es obligatorio.");
      return;
    }

    // Build the PM Object
    const existing = existingPMs.find(p => p.codigoPM === pmCodeClean);
    const pmId = existing?.id || `pm_${Date.now()}`;
    const pastIntervenciones = existing?.intervenciones || [];

    let activeFailuresToSave: ActiveFailure[] = [];

    if (estadoGral === "En falla") {
      if (tempFallas.length === 0) {
        setErrorBanner("Debe registrar al menos una falla en la lista para cambiar el estado a 'En falla'.");
        return;
      }
      activeFailuresToSave = [...tempFallas];
    } else if (estadoGral === "Instalación") {
      if (!accionSinDefinir && !accionFecha) {
        setErrorBanner("Defina una fecha programada para la Instalación o marque 'Sin definir'.");
        return;
      }

      activeFailuresToSave = [
        {
          id: existing?.activeFailures?.[0]?.id || `action_${Date.now()}`,
          componente: "Instalación", 
          detalle: "Instalación",
          fechaReporte: existing?.activeFailures?.[0]?.fechaReporte || new Date().toISOString().split("T")[0],
          observaciones: accionObservaciones.trim(),
          fechaReparacion: accionSinDefinir ? "Sin definir" : accionFecha,
          vecesReprogramada: existing?.activeFailures?.[0]?.vecesReprogramada || 0,
          prioridad: accionPrioridad
        }
      ];
    } else {
      activeFailuresToSave = [];
    }

    const topPrioridad: "Normal" | "Alta" = activeFailuresToSave.some(f => f.prioridad === "Alta") ? "Alta" : "Normal";

    const finalPM: PM = {
      id: pmId,
      codigoPM: pmCodeClean,
      nombrePM: nombrePM || "Sin Nombre",
      estadoGral,
      revisado,
      prioridad: topPrioridad,
      estructuras: estructurasAfectadas,
      activeFailures: activeFailuresToSave,
      intervenciones: pastIntervenciones,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSavePM(finalPM);
    setSuccessBanner(`¡Punto de Medida ${pmCodeClean} guardado con éxito!`);
    
    // Clear state
    setCodigoPM("");
    setEstadoGral("En falla");
    setRevisado(false);
    setTempFallas([]);
    setSelComponente("");
    setSelDetalle("");
    setObservacionesFalla("");
    setFechaReparacion("");
    setChkSinDefinir(false);
    setPrioridadFalla("Normal");
    setAccionObservaciones("");
    setAccionFecha("");
    setAccionSinDefinir(false);
    setAccionPrioridad("Normal");
    setErrorBanner(null);
    onClearEdit?.();

    setTimeout(() => {
      setSuccessBanner(null);
    }, 4000);
  };

  return (
    <div className="bg-slate-50 dark:bg-zinc-900/50 backdrop-blur-md rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6">
      <h3 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-amber-500" />
        Registrar Acción o Actualizar Punto de Medida (PM)
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN BÁSICA */}
          <div className="space-y-4">
            
            <div className="form-group relative">
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                Código de Punto de Medida (PM)
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="listaPMsForm"
                  value={codigoPM}
                  onChange={(e) => setCodigoPM(e.target.value.toUpperCase())}
                  placeholder="Escriba el código del PM..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-amber-500 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 font-mono font-bold"
                  required
                />
                <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500 dark:text-zinc-500" />
              </div>
              <datalist id="listaPMsForm">
                {Object.keys(pmsDict).map(pm => (
                  <option key={pm} value={pm} />
                ))}
              </datalist>
            </div>

            <div className="form-group space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Estado Operativo Principal
              </label>
              <select
                value={estadoGral}
                onChange={(e) => {
                  const val = e.target.value as "En falla" | "Instalación" | "Ok";
                  setEstadoGral(val);
                }}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-semibold"
              >
                <option value="En falla" className="text-zinc-900 bg-white font-medium">En falla</option>
                <option value="Instalación" className="text-zinc-900 bg-white font-medium">Instalación</option>
              </select>

              {/* SEGUNDO ESTADO SIMULTÁNEO: REVISADO */}
              <div className="flex items-center gap-2.5 p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  id="chkRevisadoForm"
                  checked={revisado}
                  onChange={(e) => setRevisado(e.target.checked)}
                  className="rounded border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-purple-500 focus:ring-0 cursor-pointer w-4 h-4"
                />
                <label htmlFor="chkRevisadoForm" className="text-xs font-bold text-purple-700 dark:text-purple-300 cursor-pointer select-none">
                  Estado Secundario: Marcar como &ldquo;Revisado&rdquo;
                </label>
              </div>
            </div>

            {/* SECCIÓN DINÁMICA A: MULTI-FALLAS SIMULTÁNEAS */}
            {estadoGral === "En falla" && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-4">
                <h4 className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800/80 pb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Agregar Nueva Falla al Punto de Medida
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Componente</label>
                    <select
                      value={selComponente}
                      onChange={handleComponentChange}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-semibold"
                    >
                      <option value="" className="text-zinc-900 bg-white font-medium">Seleccione...</option>
                      <option value="CTs" className="text-zinc-900 bg-white font-medium">CTs</option>
                      <option value="PTs" className="text-zinc-900 bg-white font-medium">PTs</option>
                      <option value="Medidor" className="text-zinc-900 bg-white font-medium">Medidor</option>
                      <option value="Cableado" className="text-zinc-900 bg-white font-medium">Cableado</option>
                      <option value="Telemedida" className="text-zinc-900 bg-white font-medium">Telemedida</option>
                      <option value="Para Revisión" className="text-zinc-900 bg-white font-medium">Para Revisión</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Detalle del Daño</label>
                    <select
                      value={selDetalle}
                      onChange={(e) => setSelDetalle(e.target.value)}
                      disabled={!selComponente}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 disabled:bg-slate-50 dark:disabled:bg-zinc-900/40 disabled:text-slate-600 dark:disabled:text-zinc-600 disabled:cursor-not-allowed font-semibold"
                    >
                      <option value="" className="text-zinc-900 bg-white font-medium">Seleccione...</option>
                      {selComponente && diccFallas[selComponente].map(f => (
                        <option key={f} value={f} className="text-zinc-900 bg-white font-medium">{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Fecha Reporte</label>
                    <input
                      type="date"
                      value={fechaReporte}
                      onChange={(e) => setFechaReporte(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Programación Reparación</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={fechaReparacion}
                        onChange={(e) => setFechaReparacion(e.target.value)}
                        disabled={chkSinDefinir}
                        className="flex-1 px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 disabled:bg-slate-50 dark:disabled:bg-zinc-900/40 disabled:text-slate-600 dark:disabled:text-zinc-600 disabled:cursor-not-allowed font-mono"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 select-none whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chkSinDefinir}
                          onChange={(e) => setChkSinDefinir(e.target.checked)}
                          className="rounded border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-amber-500 focus:ring-0"
                        />
                        Sin definir
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Prioridad de Atenci&oacute;n</label>
                    <select
                      value={prioridadFalla}
                      onChange={(e) => setPrioridadFalla(e.target.value as "Normal" | "Alta")}
                      className={`w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border rounded-lg focus:outline-none font-bold ${
                        prioridadFalla === "Alta"
                          ? "border-red-500/80 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/20"
                          : "border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100"
                      }`}
                    >
                      <option value="Normal" className="text-zinc-900 bg-white font-medium">Prioridad Normal</option>
                      <option value="Alta" className="text-zinc-900 bg-white font-bold">Prioridad Alta 🔥</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Observaciones de la Falla</label>
                  <textarea
                    rows={2}
                    value={observacionesFalla}
                    onChange={(e) => setObservacionesFalla(e.target.value)}
                    placeholder="Descripción del daño particular..."
                    className="w-full p-2.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddFallaToStaging}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    {editingFallaId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingFallaId ? "Actualizar Falla en la Lista" : "Agregar Falla a la Lista"}
                  </button>
                  {editingFallaId && (
                    <button
                      type="button"
                      onClick={handleCancelEditFalla}
                      className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Cancelar edición"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN DINÁMICA B: INSTALACIÓN */}
            {estadoGral === "Instalación" && (
              <div className="p-4 rounded-xl space-y-4 border bg-blue-500/5 border-blue-500/10">
                <h4 className="text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800/80 pb-2 text-blue-600 dark:text-blue-400">
                  Programación de Instalación
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Fecha Programada</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={accionFecha}
                        onChange={(e) => setAccionFecha(e.target.value)}
                        disabled={accionSinDefinir}
                        className="flex-1 px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 font-mono disabled:bg-slate-50 dark:disabled:bg-zinc-900/40 disabled:text-slate-600 dark:disabled:text-zinc-600"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 select-none whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={accionSinDefinir}
                          onChange={(e) => setAccionSinDefinir(e.target.checked)}
                          className="rounded border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-500 focus:ring-0"
                        />
                        Sin definir
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Prioridad de Atención</label>
                    <select
                      value={accionPrioridad}
                      onChange={(e) => setAccionPrioridad(e.target.value as "Normal" | "Alta")}
                      className={`w-full px-2.5 py-2 text-xs bg-white dark:bg-zinc-950 border rounded-lg focus:outline-none font-bold ${
                        accionPrioridad === "Alta"
                          ? "border-red-500/80 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/20"
                          : "border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100"
                      }`}
                    >
                      <option value="Normal" className="text-zinc-900 bg-white font-medium">Prioridad Normal</option>
                      <option value="Alta" className="text-zinc-900 bg-white font-bold">Prioridad Alta 🔥</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase">Detalles / Instrucciones</label>
                  <textarea
                    rows={2}
                    value={accionObservaciones}
                    onChange={(e) => setAccionObservaciones(e.target.value)}
                    placeholder="Instrucciones específicas, técnico asignado, etc."
                    className="w-full p-2.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: IMPACTO DE RED Y LISTA DE FALLAS STAGED */}
          <div className="space-y-4">
            
            {/* CUADRO DE IMPACTO DE RED */}
            <div className="p-4 bg-white dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl">
              <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-500" />
                Impacto Operativo en la Red
              </h4>

              {codigoPM ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                    <div>
                      <p className="font-mono text-sm font-bold text-slate-800 dark:text-zinc-200">{codigoPM}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">{nombrePM}</p>
                    </div>
                    {esPMRonocido ? (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        Base de Red
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        Manual (Sin Base)
                      </span>
                    )}
                  </div>

                  {estructurasAfectadas.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-2">
                        Afecta a <span className="font-extrabold text-amber-600 dark:text-amber-400">{estructurasAfectadas.length}</span> estructura(s):
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 rounded p-2">
                        {estructurasAfectadas.map(est => {
                          const detail = estructurasDict[est];
                          return (
                            <div key={est} className="flex justify-between items-center text-[10px] font-mono p-1 bg-slate-50 dark:bg-zinc-900/60 rounded border border-slate-200 dark:border-zinc-800/30">
                              <span className="font-bold text-slate-700 dark:text-zinc-300">{est}</span>
                              <span className="text-slate-500 dark:text-zinc-500">
                                {detail ? `${detail.tipo} | ${detail.zona} | ${detail.nivel}` : "No mapeada"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-zinc-500 italic">No hay estructuras asignadas a este punto de medida en la base de datos.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-zinc-500 italic py-2 text-center">
                  Cargue los archivos de red en configuración e ingrese un PM para analizar su impacto.
                </p>
              )}
            </div>

            {/* LISTA DE FALLAS SIMULTÁNEAS QUE SE REGISTRARÁN */}
            {estadoGral === "En falla" && (
              <div className="p-4 bg-white dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl">
                <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Fallas Simultáneas por Registrar ({tempFallas.length})</span>
                  {tempFallas.length > 0 && (
                    <span className="text-[10px] bg-amber-500 text-zinc-950 font-bold px-2 py-0.5 rounded animate-pulse">
                      Activas
                    </span>
                  )}
                </h4>

                {tempFallas.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950/20">
                    <Wrench className="w-6 h-6 text-zinc-700 mx-auto mb-2 animate-bounce" />
                    <p className="text-xs text-slate-500 dark:text-zinc-500 italic">Lista vacía. Use el módulo superior para agregar daños.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {tempFallas.map((f) => (
                      <div key={f.id} className="bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm relative flex justify-between items-start">
                        <div className="space-y-1 pr-6">
                          <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 flex-wrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>{f.componente} - <span className="text-amber-600 dark:text-amber-400">{f.detalle}</span></span>
                            {f.prioridad === "Alta" ? (
                              <span className="text-[10px] bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 px-1.5 py-0.25 rounded font-extrabold uppercase">
                                Alta
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 px-1.5 py-0.25 rounded font-medium uppercase">
                                Normal
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                            <strong>Reparación:</strong> {f.fechaReparacion}
                          </p>
                          {f.observaciones && (
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 italic font-medium leading-tight">
                              &ldquo;{f.observaciones}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditStagedFalla(f)}
                            className={`focus:outline-none cursor-pointer p-1 rounded transition-colors ${
                              editingFallaId === f.id ? "text-amber-600 dark:text-amber-400 bg-amber-500/20" : "text-slate-500 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400"
                            }`}
                            title="Editar parámetros de esta falla"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStagedFalla(f.id)}
                            className="text-slate-500 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 focus:outline-none cursor-pointer p-1"
                            title="Remover falla"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* FEEDBACK BANNERS */}
        {errorBanner && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2 animate-pulse">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorBanner}</span>
          </div>
        )}

        {successBanner && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg">
            {successBanner}
          </div>
        )}

        {/* BOTON DE ACCION */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-lg transition-colors cursor-pointer uppercase"
          >
            Limpiar Formulario
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs rounded-lg shadow-md hover:shadow-amber-500/10 transition-all cursor-pointer uppercase"
          >
            Guardar Registro
          </button>
        </div>
      </form>
    </div>
  );
}
