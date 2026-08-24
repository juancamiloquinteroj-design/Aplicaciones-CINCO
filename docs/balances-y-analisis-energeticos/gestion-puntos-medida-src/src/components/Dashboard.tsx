import React, { useState } from "react";
import { 
  ComposedChart,
  Bar, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer
} from "recharts";
import { 
  Activity, 
  MapPin, 
  AlertTriangle, 
  Settings,
  Calendar,
  Clock,
  CalendarX,
  ChevronDown,
  ChevronUp,
  Wrench,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  X,
  FileText,
  Download,
  CheckCircle
} from "lucide-react";
import { PM, Estructura, PMBase } from "../types";
import { generateExecutivePDFReport } from "../lib/exportUtils";

interface DashboardProps {
  pms: PM[];
  baseData?: {
    estructuras: Record<string, Estructura>;
    pms: Record<string, PMBase>;
  };
  onNavigate: (tab: "directorio" | "registrar" | "historial" | "configuracion") => void;
}

export default function Dashboard({ pms, baseData, onNavigate }: DashboardProps) {
  // Category expansion state for scheduled interventions
  const [expandedCategory, setExpandedCategory] = useState<"thisWeek" | "overdue" | "notScheduled" | "reprogrammed" | null>(null);

  // Expandable dropdown state for affected structures
  const [showStructuresDropdown, setShowStructuresDropdown] = useState(false);
  const [selectedStructureTypeFilter, setSelectedStructureTypeFilter] = useState<string>("TODAS");

  // Selected month state for modal full view
  const [selectedMonthModal, setSelectedMonthModal] = useState<any | null>(null);

  // 1. PMs in failure (including legacy Para Revisión)
  const pmsInFailure = pms.filter(pm => pm.estadoGral === "En falla" || (pm.estadoGral as string) === "Para Revisión").length;

  // 2. PMs in installation
  const pmsInInstallation = pms.filter(pm => pm.estadoGral === "Instalación").length;

  // 3. PMs revised (not intervened / pending)
  const pmsRevisados = pms.filter(pm => pm.estadoGral !== "Ok" && (pm.revisado || pm.estadoGral === "Revisado")).length;

  // 3. Affected unique structures
  const affectedStructures = new Set<string>();
  pms.forEach(pm => {
    if (pm.estadoGral !== "Ok") {
      pm.estructuras.forEach(est => {
        affectedStructures.add(est);
      });
    }
  });
  const totalAffectedStructures = affectedStructures.size;

  // Structure type breakdown calculations (PB, L, PT, etc.)
  const affectedStructuresByType: Record<string, { code: string; zone?: string; level?: string; pms: string[] }[]> = {};
  const typeCounts: Record<string, number> = {};

  affectedStructures.forEach((estCode) => {
    let type = "OTROS";
    const estObj = baseData?.estructuras?.[estCode];
    if (estObj?.tipo) {
      type = estObj.tipo.toUpperCase().trim();
    } else if (estCode.toUpperCase().startsWith("PB")) {
      type = "PB";
    } else if (estCode.toUpperCase().startsWith("L")) {
      type = "L";
    } else if (estCode.toUpperCase().startsWith("PT")) {
      type = "PT";
    } else {
      const match = estCode.match(/^[A-Za-z]+/);
      if (match) type = match[0].toUpperCase();
    }

    if (!affectedStructuresByType[type]) {
      affectedStructuresByType[type] = [];
    }

    const associatedPMs = pms
      .filter(pm => pm.estadoGral !== "Ok" && pm.estructuras.includes(estCode))
      .map(pm => pm.codigoPM);

    affectedStructuresByType[type].push({
      code: estCode,
      zone: estObj?.zona,
      level: estObj?.nivel,
      pms: associatedPMs
    });

    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  // Flatten structures for dropdown list
  const allAffectedStructuresList: { code: string; type: string; zone?: string; level?: string; pms: string[] }[] = [];
  Object.entries(affectedStructuresByType).forEach(([type, items]) => {
    items.forEach(item => {
      allAffectedStructuresList.push({ ...item, type });
    });
  });

  const filteredStructuresList = selectedStructureTypeFilter === "TODAS"
    ? allAffectedStructuresList
    : allAffectedStructuresList.filter(item => item.type === selectedStructureTypeFilter);

  // 4. Total active pending actions (not "Ok")
  const totalPendingPMs = pms.filter(pm => pm.estadoGral !== "Ok").length;

  // 5. Total PMs & Percentages
  const baseCount = baseData?.pms ? Object.keys(baseData.pms).length : 0;
  const totalPMs = baseCount > 0 ? baseCount : pms.length;
  const affectedPercentage = totalPMs > 0 ? ((totalPendingPMs / totalPMs) * 100).toFixed(1) : "0.0";

  // Total Structures & Percentage
  const totalEstructurasCount = baseData?.estructuras ? Object.keys(baseData.estructuras).length : 0;
  const structuresPercentage = totalEstructurasCount > 0 ? ((totalAffectedStructures / totalEstructurasCount) * 100).toFixed(1) : "0.0";

  // Helper to categorize PMs by intervention scheduling status
  const getInterventionScheduleStats = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + distToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const thisWeekList: { pm: PM; failureDetail: string; dateStr: string }[] = [];
    const overdueList: { pm: PM; failureDetail: string; dateStr: string }[] = [];
    const notScheduledList: { pm: PM; failureDetail: string }[] = [];
    const reprogrammedList: { pm: PM; failureDetail: string; vecesReprogramada: number; dateStr: string }[] = [];

    pms.forEach((pm) => {
      // Only include non-Ok PMs or PMs with active failures
      if (pm.estadoGral === "Ok" && (!pm.activeFailures || pm.activeFailures.length === 0)) {
        return;
      }

      const activeFails = pm.activeFailures || [];

      // Check for reprogrammed failures
      activeFails.forEach((f) => {
        if (f.vecesReprogramada && f.vecesReprogramada > 0) {
          reprogrammedList.push({
            pm,
            failureDetail: `${f.componente}: ${f.detalle}`,
            vecesReprogramada: f.vecesReprogramada,
            dateStr: f.fechaReparacion || "Sin definir"
          });
        }
      });

      if (activeFails.length === 0) {
        notScheduledList.push({
          pm,
          failureDetail: pm.estadoGral === "Instalación" ? "Pendiente por instalación" : "En revisión general"
        });
        return;
      }

      let matchedThisWeek = false;
      let matchedOverdue = false;
      let hasAnyValidDate = false;

      activeFails.forEach((f) => {
        const fDateStr = f.fechaReparacion;
        if (fDateStr && fDateStr !== "Sin definir") {
          hasAnyValidDate = true;
          const [y, m, d] = fDateStr.split("-").map(Number);
          if (y && m && d) {
            const fDate = new Date(y, m - 1, d, 12, 0, 0);
            if (fDate >= monday && fDate <= sunday) {
              matchedThisWeek = true;
              thisWeekList.push({
                pm,
                failureDetail: `${f.componente}: ${f.detalle}`,
                dateStr: fDateStr
              });
            } else if (fDate < todayStart) {
              matchedOverdue = true;
              overdueList.push({
                pm,
                failureDetail: `${f.componente}: ${f.detalle}`,
                dateStr: fDateStr
              });
            }
          }
        }
      });

      if (!hasAnyValidDate) {
        const firstFail = activeFails[0];
        notScheduledList.push({
          pm,
          failureDetail: firstFail ? `${firstFail.componente}: ${firstFail.detalle}` : "Sin fecha programada"
        });
      }
    });

    return { thisWeekList, overdueList, notScheduledList, reprogrammedList };
  };

  const { thisWeekList, overdueList, notScheduledList, reprogrammedList } = getInterventionScheduleStats();

  // Calculate combined monthly trace
  const getCombinedChartData = () => {
    const monthNames = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];
    
    const today = new Date();
    const months: { label: string; startDate: Date; endDate: Date }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = `${monthNames[month]} ${year}`;
      const startDate = new Date(year, month, 1, 0, 0, 0);
      const endDate = new Date(year, month + 1, 1, 0, 0, 0);
      months.push({ label, startDate, endDate });
    }

    interface FailureLifecycle {
      pmCode: string;
      pmName: string;
      estructuras: string[];
      componente?: string;
      detalle?: string;
      reportDate: Date;
      resolvedDate: Date | null;
    }

    const failureLifecycles: FailureLifecycle[] = [];

    pms.forEach((pm) => {
      pm.activeFailures.forEach((f) => {
        const rDate = f.fechaReporte ? new Date(f.fechaReporte) : new Date(pm.updatedAt || pm.createdAt || today);
        const validReport = !isNaN(rDate.getTime()) ? rDate : today;
        failureLifecycles.push({
          pmCode: pm.codigoPM,
          pmName: pm.nombrePM,
          estructuras: pm.estructuras || [],
          componente: f.componente,
          detalle: f.detalle,
          reportDate: validReport,
          resolvedDate: null
        });
      });

      pm.intervenciones.forEach((int) => {
        const iDate = int.fecha ? new Date(int.fecha) : today;
        const validResolved = !isNaN(iDate.getTime()) ? iDate : today;

        int.fallasCorregidas.forEach((fCorregida) => {
          failureLifecycles.push({
            pmCode: pm.codigoPM,
            pmName: pm.nombrePM,
            estructuras: pm.estructuras || [],
            componente: fCorregida.componente,
            detalle: fCorregida.detalle,
            reportDate: validResolved,
            resolvedDate: validResolved
          });
        });
      });
    });

    return months.map((m) => {
      let activeCountInMonth = 0;
      const fallasDelMesList: { codigoPM: string; nombrePM: string; estructuras: string[]; componente?: string; detalle?: string }[] = [];
      const arregladosDelMesList: { codigoPM: string; nombrePM: string; estructuras: string[]; componente?: string; detalle?: string }[] = [];

      failureLifecycles.forEach((f) => {
        if (f.reportDate >= m.startDate && f.reportDate < m.endDate) {
          fallasDelMesList.push({
            codigoPM: f.pmCode,
            nombrePM: f.pmName,
            estructuras: f.estructuras,
            componente: f.componente,
            detalle: f.detalle
          });
        }
      });

      pms.forEach((pm) => {
        pm.intervenciones.forEach((int) => {
          if (int.fecha) {
            const iDate = new Date(int.fecha);
            if (!isNaN(iDate.getTime()) && iDate >= m.startDate && iDate < m.endDate) {
              int.fallasCorregidas?.forEach((fCorregida) => {
                arregladosDelMesList.push({
                  codigoPM: pm.codigoPM,
                  nombrePM: pm.nombrePM,
                  estructuras: pm.estructuras || [],
                  componente: fCorregida.componente,
                  detalle: fCorregida.detalle
                });
              });
            }
          }
        });
      });

      failureLifecycles.forEach((f) => {
        const reportedBeforeOrInMonth = f.reportDate < m.endDate;
        const notResolvedYet = !f.resolvedDate || f.resolvedDate >= m.endDate;

        if (reportedBeforeOrInMonth && notResolvedYet) {
          activeCountInMonth++;
        }
      });

      return {
        name: m.label,
        "Fallas del Mes": fallasDelMesList.length,
        "Arreglados del Mes": arregladosDelMesList.length,
        "Balance Acumulado": activeCountInMonth,
        fallasDelMesList,
        arregladosDelMesList
      };
    });
  };

  const combinedChartData = getCombinedChartData();

  // Custom Popover Tooltip for Chart Hover (Sobrio y Conciso)
  const ChartCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const fallas = data.fallasDelMesList || [];

      return (
        <div 
          className="bg-white dark:bg-zinc-950/95 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-xl max-w-xs text-xs font-sans space-y-2 backdrop-blur-md cursor-pointer hover:border-amber-500/40 transition-all"
          onClick={() => setSelectedMonthModal(data)}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs">{label}</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono font-medium">
              {data["Fallas del Mes"]} falla{data["Fallas del Mes"] !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Resumen sobrio en una sola línea */}
          <div className="flex items-center justify-between text-[10px] text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-900/80 px-2 py-1 rounded-md font-mono">
            <span>Fallas: <strong className="text-red-600 dark:text-red-400">{data["Fallas del Mes"]}</strong></span>
            <span>Corregidos: <strong className="text-emerald-600 dark:text-emerald-400">{data["Arreglados del Mes"]}</strong></span>
            <span>Acumulado: <strong className="text-amber-600 dark:text-amber-400">{data["Balance Acumulado"]}</strong></span>
          </div>

          {/* Listado sobrio de puntos de medida */}
          <div className="space-y-1 pt-0.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-500 tracking-wider">
              Puntos con Falla:
            </p>
            {fallas.length === 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-zinc-500 italic">Sin fallas registradas</p>
            ) : (
              <div className="space-y-1">
                {fallas.slice(0, 3).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-200 dark:border-zinc-900/60 last:border-none">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 truncate max-w-[100px]">
                      {item.codigoPM}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[140px] text-right">
                      {item.nombrePM}
                    </span>
                  </div>
                ))}
                {fallas.length > 3 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold pt-1 text-center">
                    + {fallas.length - 3} punto(s) más. Haz clic para ver el listado completo.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* TOP HEADER ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-zinc-900/60 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              Tablero de Control Operativo
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium leading-normal">
              Resumen ejecutivo y monitoreo continuo del estado de la red eléctrica
            </p>
          </div>
        </div>

        <button
          onClick={() => generateExecutivePDFReport(
            pms, 
            baseData, 
            combinedChartData, 
            { thisWeekList, overdueList, notScheduledList, reprogrammedList }
          )}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95 cursor-pointer uppercase tracking-wider shrink-0"
          title="Descargar informe ejecutivo formal en formato PDF"
        >
          <Download className="w-4 h-4 text-zinc-950" />
          <span>Informe</span>
        </button>
      </div>
      
      {/* CORE STATS GRID (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* STAT 1: PMs IN FAILURE */}
        <div className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex items-center gap-4 hover:border-red-500/40 transition-all group">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Puntos en Falla</p>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{pmsInFailure}</span>
                <span className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 rounded-lg shadow-sm">
                  {affectedPercentage}%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                ({pmsInFailure} de {totalPMs} PMs)
              </span>
            </div>
          </div>
        </div>

        {/* STAT 2: PARA INSTALACIÓN */}
        <div className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex items-center gap-4 hover:border-blue-500/40 transition-all group">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform shrink-0">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Para Instalación</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{pmsInInstallation}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mt-1">
              Puntos pendientes por montaje
            </span>
          </div>
        </div>

        {/* STAT 3: PUNTOS REVISADOS */}
        <div className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex items-center gap-4 hover:border-purple-500/40 transition-all group">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shrink-0">
            <CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Puntos Revisados</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{pmsRevisados}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mt-1">
              Revisados (sin intervenir)
            </span>
          </div>
        </div>

        {/* STAT 3: AFFECTED STRUCTURES */}
        <div className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex flex-col justify-between gap-3 hover:border-amber-500/40 transition-all group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Estructuras Afectadas</p>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{totalAffectedStructures}</span>
                    <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg shadow-sm">
                      {structuresPercentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                    ({totalAffectedStructures} de {totalEstructurasCount})
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStructuresDropdown(!showStructuresDropdown)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 text-amber-600 dark:text-amber-400 text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
              title="Desplegar lista de estructuras afectadas"
            >
              <span className="text-[11px]">Ver Lista</span>
              {showStructuresDropdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Breakdown Pills by Type (PB, L, PT, etc.) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800/60">
            {Object.keys(typeCounts).length === 0 ? (
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium">Sin estructuras afectadas</span>
            ) : (
              Object.entries(typeCounts).map(([typeKey, count]) => (
                <span
                  key={typeKey}
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700/80 text-slate-700 dark:text-zinc-300 flex items-center gap-1"
                >
                  <span className="text-amber-600 dark:text-amber-400 font-black">{typeKey}:</span>
                  <span>{count}</span>
                </span>
              ))
            )}
          </div>
        </div>

      </div>

      {/* DROPDOWN PANEL FOR AFFECTED STRUCTURES */}
      {showStructuresDropdown && (
        <div className="bg-slate-50 dark:bg-zinc-900/50 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Listado de Estructuras Afectadas ({totalAffectedStructures})
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                Desglose de estructuras asociadas a puntos de medida no "Ok", clasificadas por tipo (PB, L, PT).
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedStructureTypeFilter("TODAS")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedStructureTypeFilter === "TODAS"
                    ? "bg-amber-500 text-zinc-950 shadow-md"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                Todas ({totalAffectedStructures})
              </button>
              {Object.entries(typeCounts).map(([typeKey, count]) => (
                <button
                  key={typeKey}
                  onClick={() => setSelectedStructureTypeFilter(typeKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedStructureTypeFilter === typeKey
                      ? "bg-amber-500 text-zinc-950 shadow-md"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {typeKey} ({count})
                </button>
              ))}
              <button
                onClick={() => setShowStructuresDropdown(false)}
                className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 font-bold underline ml-2 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>

          {/* LIST / GRID OF AFFECTED STRUCTURES */}
          {filteredStructuresList.length === 0 ? (
            <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500 font-medium">
              No hay estructuras afectadas registradas para el filtro seleccionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStructuresList.map((item) => (
                <div
                  key={item.code}
                  className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-2 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      {item.code}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                      Tipo: {item.type}
                    </span>
                  </div>

                  {(item.zone || item.level) && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                      {item.zone && <span>Zona: {item.zone}</span>}
                      {item.level && <span>• Nivel: {item.level}</span>}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-900 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-500">
                      PMs Afectados ({item.pms.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {item.pms.length === 0 ? (
                        <span className="text-[10px] text-slate-600 dark:text-zinc-600">Sin PM activo asignado</span>
                      ) : (
                        item.pms.map((pmCode) => (
                          <span
                            key={pmCode}
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded"
                          >
                            {pmCode}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROGRAMACIÓN Y SEGUIMIENTO DE INTERVENCIONES */}
      <div className="bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="border-b border-slate-200 dark:border-zinc-800/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Estado de Programación de Intervenciones
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
              Seguimiento de mantenimiento preventivo y correctivo según fechas agendadas.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg self-start sm:self-auto">
            {totalPendingPMs} Medidas Pendientes
          </span>
        </div>

        {/* 4 INTERACTIVE CATEGORY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* CATEGORY 1: PROGRAMADOS ESTA SEMANA */}
          <button
            onClick={() => setExpandedCategory(expandedCategory === "thisWeek" ? null : "thisWeek")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              expandedCategory === "thisWeek"
                ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
                : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Programados esta Semana</span>
              </div>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{thisWeekList.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              <span>Agendados lunes a domingo</span>
              <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                Ver Lista {expandedCategory === "thisWeek" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </div>
          </button>

          {/* CATEGORY 2: VENCIDOS / NO INTERVENIDOS */}
          <button
            onClick={() => setExpandedCategory(expandedCategory === "overdue" ? null : "overdue")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              expandedCategory === "overdue"
                ? "bg-red-500/10 border-red-500/40 ring-1 ring-red-500/30"
                : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Programados Vencidos</span>
              </div>
              <span className="text-lg font-black text-red-600 dark:text-red-400">{overdueList.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              <span>Fecha superada sin intervenir</span>
              <span className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                Ver Lista {expandedCategory === "overdue" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </div>
          </button>

          {/* CATEGORY 3: SIN PROGRAMAR AÚN */}
          <button
            onClick={() => setExpandedCategory(expandedCategory === "notScheduled" ? null : "notScheduled")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              expandedCategory === "notScheduled"
                ? "bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30"
                : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <CalendarX className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Sin Programar Aún</span>
              </div>
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">{notScheduledList.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              <span>Sin fecha definida de atención</span>
              <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                Ver Lista {expandedCategory === "notScheduled" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </div>
          </button>

          {/* CATEGORY 4: INTERVENCIONES REPROGRAMADAS */}
          <button
            onClick={() => setExpandedCategory(expandedCategory === "reprogrammed" ? null : "reprogrammed")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              expandedCategory === "reprogrammed"
                ? "bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30"
                : "bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Intervenciones Reprogramadas</span>
              </div>
              <span className="text-lg font-black text-purple-600 dark:text-purple-400">{reprogrammedList.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              <span>Reagendadas posteriormente</span>
              <span className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                Ver Lista {expandedCategory === "reprogrammed" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </div>
          </button>

        </div>

        {/* EXPANDABLE PM DETAILS LIST */}
        {expandedCategory && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                {expandedCategory === "thisWeek" && <span className="text-emerald-600 dark:text-emerald-400">Puntos de Medida Programados para esta Semana ({thisWeekList.length})</span>}
                {expandedCategory === "overdue" && <span className="text-red-600 dark:text-red-400">Puntos de Medida Programados Vencidos sin Intervención ({overdueList.length})</span>}
                {expandedCategory === "notScheduled" && <span className="text-blue-600 dark:text-blue-400">Puntos de Medida Afectados sin Fecha Programada ({notScheduledList.length})</span>}
                {expandedCategory === "reprogrammed" && <span className="text-purple-600 dark:text-purple-400">Puntos de Medida con Intervenciones Reprogramadas ({reprogrammedList.length})</span>}
              </h4>
              <button 
                onClick={() => setExpandedCategory(null)}
                className="text-[11px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 font-bold underline cursor-pointer"
              >
                Cerrar lista
              </button>
            </div>

            {/* EXPANDED ITEMS */}
            {expandedCategory === "thisWeek" && (
              thisWeekList.length === 0 ? (
                <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500 font-medium">
                  No hay puntos de medida programados para la semana actual.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {thisWeekList.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">{item.pm.codigoPM}</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{item.pm.nombrePM}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">{item.failureDetail}</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Programado: {item.dateStr}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigate("directorio")}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Atender
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {expandedCategory === "overdue" && (
              overdueList.length === 0 ? (
                <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500 font-medium">
                  Excelente: No hay puntos con fecha de intervención vencida.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {overdueList.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-zinc-950 border border-red-500/20 rounded-xl flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-red-600 dark:text-red-400">{item.pm.codigoPM}</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{item.pm.nombrePM}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">{item.failureDetail}</p>
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Vencido desde: {item.dateStr}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigate("directorio")}
                        className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 border border-red-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3 text-red-600 dark:text-red-400" />
                        Intervenir
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {expandedCategory === "notScheduled" && (
              notScheduledList.length === 0 ? (
                <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500 font-medium">
                  Todos los puntos de medida activos tienen fecha de intervención programada.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {notScheduledList.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{item.pm.codigoPM}</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{item.pm.nombrePM}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">{item.failureDetail}</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold">Sin fecha asignada ("Sin definir")</p>
                      </div>
                      <button
                        onClick={() => onNavigate("directorio")}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        Ver en PMs
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {expandedCategory === "reprogrammed" && (
              reprogrammedList.length === 0 ? (
                <div className="p-4 bg-white dark:bg-zinc-950 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500 font-medium">
                  No hay intervenciones reprogramadas en el sistema.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {reprogrammedList.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-zinc-950 border border-purple-500/20 rounded-xl flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400">{item.pm.codigoPM}</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{item.pm.nombrePM}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300">
                            {item.vecesReprogramada} {item.vecesReprogramada === 1 ? "reprogramación" : "reprogramaciones"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">{item.failureDetail}</p>
                        <p className="text-[10px] text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1">
                          <RotateCcw className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Reagendada para: {item.dateStr}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigate("directorio")}
                        className="px-2.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        Atender
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

          </div>
        )}

      </div>

      {/* CONSOLIDATED TRACEABILITY CHART */}
      <div className="bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-zinc-800/60 pb-4 gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Trazabilidad Acumulada de Daños / Fallas por Mes
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
              Integración de fallas registradas, reparaciones realizadas y balance acumulativo mensual en la red de medida.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
              {pmsInFailure} Fallas Activas
            </span>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {totalPendingPMs} Medidas en Seguimiento
            </span>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={combinedChartData}
              margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length) {
                  setSelectedMonthModal(state.activePayload[0].payload);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#71717a" 
                fontSize={11} 
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
              />
              <YAxis 
                stroke="#71717a" 
                fontSize={11} 
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                allowDecimals={false}
              />
              <Tooltip 
                content={<ChartCustomTooltip />} 
                wrapperStyle={{ pointerEvents: 'auto', outline: 'none' }}
                isAnimationActive={false}
              />
              <Legend 
                wrapperStyle={{ paddingTop: "15px" }}
                formatter={(value) => <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{value}</span>}
              />
              <Bar 
                dataKey="Fallas del Mes" 
                fill="#ef4444" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={30}
                className="cursor-pointer"
              />
              <Bar 
                dataKey="Arreglados del Mes" 
                fill="#10b981" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={30}
                className="cursor-pointer"
              />
              <Line 
                type="monotone" 
                dataKey="Balance Acumulado" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#09090b" }}
                activeDot={{ r: 7 }}
                className="cursor-pointer"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MODAL / VENTANA EMERGENTE DE DETALLE COMPLETO DEL MES */}
      {selectedMonthModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedMonthModal(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Detalle de Fallas - {selectedMonthModal.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                  Relación de puntos de medida que presentaron falla en este periodo.
                </p>
              </div>
              <button
                onClick={() => setSelectedMonthModal(null)}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen de Métricas */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-red-600 dark:text-red-400">
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase">Fallas del Mes</div>
                <div className="text-lg font-black mt-0.5">{selectedMonthModal["Fallas del Mes"]}</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-emerald-600 dark:text-emerald-400">
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase">Corregidos</div>
                <div className="text-lg font-black mt-0.5">{selectedMonthModal["Arreglados del Mes"]}</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-amber-600 dark:text-amber-400">
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase">Acumulado</div>
                <div className="text-lg font-black mt-0.5">{selectedMonthModal["Balance Acumulado"]}</div>
              </div>
            </div>

            {/* LISTA COMPLETA SCROLLABLE SOBERANA */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 pt-1">
              <h4 className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                Puntos de Medida Afectados ({selectedMonthModal.fallasDelMesList?.length || 0})
              </h4>

              {(!selectedMonthModal.fallasDelMesList || selectedMonthModal.fallasDelMesList.length === 0) ? (
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl text-center text-xs text-slate-500 dark:text-zinc-500">
                  No se registraron fallas en este periodo.
                </div>
              ) : (
                selectedMonthModal.fallasDelMesList.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-1 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        {item.codigoPM}
                      </span>
                      {item.estructuras && item.estructuras.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 px-2 py-0.5 rounded-md">
                          {item.estructuras.join(", ")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.nombrePM}</p>
                    {(item.componente || item.detalle) && (
                      <p className="text-xs text-red-700 dark:text-red-300/90 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg mt-1 font-medium">
                        {item.componente ? `${item.componente}: ` : ""}{item.detalle}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedMonthModal(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


