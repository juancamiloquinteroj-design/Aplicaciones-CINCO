import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Settings, 
  Wrench, 
  History, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  Sparkles,
  Info,
  X,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { 
  getPMs, 
  subscribePMs,
  savePM, 
  deletePM, 
  getBaseNetworkData,
  syncLocalDataToFirestoreIfAny,
  ensureFirebaseInitialized
} from "./lib/firebase";
import { PM, Estructura, PMBase, ActiveFailure, RelacionTransformacion } from "./types";

import SettingsPanel from "./components/SettingsPanel";
import PMForm from "./components/PMForm";
import ActivePMsTable from "./components/ActivePMsTable";
import InterventionsHistory from "./components/InterventionsHistory";
import InterventionModal from "./components/InterventionModal";
import Dashboard from "./components/Dashboard";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"inicio" | "directorio" | "registrar" | "historial" | "configuracion">("inicio");

  // Core Data State
  const [pms, setPMs] = useState<PM[]>([]);
  const [baseData, setBaseData] = useState<{
    estructuras: Record<string, Estructura>;
    pms: Record<string, PMBase>;
    relaciones: Record<string, RelacionTransformacion>;
  }>({ estructuras: {}, pms: {}, relaciones: {} });

  // Modal / Interaction State
  const [selectedPMForIntervention, setSelectedPMForIntervention] = useState<PM | null>(null);
  const [reprogramTarget, setReprogramTarget] = useState<{ pm: PM; failure: ActiveFailure } | null>(null);
  const [reprogramDate, setReprogramDate] = useState("");

  // Edit Routing
  const [editPMCode, setEditPMCode] = useState<string>("");

  // Loading indicator
  const [loading, setLoading] = useState(true);

  // Initialize and load data on mount with non-blocking background synchronization and real-time subscription
  useEffect(() => {
    let unsubscribePMs: (() => void) | null = null;

    async function init() {
      // 1. Load instantly from local cache (renders the dashboard immediately, even if empty)
      try {
        function getLocal<T>(key: string, defaultValue: T): T {
          const data = localStorage.getItem(key);
          return data ? JSON.parse(data) : defaultValue;
        }
        const localPMs = getLocal<PM[]>("pm_registrations", []);
        const localEst = getLocal<Record<string, Estructura>>("estMaestroCache_v5", {});
        const localBasePMs = getLocal<Record<string, PMBase>>("pmsDictCache_v5", {});
        const localRel = getLocal<Record<string, RelacionTransformacion>>("relacionesCache_v5", {});

        setPMs(localPMs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        setBaseData({ estructuras: localEst, pms: localBasePMs, relaciones: localRel });
      } catch (e) {
        console.error("Error reading initial local storage cache:", e);
      } finally {
        setLoading(false);
      }

      // 2. Perform Firebase initialization, selective sync, and subscribe to real-time changes
      try {
        await ensureFirebaseInitialized();
        await syncLocalDataToFirestoreIfAny();

        unsubscribePMs = subscribePMs((updatedPMs) => {
          setPMs(updatedPMs);
        });

        const networkBase = await getBaseNetworkData();
        setBaseData(networkBase);
      } catch (err) {
        console.error("Error running background cloud database sync:", err);
      }
    }

    init();

    return () => {
      if (unsubscribePMs) {
        unsubscribePMs();
      }
    };
  }, []);

  // Sync / Action Handlers
  const handleSavePM = async (pm: PM) => {
    // 1. Update local state immediately (optimistic UI) so the directory and list populate instantly
    setPMs((prev) => {
      const exists = prev.some((p) => p.id === pm.id);
      if (exists) {
        return prev.map((p) => (p.id === pm.id ? pm : p));
      } else {
        return [pm, ...prev];
      }
    });

    // 2. Perform persistence in the background
    try {
      await savePM(pm);
    } catch (err) {
      console.error("Error saving PM to database:", err);
    }
  };

  const handleDeletePM = async (id: string) => {
    // 1. Update local state immediately (optimistic UI) so it disappears from the screen instantly
    setPMs((prev) => prev.filter((p) => p.id !== id));

    // 2. Perform deletion in the background
    try {
      await deletePM(id);
    } catch (err) {
      console.error("Error deleting PM from database:", err);
    }
  };

  const handleSync = async () => {
    try {
      await syncLocalDataToFirestoreIfAny();
      const [pmsList, networkBase] = await Promise.all([
        getPMs(),
        getBaseNetworkData()
      ]);
      setPMs(pmsList);
      setBaseData(networkBase);
    } catch (err) {
      console.error("Error during manual sync:", err);
      throw err;
    }
  };

  const handleUploadSuccess = (
    estructuras: Record<string, Estructura>,
    pmsDict: Record<string, PMBase>,
    relaciones: Record<string, RelacionTransformacion>
  ) => {
    setBaseData({ estructuras, pms: pmsDict, relaciones });
  };

  const handleSaveIntervention = async (pmId: string, updatedPM: PM) => {
    // 1. Close modal instantly as a visual indicator of saving success
    setSelectedPMForIntervention(null);
    
    // 2. Perform save and state sync in the background
    await handleSavePM(updatedPM);
  };

  const handleDeleteIntervention = async (pmId: string, interventionId: string) => {
    const targetPM = pms.find((p) => p.id === pmId);
    if (!targetPM) return;

    const updatedIntervenciones = targetPM.intervenciones.filter((int) => int.id !== interventionId);
    const newPM = {
      ...targetPM,
      intervenciones: updatedIntervenciones,
      updatedAt: new Date().toISOString()
    };

    // Update local state immediately (optimistic UI)
    setPMs((prev) => prev.map((p) => (p.id === pmId ? newPM : p)));

    // Perform database save in background
    try {
      await savePM(newPM);
    } catch (err) {
      console.error("Error saving PM after deleting intervention:", err);
    }
  };

  const handleTriggerEdit = (codigoPM: string) => {
    setEditPMCode(codigoPM);
    setActiveTab("registrar");
  };

  // Hook para la app padre (balances-y-analisis-energeticos/index.html, que
  // embebe esta app por iframe en el mismo origen) -- la alerta de "medida
  // en falla" de Ver Balance llama a esto para abrir directo el formulario
  // de esa medida acá, sin que el usuario tenga que buscarla manualmente.
  useEffect(() => {
    (window as any).pmAbrirPorCodigo = (codigoPM: string) => {
      setEditPMCode(codigoPM);
      setActiveTab("registrar");
    };
    return () => {
      delete (window as any).pmAbrirPorCodigo;
    };
  }, []);

  const handleOpenReprogram = (pm: PM, failure: ActiveFailure) => {
    setReprogramTarget({ pm, failure });
    setReprogramDate(failure.fechaReparacion === "Sin definir" ? "" : failure.fechaReparacion);
  };

  const handleSaveReprogram = async () => {
    if (!reprogramTarget || !reprogramDate) return;

    const { pm, failure } = reprogramTarget;
    
    // Update the specific failure
    const updatedFailures = pm.activeFailures.map((f) => {
      if (f.id === failure.id) {
        return {
          ...f,
          fechaReparacion: reprogramDate,
          vecesReprogramada: f.vecesReprogramada + 1
        };
      }
      return f;
    });

    // If any active failure is updated and the PM status was "En falla", we mark as "En falla" (or we can use "Reprogramada" as a display helper state)
    // In our design, we keep the main state but display reprogram counts. Let's make sure.
    const updatedPM: PM = {
      ...pm,
      activeFailures: updatedFailures,
      estadoGral: pm.estadoGral === "En falla" ? "En falla" : pm.estadoGral,
      updatedAt: new Date().toISOString()
    };

    await handleSavePM(updatedPM);
    setReprogramTarget(null);
    setReprogramDate("");
  };

  // Calculate Overdue Failures on the fly
  const getOverdueFailures = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();
    const overdue: { pm: PM; failure: ActiveFailure }[] = [];

    pms.forEach((pm) => {
      if (pm.estadoGral !== "Ok") {
        pm.activeFailures.forEach((f) => {
          if (f.fechaReparacion && f.fechaReparacion !== "Sin definir") {
            const repairTime = new Date(f.fechaReparacion).getTime();
            if (repairTime < todayTime) {
              overdue.push({ pm, failure: f });
            }
          }
        });
      }
    });

    return overdue;
  };

  const overdueList = getOverdueFailures();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* GLORIOUS TOP DECORATIVE LOGO & NAVIGATION */}
      <header className="bg-slate-50 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-40 shadow-xl/50 shadow-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center shadow-md shadow-amber-500/20 font-bold shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                Control de Mantenimiento en Puntos de Medida
              </h1>
            </div>
          </div>

          {/* MENUS / TAB TRIGGER BUTTONS - HORIZONTAL */}
          <nav className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-zinc-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 w-full">
            <button
              onClick={() => {
                setEditPMCode("");
                setActiveTab("inicio");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "inicio"
                  ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Inicio
            </button>

            <button
              onClick={() => {
                setEditPMCode("");
                setActiveTab("directorio");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "directorio"
                  ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Directorio de Pendientes
            </button>

            <button
              onClick={() => {
                setEditPMCode("");
                setActiveTab("registrar");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "registrar"
                  ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Reportar Falla
            </button>

            <button
              onClick={() => {
                setEditPMCode("");
                setActiveTab("historial");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "historial"
                  ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Historial de Intervenciones
            </button>

            <button
              onClick={() => {
                setEditPMCode("");
                setActiveTab("configuracion");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "configuracion"
                  ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Configuración
            </button>
          </nav>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* OVERDUE ACTIONS BANNER PANEL */}
        {overdueList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-100 dark:bg-red-950/20 border-l-4 border-red-500 p-5 rounded-xl shadow-md border border-red-900/40 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-900/40 pb-2.5">
              <h2 className="text-sm font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                ⚠️ Seguimiento de Acciones Vencidas ({overdueList.length})
              </h2>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {overdueList.map(({ pm, failure }) => {
                return (
                  <div
                    key={`${pm.id}_${failure.id}`}
                    className="bg-slate-50 dark:bg-zinc-900/60 p-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-zinc-900"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 text-sm">{pm.codigoPM}</span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">({pm.nombrePM})</span>
                        <span className="bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/35 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                          {pm.estadoGral}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-zinc-300">
                        Falla en <strong className="text-slate-900 dark:text-zinc-100">{failure.componente}</strong> ({failure.detalle}).
                        Debió gestionarse el: <strong className="text-red-600 dark:text-red-400">{failure.fechaReparacion}</strong>
                      </p>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedPMForIntervention(pm)}
                        className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Intervenir
                      </button>

                      <button
                        onClick={() => handleOpenReprogram(pm, failure)}
                        className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Reprogramar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* CORE APPLICATION BODY WITH TAB ROUTING */}
        {loading ? (
          <div className="text-center py-24">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">Sincronizando con base de datos en la nube...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "inicio" && (
                <Dashboard 
                  pms={pms} 
                  baseData={baseData}
                  onNavigate={(tab) => {
                    setEditPMCode("");
                    setActiveTab(tab);
                  }} 
                />
              )}

              {activeTab === "directorio" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                        Directorio de Puntos de Medida Pendientes
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Puntos de medida activos en falla, instalación o revisión</p>
                    </div>
                  </div>
                  
                  <ActivePMsTable
                    pms={pms}
                    estructurasDict={baseData.estructuras}
                    relacionesDict={baseData.relaciones || {}}
                    onTriggerIntervention={(pm) => setSelectedPMForIntervention(pm)}
                    onEditPM={handleTriggerEdit}
                    onDeletePM={handleDeletePM}
                  />
                </div>
              )}

              {activeTab === "registrar" && (
                <PMForm
                  estructurasDict={baseData.estructuras}
                  pmsDict={baseData.pms}
                  existingPMs={pms}
                  onSavePM={handleSavePM}
                  initialPMCode={editPMCode}
                  onClearEdit={() => setEditPMCode("")}
                />
              )}

              {activeTab === "historial" && (
                <InterventionsHistory pms={pms} onDeleteIntervention={handleDeleteIntervention} />
              )}

              {activeTab === "configuracion" && (
                <SettingsPanel
                  onUploadSuccess={handleUploadSuccess}
                  estructurasCount={Object.keys(baseData.estructuras).length}
                  pmsCount={Object.keys(baseData.pms).length}
                  relacionesCount={Object.keys(baseData.relaciones || {}).length}
                  currentBaseData={baseData}
                  onSync={handleSync}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

      </main>

      {/* MODAL 1: REGISTRAR INTERVENCIÓN */}
      {selectedPMForIntervention && (
        <InterventionModal
          pm={selectedPMForIntervention}
          onClose={() => setSelectedPMForIntervention(null)}
          onSaveIntervention={handleSaveIntervention}
        />
      )}

      {/* MODAL 2: REPROGRAMAR FECHA INDIVIDUAL */}
      {reprogramTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-zinc-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-50 dark:bg-zinc-900 w-full max-w-sm rounded-xl shadow-xl border border-slate-200 dark:border-zinc-800 p-5 space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 pb-2">
              <h3 className="text-sm font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                Reprogramar Reparación
              </h3>
              <button
                onClick={() => setReprogramTarget(null)}
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">PM: <strong className="text-slate-800 dark:text-zinc-200 font-mono">{reprogramTarget.pm.codigoPM}</strong></p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Componente: <strong className="text-slate-800 dark:text-zinc-200">{reprogramTarget.failure.componente} ({reprogramTarget.failure.detalle})</strong></p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">Nueva Fecha de Programación</label>
              <input
                type="date"
                value={reprogramDate}
                onChange={(e) => setReprogramDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => setReprogramTarget(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReprogram}
                disabled={!reprogramDate}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold rounded-lg shadow-sm cursor-pointer disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                Actualizar Fecha
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="py-8 bg-white dark:bg-zinc-950/50 text-center text-xs text-slate-500 dark:text-zinc-500 border-t border-slate-200 dark:border-zinc-900 mt-12">
        <p>© 2026 Cinco S.A.S</p>
        <p className="mt-1 font-medium text-[10px] text-slate-600 dark:text-zinc-600">Construido para Gestión Profesional de Redes de Medida</p>
      </footer>

    </div>
  );
}
