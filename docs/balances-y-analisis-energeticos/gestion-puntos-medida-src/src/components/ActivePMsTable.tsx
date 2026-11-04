import React, { useState, useEffect } from "react";
import { 
  Filter, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Wrench, 
  Calendar, 
  Trash2, 
  Clock, 
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Cpu,
  History,
  FileText,
  Notebook,
  X,
  User
} from "lucide-react";
import { PM, Estructura, RelacionTransformacion } from "../types";

interface ActivePMsTableProps {
  pms: PM[];
  estructurasDict: Record<string, Estructura>;
  relacionesDict?: Record<string, RelacionTransformacion>;
  onTriggerIntervention: (pm: PM) => void;
  onEditPM: (codigoPM: string) => void;
  onDeletePM: (id: string, codigoPM?: string) => void;
  mode?: "pendientes" | "seguimiento";
}

export default function ActivePMsTable({
  pms,
  estructurasDict,
  relacionesDict = {},
  onTriggerIntervention,
  onEditPM,
  onDeletePM,
  mode = "pendientes"
}: ActivePMsTableProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZona, setSelectedZona] = useState("");
  const [selectedNivel, setSelectedNivel] = useState("");
  const [selectedTipo, setSelectedTipo] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedPrioridad, setSelectedPrioridad] = useState("");
  const [sortTiempoFalla, setSortTiempoFalla] = useState<"none" | "desc" | "asc">("none");

  // Options lists for filters
  const [zonas, setZonas] = useState<string[]>([]);
  const [niveles, setNiveles] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);

  // Expandable row state for structure list
  const [expandedPMId, setExpandedPMId] = useState<string | null>(null);

  // Expandable row state for technical specs
  const [expandedTechPMId, setExpandedTechPMId] = useState<string | null>(null);

  // Custom non-blocking delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Modal for detailed observations (Inicial, Revisión, Pendiente)
  const [observationModal, setObservationModal] = useState<{
    pm: PM;
    activeTab: "inicial" | "revision" | "pendiente";
    selectedRevisionIdx?: number;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && observationModal) {
        setObservationModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [observationModal]);

  const getRevisoresList = (pm: PM) => {
    if (pm.intervenciones && pm.intervenciones.length > 0) {
      return pm.intervenciones;
    }
    if (pm.ultimoReporteTecnico?.descripcion) {
      return [
        {
          id: "ultimo_reporte",
          fecha: pm.ultimoReporteTecnico.fecha || "Sin fecha",
          tecnico: pm.ultimoReporteTecnico.tecnico || "Técnico",
          descripcion: pm.ultimoReporteTecnico.descripcion,
          loQueQuedoPendiente: pm.ultimoReporteTecnico.loQueQuedoPendiente,
          fallasCorregidas: [],
          fallasPendientes: [],
          resultado: "Seguimiento" as const,
        }
      ];
    }
    return [];
  };

  useEffect(() => {
    const activeZonas = new Set<string>();
    const activeNiveles = new Set<string>();
    const activeTipos = new Set<string>();

    Object.values(estructurasDict).forEach((e) => {
      if (e.zona && e.zona !== "N/A") activeZonas.add(e.zona);
      if (e.nivel && e.nivel !== "N/A") activeNiveles.add(e.nivel);
      if (e.tipo && e.tipo !== "N/A") activeTipos.add(e.tipo);
    });

    setZonas(Array.from(activeZonas).sort());
    setNiveles(Array.from(activeNiveles).sort());
    setTipos(Array.from(activeTipos).sort());
  }, [estructurasDict]);

  const toggleExpand = (pmId: string) => {
    if (expandedPMId === pmId) {
      setExpandedPMId(null);
    } else {
      setExpandedPMId(pmId);
    }
  };

  // Helper to calculate raw days in failure for numerical sorting
  const getRawDaysInFailure = (pm: PM): number => {
    if (pm.estadoGral === "Ok" || !pm.activeFailures || pm.activeFailures.length === 0) {
      return -9999;
    }
    let oldestDateStr: string | null = null;
    pm.activeFailures.forEach(f => {
      if (f.fechaReporte) {
        if (!oldestDateStr || f.fechaReporte < oldestDateStr) {
          oldestDateStr = f.fechaReporte;
        }
      }
    });

    if (!oldestDateStr) return -9998;

    const oldestDate = new Date(oldestDateStr);
    const today = new Date();
    oldestDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - oldestDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper to calculate how long a point has been in failure
  const getDaysInFailure = (pm: PM) => {
    if (pm.estadoGral === "Ok" || !pm.activeFailures || pm.activeFailures.length === 0) {
      return "-";
    }
    const diffDays = getRawDaysInFailure(pm);

    if (diffDays <= -9998) return "Sin fecha";
    if (diffDays < 0) return "Agendado";
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "1 día";
    if (diffDays >= 365) {
      const years = (diffDays / 365).toFixed(1);
      const formattedYears = years.endsWith(".0") ? years.slice(0, -2) : years;
      return formattedYears === "1" ? "1 año" : `${formattedYears} años`;
    }
    return `${diffDays} días`;
  };

  // Filter PMs based on search and selected filters
  const filteredPMs = pms.filter((pm) => {
    // In Directorio de Pendientes, include active PMs in failure, installation, and en seguimiento
    if (pm.estadoGral === "Ok" && (!pm.activeFailures || pm.activeFailures.length === 0)) return false;

    // Search query match
    const matchesSearch = 
      pm.codigoPM.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pm.nombrePM.toLowerCase().includes(searchTerm.toLowerCase());

    // State filter (En falla, Seguimiento, Instalación)
    const matchesEstado = !selectedEstado
      ? true
      : (selectedEstado === "En falla"
          ? (pm.estadoGral === "En falla" || (pm.estadoGral as string) === "Para Revisión")
          : (selectedEstado === "Seguimiento"
              ? pm.estadoGral === "Seguimiento"
              : pm.estadoGral === selectedEstado));

    // Priority filter
    const isPMAlta = pm.prioridad === "Alta" || pm.activeFailures?.some(f => f.prioridad === "Alta");
    const pmPrioridad = isPMAlta ? "Alta" : "Normal";
    const matchesPrioridad = selectedPrioridad ? pmPrioridad === selectedPrioridad : true;

    // Area filters (matches any of the PM's linked structures)
    let matchesZona = true;
    let matchesNivel = true;
    let matchesTipo = true;

    if (selectedZona || selectedNivel || selectedTipo) {
      if (pm.estructuras.length === 0) {
        return false;
      }
      
      const structureMatches = pm.estructuras.some((estName) => {
        const est = estructurasDict[estName];
        if (!est) return false;

        const zoneMatch = selectedZona ? est.zona === selectedZona : true;
        const levelMatch = selectedNivel ? est.nivel === selectedNivel : true;
        const typeMatch = selectedTipo ? est.tipo === selectedTipo : true;

        return zoneMatch && levelMatch && typeMatch;
      });

      if (!structureMatches) {
        return false;
      }
    }

    return matchesSearch && matchesEstado && matchesPrioridad;
  });

  // Sort PMs by Tiempo en Falla if requested
  const sortedPMs = [...filteredPMs].sort((a, b) => {
    if (sortTiempoFalla === "desc") {
      return getRawDaysInFailure(b) - getRawDaysInFailure(a);
    }
    if (sortTiempoFalla === "asc") {
      return getRawDaysInFailure(a) - getRawDaysInFailure(b);
    }
    return 0;
  });

  // Calculate colors and classes for state badges
  const getStateBadge = (estado: string) => {
    switch (estado) {
      case "En falla":
      case "Para Revisión":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20";
      case "Seguimiento":
        return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40";
      case "Instalación":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
      case "Revisado":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20";
      default:
        return "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700";
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-zinc-900/50 backdrop-blur-md rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden animate-fade-in">
      
      {/* FILTER & SEARCH BAR */}
      <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de PM o nombre..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-amber-500 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 font-medium"
            />
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-500 dark:text-zinc-500" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-bold"
            >
              <option value="" className="text-zinc-900 bg-white font-medium">Todos los Estados</option>
              <option value="En falla" className="text-zinc-900 bg-white font-medium">En Falla</option>
              <option value="Seguimiento" className="text-zinc-900 bg-white font-medium">En Seguimiento</option>
              <option value="Instalación" className="text-zinc-900 bg-white font-medium">Instalación</option>
            </select>

            <select
              value={selectedPrioridad}
              onChange={(e) => setSelectedPrioridad(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-bold"
            >
              <option value="" className="text-zinc-900 bg-white font-medium">Todas las Prioridades</option>
              <option value="Alta" className="text-zinc-900 bg-white font-bold">Prioridad Alta 🔥</option>
              <option value="Normal" className="text-zinc-900 bg-white font-medium">Prioridad Normal</option>
            </select>

            <select
              value={sortTiempoFalla}
              onChange={(e) => setSortTiempoFalla(e.target.value as "none" | "desc" | "asc")}
              className="px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-amber-600 dark:text-amber-400 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-bold cursor-pointer"
            >
              <option value="none" className="text-zinc-900 bg-white font-medium">Ordenar Tiempo: Sin Orden</option>
              <option value="desc" className="text-zinc-900 bg-white font-medium">Tiempo en Falla: Mayor a Menor (↓)</option>
              <option value="asc" className="text-zinc-900 bg-white font-medium">Tiempo en Falla: Menor a Mayor (↑)</option>
            </select>
          </div>

        </div>

        {/* NESTED GEOGRAPHIC FILTERS */}
        <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-slate-200 dark:border-zinc-800/60 text-xs">
          <span className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            Ubicación:
          </span>

          <select
            value={selectedZona}
            onChange={(e) => setSelectedZona(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="" className="text-zinc-900 bg-white font-medium">Todas las Zonas</option>
            {zonas.map(z => (
              <option key={z} value={z} className="text-zinc-900 bg-white font-medium">{z}</option>
            ))}
          </select>

          <select
            value={selectedNivel}
            onChange={(e) => setSelectedNivel(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="" className="text-zinc-900 bg-white font-medium">Todos los Niveles</option>
            {niveles.map(n => (
              <option key={n} value={n} className="text-zinc-900 bg-white font-medium">{n}</option>
            ))}
          </select>

          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="" className="text-zinc-900 bg-white font-medium">Todos los Tipos</option>
            {tipos.map(t => (
              <option key={t} value={t} className="text-zinc-900 bg-white font-medium">{t}</option>
            ))}
          </select>

          {(selectedZona || selectedNivel || selectedTipo || selectedEstado || selectedPrioridad || searchTerm || sortTiempoFalla !== "none") && (
            <button
              onClick={() => {
                setSelectedZona("");
                setSelectedNivel("");
                setSelectedTipo("");
                setSelectedEstado("");
                setSelectedPrioridad("");
                setSearchTerm("");
                setSortTiempoFalla("none");
              }}
              className="text-[11px] font-extrabold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 cursor-pointer ml-auto uppercase"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* TABLE WITH STICKY HEADER */}
      <div className="overflow-x-auto overflow-y-auto max-h-[650px] relative rounded-b-xl border-t border-slate-200 dark:border-zinc-800">
        {sortedPMs.length === 0 ? (
          <div className="text-center py-12 px-4 animate-pulse">
            <Clock className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
            <p className="text-sm text-slate-700 dark:text-zinc-300 font-bold">
              No se encontraron puntos de medida con fallas o tareas pendientes.
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 max-w-md mx-auto">
              Todos los puntos de medida activos se encuentran en estado normal o no coinciden con los filtros aplicados.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-white dark:bg-zinc-950 shadow-md">
              <tr className="bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-xs uppercase font-extrabold tracking-wider">
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950">Punto de Medida</th>
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950">Estructuras / Impacto</th>
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950">Estado</th>
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950">Prioridad</th>
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950 text-center">Revisiones</th>
                <th 
                  onClick={() => {
                    if (sortTiempoFalla === "none") setSortTiempoFalla("desc");
                    else if (sortTiempoFalla === "desc") setSortTiempoFalla("asc");
                    else setSortTiempoFalla("none");
                  }}
                  className="py-4.5 px-5 bg-white dark:bg-zinc-950 cursor-pointer select-none hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title="Haga clic para ordenar por Tiempo en Falla"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tiempo en Falla</span>
                    {sortTiempoFalla === "desc" && <ArrowDown className="w-3.5 h-3.5 text-amber-500" />}
                    {sortTiempoFalla === "asc" && <ArrowUp className="w-3.5 h-3.5 text-amber-500" />}
                    {sortTiempoFalla === "none" && <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400" />}
                  </div>
                </th>
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950 w-1/4">Observaciones</th>
                <th className="py-4.5 px-5 bg-white dark:bg-zinc-950 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/60 text-sm">
              {sortedPMs.map((pm) => {
                const isExpanded = expandedPMId === pm.id;
                const isTechExpanded = expandedTechPMId === pm.id;
                const isConfirmingDelete = deleteConfirmId === pm.id;
                const relData = relacionesDict[pm.codigoPM];
                
                return (
                  <React.Fragment key={pm.id}>
                    <tr className="hover:bg-slate-100 dark:hover:bg-zinc-800/20 transition-colors">
                      
                      {/* PM CODE & NAME */}
                      <td className="py-4 px-5">
                        <div className="font-sans font-bold text-slate-900 dark:text-zinc-100 font-mono tracking-wide">{pm.codigoPM}</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">{pm.nombrePM}</div>
                        <button
                          onClick={() => setExpandedTechPMId(prev => prev === pm.id ? null : pm.id)}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2 py-0.5 rounded cursor-pointer transition-all"
                          title="Ver datos técnicos de transformación y medidor"
                        >
                          <Cpu className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>Datos Técnicos</span>
                          {isTechExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </td>

                      {/* STRUCTURES / IMPACT */}
                      <td className="py-4 px-5">
                        <button
                          onClick={() => toggleExpand(pm.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/15 px-2.5 py-1 rounded-full cursor-pointer focus:outline-none transition-all"
                        >
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{pm.estructuras.length} Estructuras</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 animate-bounce" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* ESTADO GENERAL */}
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${getStateBadge(pm.estadoGral)}`}>
                            {pm.estadoGral === "Seguimiento" 
                              ? "En Seguimiento" 
                              : (pm.estadoGral as string) === "Para Revisión" 
                                ? "En falla" 
                                : pm.estadoGral}
                          </span>
                        </div>
                      </td>

                      {/* PRIORIDAD (NORMAL O ALTA) */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          {pm.prioridad === "Alta" || pm.activeFailures?.some(f => f.prioridad === "Alta") ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 shadow-sm shadow-red-950/40">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                              Alta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700/60">
                              Normal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* REVISIONES COLUMN */}
                      <td className="py-4 px-5 text-center">
                        {(() => {
                          const isSeguimiento = pm.estadoGral === "Seguimiento";
                          if (!isSeguimiento) {
                            return (
                              <span className="font-bold text-slate-500 dark:text-zinc-500 font-mono text-xs">
                                0
                              </span>
                            );
                          }
                          const revisoresList = getRevisoresList(pm);
                          const count = revisoresList.length;
                          const lastRevDate = count > 0 ? revisoresList[count - 1]?.fecha : null;

                          return (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-xs">
                                {count}
                              </span>
                              {lastRevDate && (
                                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono whitespace-nowrap">
                                  {lastRevDate}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* TIME IN FAILURE */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <span className={`font-mono text-xs font-bold block ${pm.estadoGral === "En falla" || pm.estadoGral === "Seguimiento" ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-zinc-500"}`}>
                            {getDaysInFailure(pm)}
                          </span>
                          {pm.activeFailures && pm.activeFailures.length > 0 && (
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500 flex-shrink-0" />
                              <span>
                                {Array.from(new Set(pm.activeFailures.map(f => f.fechaReporte).filter(Boolean))).join(", ") || "Sin fecha"}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* OBSERVACIONES: SOLO 1 ÍCONO DE LA LIBRETA */}
                      <td className="py-4 px-5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const revs = getRevisoresList(pm);
                            setObservationModal({ 
                              pm, 
                              activeTab: "inicial", 
                              selectedRevisionIdx: revs.length > 0 ? revs.length - 1 : 0 
                            });
                          }}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-300 dark:border-zinc-700/80 hover:border-amber-500/50 shadow-sm transition-all cursor-pointer group"
                          title="Ver observaciones en la libreta"
                        >
                          <Notebook className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                        </button>
                      </td>

                      {/* ROW ACTION BUTTONS */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 ml-auto">
                          
                          <button
                            onClick={() => onTriggerIntervention(pm)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                              pm.estadoGral === "Seguimiento"
                                ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-md shadow-amber-500/20"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white"
                            }`}
                            title={pm.estadoGral === "Seguimiento" ? "Nueva Revisión / Registrar Intervención" : "Intervenir"}
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => onEditPM(pm.codigoPM)}
                            className="p-2 text-slate-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 bg-white dark:bg-zinc-950 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* INLINE CUSTOM CONFIRM DELETION */}
                          {isConfirmingDelete ? (
                            <button
                              onClick={() => {
                                onDeletePM(pm.id, pm.codigoPM);
                                setDeleteConfirmId(null);
                              }}
                              className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 uppercase tracking-tight animate-pulse"
                              title="Confirmar eliminación permanente"
                            >
                              <AlertCircle className="w-3 h-3" />
                              ¿Eliminar?
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setDeleteConfirmId(pm.id);
                                // Clear confirm after 4 seconds automatically
                                setTimeout(() => setDeleteConfirmId(prev => prev === pm.id ? null : prev), 4000);
                              }}
                              className="text-slate-500 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Borrar registro de falla"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>

                    {/* EXPANDED ROW: STRUCTURE DETAILS */}
                    {isExpanded && (
                      <tr className="bg-white dark:bg-zinc-950/40">
                        <td colSpan={7} className="py-3 px-8 border-b border-slate-200 dark:border-zinc-800">
                          <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-inner shadow-black/50">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2.5 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                              Mapa de Estructuras Afectadas ({pm.estructuras.length})
                            </h5>
                            {pm.estructuras.length === 0 ? (
                              <p className="text-xs text-slate-500 dark:text-zinc-500 italic">No hay estructuras asignadas a este punto de medida en la base de datos de red.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {pm.estructuras.map((estName) => {
                                  const detail = estructurasDict[estName];
                                  return (
                                    <div key={estName} className="p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/60 rounded-lg text-xs flex justify-between items-center">
                                      <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">{estName}</span>
                                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium">
                                        {detail ? `${detail.tipo} | ${detail.zona} | ${detail.nivel}` : "No mapeado"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* EXPANDED ROW: TECHNICAL SPECS & TRANSFORMERS */}
                    {isTechExpanded && (
                      <tr className="bg-white dark:bg-zinc-950/80">
                        <td colSpan={7} className="py-3 px-8 border-b border-slate-200 dark:border-zinc-800">
                          <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-amber-500/30 shadow-xl shadow-black/80">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                              <h5 className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                                <Cpu className="w-4 h-4 text-amber-500" />
                                Especificaciones Técnicas y Relación de Transformación — {pm.codigoPM} ({pm.nombrePM})
                              </h5>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded">
                                {relData?.cuenta ? `Cuenta: ${relData.cuenta}` : "Punto de Medida: " + pm.codigoPM}
                              </span>
                            </div>

                            {relData ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* CARD 1: TRANSFORMADORES CT/PT */}
                                <div className="p-3 bg-slate-50 dark:bg-zinc-900/90 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-1.5">
                                  <div className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wide border-b border-slate-200 dark:border-zinc-800 pb-1 flex items-center justify-between">
                                    <span>Transformadores</span>
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">CT / PT</span>
                                  </div>
                                  <div className="text-xs font-mono space-y-1 text-slate-700 dark:text-zinc-300 pt-0.5">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Relación CT:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.ct || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Factor CT (F. CT):</span>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">{relData.fCt || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Relación PT:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.pt || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Factor PT (F. PT):</span>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">{relData.fPt || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-zinc-800/80">
                                      <span className="text-slate-500 dark:text-zinc-500">Factor Sistema:</span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{relData.factorSistema || "N/A"}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* CARD 2: MEDIDOR */}
                                <div className="p-3 bg-slate-50 dark:bg-zinc-900/90 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-1.5">
                                  <div className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wide border-b border-slate-200 dark:border-zinc-800 pb-1 flex items-center justify-between">
                                    <span>Equipo de Medida</span>
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">Medidor</span>
                                  </div>
                                  <div className="text-xs font-mono space-y-1 text-slate-700 dark:text-zinc-300 pt-0.5">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Nº Medidor:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.medidor || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Marca:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.marcaMedidor || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Tipo Medidor:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.tipoMedidor || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Clase Precisión:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.clase || "N/A"}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* CARD 3: COMUNICACIÓN Y CUENTA */}
                                <div className="p-3 bg-slate-50 dark:bg-zinc-900/90 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-1.5">
                                  <div className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wide border-b border-slate-200 dark:border-zinc-800 pb-1 flex items-center justify-between">
                                    <span>Comunicaciones y Cuenta</span>
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">Telemedida</span>
                                  </div>
                                  <div className="text-xs font-mono space-y-1 text-slate-700 dark:text-zinc-300 pt-0.5">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Nº de Cuenta:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.cuenta || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Tipo Comunicación:</span>
                                      <span className="font-bold text-slate-900 dark:text-zinc-100">{relData.comunicacion || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 dark:text-zinc-500">Dirección IP:</span>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">{relData.dirIp || "N/A"}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 text-xs text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/60 rounded-lg border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <span>No se encontraron especificaciones técnicas registradas para el nemonico <strong>{pm.codigoPM}</strong>.</span>
                                <span className="text-[10px] text-slate-500 dark:text-zinc-500">Cargue el archivo 'Relaciones Transformacion.csv' en Configuración.</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DETALLE DE OBSERVACIONES Y PENDIENTES */}
      {observationModal && (() => {
        const { pm, activeTab, selectedRevisionIdx = 0 } = observationModal;
        const revisoresList = getRevisoresList(pm);
        const hasRevisions = revisoresList.length > 0;
        const hasPending = Boolean(pm.loQueQuedoPendiente || revisoresList.some(r => r.loQueQuedoPendiente));
        const showAllThree = hasRevisions || hasPending;

        const effectiveRevIdx = Math.min(Math.max(0, selectedRevisionIdx), Math.max(0, revisoresList.length - 1));
        const currentRev = revisoresList[effectiveRevIdx] || null;

        const currentPendingText = pm.loQueQuedoPendiente || (currentRev?.loQueQuedoPendiente) || "";

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setObservationModal(null)}
          >
            <div 
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL HEADER */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    activeTab === "pendiente"
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                      : activeTab === "revision"
                        ? "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                  }`}>
                    {activeTab === "pendiente" ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : activeTab === "revision" ? (
                      <Wrench className="w-5 h-5" />
                    ) : (
                      <Notebook className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 truncate">
                      {activeTab === "pendiente"
                        ? "Detalle de Motivo y Tareas Pendientes"
                        : activeTab === "revision"
                          ? `Detalle de Revisión Técnica${revisoresList.length > 1 ? ` (${effectiveRevIdx + 1} de ${revisoresList.length})` : ""}`
                          : "Detalle de Reporte Inicial de Falla"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{pm.codigoPM}</span> &bull; {pm.nombrePM}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setObservationModal(null)}
                  className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors shrink-0 cursor-pointer"
                  title="Cerrar modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* TABS DE NAVEGACIÓN: 3 ITEMS (Inicial, Revisión, Pendiente) O SOLO 1 ITEM (Inicial) */}
              <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/30 flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setObservationModal(prev => prev ? { ...prev, activeTab: "inicial" } : null)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    activeTab === "inicial"
                      ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-extrabold"
                      : "bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
                  }`}
                  title="Reporte inicial y fallas registradas"
                >
                  <Notebook className="w-3.5 h-3.5" />
                  <span>Inicial</span>
                </button>

                {showAllThree && (
                  <>
                    <button
                      type="button"
                      onClick={() => setObservationModal(prev => prev ? { ...prev, activeTab: "revision" } : null)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        activeTab === "revision"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-extrabold"
                          : "bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
                      }`}
                      title="Intervenciones y revisiones técnicas realizadas"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Revisión</span>
                      {revisoresList.length > 0 && (
                        <span className="text-[10px] ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-900/60 text-blue-200 font-mono">
                          {revisoresList.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setObservationModal(prev => prev ? { ...prev, activeTab: "pendiente" } : null)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        activeTab === "pendiente"
                          ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/30 font-extrabold"
                          : "bg-slate-50 dark:bg-zinc-900 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-amber-500/30"
                      }`}
                      title="Lo que quedó pendiente y motivo del seguimiento"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Pendiente</span>
                    </button>
                  </>
                )}
              </div>

              {/* MODAL BODY (SCROLLABLE) */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[calc(90vh-140px)]">
                {activeTab === "inicial" && (
                  /* VISTA 1: REPORTE INICIAL */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-xl">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 dark:text-zinc-500">Estado general:</span>
                        <span className="font-bold text-slate-800 dark:text-zinc-200">{pm.estadoGral}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 dark:text-zinc-500">Prioridad:</span>
                        <span className={`font-bold ${pm.prioridad === "Alta" ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-zinc-300"}`}>
                          {pm.prioridad || "Normal"}
                        </span>
                      </div>
                      {pm.activeFailures && pm.activeFailures.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" />
                          <span>
                            {Array.from(new Set(pm.activeFailures.map(f => f.fechaReporte).filter(Boolean))).join(", ") || "Sin fecha registrada"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        Fallas y Comentarios Iniciales ({pm.activeFailures?.length || 0})
                      </h4>

                      {!pm.activeFailures || pm.activeFailures.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500 italic">
                          No hay fallas reportadas activas para este punto de medida.
                        </div>
                      ) : (
                        pm.activeFailures.map((f, idx) => {
                          const isInstalacion = f.componente === "Instalación" || (f.componente === "Medidor" && f.detalle === "Instalación");
                          const displayComponente = isInstalacion ? "Instalación" : f.componente;
                          const showDetalle = f.detalle && f.detalle !== displayComponente && !isInstalacion;

                          return (
                            <div key={f.id || idx} className="p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/90 rounded-xl space-y-2.5 shadow-sm">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{displayComponente}</span>
                                  {showDetalle && (
                                    <span className="text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded font-medium">
                                      {f.detalle}
                                    </span>
                                  )}
                                </div>
                                {f.fechaReporte && (
                                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" />
                                    {f.fechaReporte}
                                  </span>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
                                  Observaciones iniciales de la falla:
                                </span>
                                {f.observaciones && !f.observaciones.startsWith("Devuelta a pendientes desde intervención") ? (
                                  <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap bg-white dark:bg-zinc-950/80 p-3 rounded-lg border border-slate-200 dark:border-zinc-800/80">
                                    &ldquo;{f.observaciones}&rdquo;
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-500 dark:text-zinc-500 italic">
                                    Sin observaciones adicionales reportadas al registrar la falla.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "revision" && (
                  /* VISTA 2: REVISIÓN (INTERVENCIONES Y OBSERVACIONES DEL TÉCNICO) */
                  <div className="space-y-4">
                    {revisoresList.length === 0 ? (
                      <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-center space-y-2">
                        <Wrench className="w-8 h-8 text-slate-600 dark:text-zinc-600 mx-auto" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">No se han registrado revisiones o intervenciones técnicas para este punto.</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500">Haga clic en el botón de la llave inglesa en la tabla para registrar una nueva revisión técnica.</p>
                      </div>
                    ) : (
                      <>
                        {/* SELECTOR ENTRE MÚLTIPLES REVISIONES SI EXISTE MÁS DE 1 */}
                        {revisoresList.length > 1 && (
                          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-900/80 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider pl-1 shrink-0">
                              Revisiones Realizadas ({revisoresList.length}):
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              {revisoresList.map((r, idx) => (
                                <button
                                  key={r.id || idx}
                                  type="button"
                                  onClick={() => setObservationModal(prev => prev ? { ...prev, selectedRevisionIdx: idx } : null)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    effectiveRevIdx === idx
                                      ? "bg-blue-600 text-white font-extrabold shadow-sm"
                                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                                  }`}
                                >
                                  Revisión {idx + 1}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {currentRev && (
                          <div className="space-y-4 animate-in fade-in duration-150">
                            {/* METADATOS DE LA REVISIÓN */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-xl">
                              <div className="space-y-0.5">
                                <span className="text-[11px] text-slate-500 dark:text-zinc-500 block uppercase font-bold tracking-wider">Fecha de Revisión</span>
                                <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                  {currentRev.fecha || "Sin fecha"}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[11px] text-slate-500 dark:text-zinc-500 block uppercase font-bold tracking-wider">Técnico / Cuadrilla</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                  {currentRev.tecnico || "No especificado"}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[11px] text-slate-500 dark:text-zinc-500 block uppercase font-bold tracking-wider">Resultado</span>
                                <span className={`text-xs font-bold flex items-center gap-1 ${
                                  currentRev.resultado === "Seguimiento" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                                }`}>
                                  {currentRev.resultado === "Seguimiento" ? (
                                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  )}
                                  {currentRev.resultado || "En seguimiento"}
                                </span>
                              </div>
                            </div>

                            {/* OBSERVACIONES Y DESCRIPCIÓN DE LA REVISIÓN */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                Observaciones del Revisor / Trabajos Realizados
                              </h4>
                              <div className="p-4 bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap font-normal shadow-inner shadow-black/40">
                                {currentRev.descripcion || "Sin descripción de trabajos registrada para esta revisión."}
                              </div>
                            </div>

                            {/* FALLAS CORREGIDAS EN ESTA REVISIÓN */}
                            {currentRev.fallasCorregidas && currentRev.fallasCorregidas.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  Fallas corregidas en esta revisión ({currentRev.fallasCorregidas.length}):
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {currentRev.fallasCorregidas.map((fc, idx) => (
                                    <div key={fc.id || idx} className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs flex items-center justify-between">
                                      <span className="font-bold text-emerald-300">{fc.componente}</span>
                                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{fc.detalle || "Corregido"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* FALLAS PENDIENTES TRAS ESTA REVISIÓN */}
                            {currentRev.fallasPendientes && currentRev.fallasPendientes.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  Fallas que continuaron pendientes ({currentRev.fallasPendientes.length}):
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {currentRev.fallasPendientes.map((fp, idx) => (
                                    <div key={fp.id || idx} className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs flex items-center justify-between">
                                      <span className="font-bold text-amber-700 dark:text-amber-300">{fp.componente}</span>
                                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{fp.detalle}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === "pendiente" && (
                  /* VISTA 3: PENDIENTE (LO QUE QUEDÓ PENDIENTE / MOTIVO DEL SEGUIMIENTO) */
                  <div className="space-y-4">
                    {/* BLOQUE PRINCIPAL: LO QUE QUEDÓ PENDIENTE */}
                    <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/35 rounded-xl space-y-3 shadow-lg shadow-amber-950/20">
                      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                        <h4 className="text-sm font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                          Motivo del Seguimiento / ¿Qué quedó pendiente?
                        </h4>
                        <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
                          Pendiente
                        </span>
                      </div>
                      <p className="text-sm text-slate-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap font-medium bg-white dark:bg-zinc-950/80 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                        {currentPendingText || "No se registró descripción detallada de pendientes."}
                      </p>
                    </div>

                    {/* HISTORIAL CRONOLÓGICO DE PENDIENTES SI HUBIERON VARIAS REVISIONES */}
                    {revisoresList.length > 0 && revisoresList.some(r => r.loQueQuedoPendiente) && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-500 dark:text-zinc-500" />
                          Historial de pendientes por revisión:
                        </h5>
                        <div className="space-y-2">
                          {revisoresList.map((rev, idx) => {
                            if (!rev.loQueQuedoPendiente) return null;
                            return (
                              <div key={rev.id || idx} className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs space-y-1">
                                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                                  <span className="font-bold text-amber-600 dark:text-amber-400">Revisión {idx + 1} — {rev.fecha || "Sin fecha"}</span>
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-500">{rev.tecnico || "Técnico"}</span>
                                </div>
                                <p className="text-slate-800 dark:text-zinc-200">{rev.loQueQuedoPendiente}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* FALLAS ACTIVAS ASOCIADAS */}
                    {pm.activeFailures && pm.activeFailures.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Fallas asociadas aún activas ({pm.activeFailures.length}):
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pm.activeFailures.map((af, idx) => (
                            <div key={af.id || idx} className="p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-zinc-200">{af.componente}</span>
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">{af.detalle}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setObservationModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
