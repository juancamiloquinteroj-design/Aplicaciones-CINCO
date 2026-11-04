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
  ChevronDown,
  ChevronUp,
  Wrench,
  ArrowRight,
  AlertCircle,
  X,
  FileText,
  Download,
  FileSpreadsheet,
  CheckCircle,
  CheckCircle2,
  User,
  Search
} from "lucide-react";
import { PM, Estructura, PMBase, RelacionTransformacion } from "../types";
import { generateExecutivePDFReport, exportUnifiedPMsToExcel } from "../lib/exportUtils";
import { getStructureType, VALID_STRUCTURE_TYPES, ValidStructureType, STRUCTURE_TYPE_LABELS } from "../lib/structureUtils";

interface DashboardProps {
  pms: PM[];
  baseData?: {
    estructuras: Record<string, Estructura>;
    pms: Record<string, PMBase>;
    relaciones?: Record<string, RelacionTransformacion>;
  };
  onNavigate: (tab: "inicio" | "directorio" | "registrar" | "historial" | "configuracion") => void;
}

export default function Dashboard({ pms, baseData, onNavigate }: DashboardProps) {
  // Expandable dropdown state for affected structures
  const [showStructuresDropdown, setShowStructuresDropdown] = useState(false);
  const [selectedStructureTypeFilter, setSelectedStructureTypeFilter] = useState<string>("TODAS");

  // Selected month state for modal full view
  const [selectedMonthModal, setSelectedMonthModal] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<"fallas" | "seguimiento" | "corregidos">("fallas");
  const [modalSearchTerm, setModalSearchTerm] = useState("");

  // 1. PMs in failure (strictly En falla, excluding Seguimiento as it has its own dedicated KPI)
  const pmsInSeguimiento = pms.filter(pm => pm.estadoGral === "Seguimiento").length;
  const pmsInFailure = pms.filter(pm => pm.estadoGral === "En falla" || (pm.estadoGral as string) === "Para Revisión").length;

  // 2. PMs in installation
  const pmsInInstallation = pms.filter(pm => pm.estadoGral === "Instalación").length;

  // 3. PMs revised (not intervened / pending)
  const pmsRevisados = pms.filter(pm => pm.estadoGral !== "Ok" && (pm.revisado || pm.estadoGral === "Revisado")).length;

  // 3. Affected unique structures (strictly valid types: PB, L, CTO, PT)
  const affectedStructures = new Set<string>();
  pms.forEach(pm => {
    if (pm.estadoGral !== "Ok") {
      pm.estructuras?.forEach(est => {
        if (!est || !est.trim()) return;
        const type = getStructureType(est, baseData?.estructuras?.[est]);
        if (type) {
          affectedStructures.add(est);
        }
      });
    }
  });
  const totalAffectedStructures = affectedStructures.size;

  // Structure type breakdown calculations (strictly PB, L, CTO, PT)
  const affectedStructuresByType: Record<ValidStructureType, { code: string; zone?: string; level?: string; pms: string[] }[]> = {
    PB: [],
    L: [],
    CTO: [],
    PT: []
  };
  const typeCounts: Record<ValidStructureType, number> = {
    PB: 0,
    L: 0,
    CTO: 0,
    PT: 0
  };

  affectedStructures.forEach((estCode) => {
    const estObj = baseData?.estructuras?.[estCode];
    const type = getStructureType(estCode, estObj);
    if (!type) return;

    const associatedPMs = pms
      .filter(pm => pm.estadoGral !== "Ok" && pm.estructuras?.includes(estCode))
      .map(pm => pm.codigoPM);

    affectedStructuresByType[type].push({
      code: estCode,
      zone: estObj?.zona,
      level: estObj?.nivel,
      pms: associatedPMs
    });

    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  // Flatten structures for dropdown list (only PB, L, CTO, PT)
  const allAffectedStructuresList: { code: string; type: ValidStructureType; zone?: string; level?: string; pms: string[] }[] = [];
  VALID_STRUCTURE_TYPES.forEach((type) => {
    affectedStructuresByType[type].forEach(item => {
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
  const failurePercentage = totalPMs > 0 ? ((pmsInFailure / totalPMs) * 100).toFixed(1) : "0.0";
  const affectedPercentage = totalPMs > 0 ? ((totalPendingPMs / totalPMs) * 100).toFixed(1) : "0.0";

  // Total Structures & Percentage
  const totalEstructurasCount = baseData?.estructuras ? Object.keys(baseData.estructuras).length : 0;
  const structuresPercentage = totalEstructurasCount > 0 ? ((totalAffectedStructures / totalEstructurasCount) * 100).toFixed(1) : "0.0";

  // Calculate combined monthly trace
  const getCombinedChartData = () => {
    const monthNames = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];
    
    // Helper to safely parse dates in local timezone without UTC offset shifts
    const parseLocalDate = (dateVal: string | Date | undefined | null): Date => {
      if (!dateVal) return new Date();
      if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? new Date() : dateVal;
      if (typeof dateVal === "string") {
        const trimmed = dateVal.trim();
        const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const day = parseInt(match[3], 10);
          return new Date(year, month, day, 12, 0, 0);
        }
      }
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? new Date() : d;
    };

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
      prioridad?: string;
      observaciones?: string;
      fechaReporteStr?: string;
      reportDate: Date;
      resolvedDate: Date | null;
      totalFallasActivas?: number;
      fallas?: any[];
    }

    const failureLifecycles: FailureLifecycle[] = [];

    // 1. Puntos de Medida con fallas activas actualmente (Puntos en Falla)
    const activeFailurePMs = pms.filter(
      (pm) => pm.estadoGral === "En falla" || (pm.estadoGral as string) === "Para Revisión"
    );

    activeFailurePMs.forEach((pm) => {
      const activeFails = pm.activeFailures || [];
      const compSummary = activeFails.map((f) => f.componente).filter(Boolean).join(", ") || "Falla Operativa";
      const detailSummary = activeFails.map((f) => f.detalle).filter(Boolean).join(" | ") || "Pendiente de atención";
      const obsSummary = activeFails.map((f) => f.observaciones).filter(Boolean).join(" | ");
      const isAlta = pm.prioridad === "Alta" || activeFails.some((f) => f.prioridad === "Alta");

      const repDateStr = activeFails[0]?.fechaReporte || pm.updatedAt || pm.createdAt;
      const rDate = parseLocalDate(repDateStr);
      const validReport = !isNaN(rDate.getTime()) ? rDate : today;

      failureLifecycles.push({
        pmCode: pm.codigoPM,
        pmName: pm.nombrePM,
        estructuras: pm.estructuras || [],
        componente: compSummary,
        detalle: detailSummary,
        prioridad: isAlta ? "Alta" : "Normal",
        observaciones: obsSummary,
        fechaReporteStr: activeFails[0]?.fechaReporte || (repDateStr ? String(repDateStr).slice(0, 10) : ""),
        reportDate: validReport,
        resolvedDate: null,
        totalFallasActivas: activeFails.length || 1,
        fallas: activeFails
      });
    });

    // 2. Trazabilidad de fallas corregidas en intervenciones históricas
    pms.forEach((pm) => {
      pm.intervenciones.forEach((int) => {
        if (!int.fecha) return;
        const iDate = parseLocalDate(int.fecha);
        const validResolved = !isNaN(iDate.getTime()) ? iDate : today;

        if (int.fallasCorregidas && int.fallasCorregidas.length > 0) {
          const compSummary = int.fallasCorregidas.map((f) => f.componente).filter(Boolean).join(", ") || "Falla Corregida";
          const detailSummary = int.fallasCorregidas.map((f) => f.detalle).filter(Boolean).join(" | ") || int.descripcion || "Corregido";
          const isAlta = int.fallasCorregidas.some((f) => f.prioridad === "Alta");

          const repDateStr = int.fallasCorregidas[0]?.fechaReporte;
          if (repDateStr) {
            const rDate = parseLocalDate(repDateStr);
            if (!isNaN(rDate.getTime()) && rDate < validResolved) {
              failureLifecycles.push({
                pmCode: pm.codigoPM,
                pmName: pm.nombrePM,
                estructuras: pm.estructuras || [],
                componente: compSummary,
                detalle: detailSummary,
                prioridad: isAlta ? "Alta" : "Normal",
                observaciones: int.descripcion,
                fechaReporteStr: repDateStr,
                reportDate: rDate,
                resolvedDate: validResolved,
                totalFallasActivas: int.fallasCorregidas.length,
                fallas: int.fallasCorregidas
              });
            }
          }
        }
      });
    });

    return months.map((m, mIdx) => {
      const isCurrentMonth = mIdx === months.length - 1;
      let activeCountInMonth = 0;
      const fallasDelMesList: { 
        codigoPM: string; 
        nombrePM: string; 
        estructuras: string[]; 
        componente?: string; 
        detalle?: string; 
        prioridad?: string; 
        observaciones?: string; 
        fechaReporteStr?: string;
        totalFallasActivas?: number;
        fallas?: any[];
      }[] = [];

      const arregladosDelMesList: { 
        id: string;
        codigoPM: string; 
        nombrePM: string; 
        estructuras: string[]; 
        tecnico: string;
        fecha: string;
        descripcion: string;
        fallasCorregidas: {
          componente?: string;
          detalle?: string;
          prioridad?: string;
          observaciones?: string;
        }[];
        totalFallasCorregidas: number;
      }[] = [];

      if (isCurrentMonth) {
        // En el mes actual, la cantidad de puntos en falla coincide exactamente con los PMs con falla activa (KPI Puntos en Falla)
        activeFailurePMs.forEach((pm) => {
          const activeFails = pm.activeFailures || [];
          const compSummary = activeFails.map((f) => f.componente).filter(Boolean).join(", ") || "Falla Operativa";
          const detailSummary = activeFails.map((f) => f.detalle).filter(Boolean).join(" | ") || "Pendiente de atención";
          const isAlta = pm.prioridad === "Alta" || activeFails.some((f) => f.prioridad === "Alta");
          const repDateStr = activeFails[0]?.fechaReporte || pm.updatedAt || pm.createdAt;

          fallasDelMesList.push({
            codigoPM: pm.codigoPM,
            nombrePM: pm.nombrePM,
            estructuras: pm.estructuras || [],
            componente: compSummary,
            detalle: detailSummary,
            prioridad: isAlta ? "Alta" : "Normal",
            observaciones: activeFails.map((f) => f.observaciones).filter(Boolean).join(" | "),
            fechaReporteStr: activeFails[0]?.fechaReporte || (repDateStr ? String(repDateStr).slice(0, 10) : ""),
            totalFallasActivas: activeFails.length || 1,
            fallas: activeFails
          });
        });
      } else {
        failureLifecycles.forEach((f) => {
          if (f.reportDate >= m.startDate && f.reportDate < m.endDate) {
            fallasDelMesList.push({
              codigoPM: f.pmCode,
              nombrePM: f.pmName,
              estructuras: f.estructuras,
              componente: f.componente,
              detalle: f.detalle,
              prioridad: f.prioridad,
              observaciones: f.observaciones,
              fechaReporteStr: f.fechaReporteStr || f.reportDate.toISOString().split("T")[0],
              totalFallasActivas: f.totalFallasActivas || 1,
              fallas: f.fallas || []
            });
          }
        });
      }

      // Agrupar intervenciones realizadas en el mes
      pms.forEach((pm) => {
        pm.intervenciones.forEach((int) => {
          if (int.fecha) {
            const iDate = parseLocalDate(int.fecha);
            if (!isNaN(iDate.getTime()) && iDate >= m.startDate && iDate < m.endDate) {
              const fallas = (int.fallasCorregidas || []).map((f) => ({
                componente: f.componente,
                detalle: f.detalle,
                prioridad: f.prioridad,
                observaciones: f.observaciones
              }));

              arregladosDelMesList.push({
                id: int.id,
                codigoPM: pm.codigoPM,
                nombrePM: pm.nombrePM,
                estructuras: pm.estructuras || [],
                tecnico: int.tecnico,
                fecha: int.fecha,
                descripcion: int.descripcion,
                fallasCorregidas: fallas,
                totalFallasCorregidas: fallas.length
              });
            }
          }
        });
      });

      // Agrupar puntos en seguimiento
      const seguimientoDelMesList: {
        codigoPM: string;
        nombrePM: string;
        estructuras: string[];
        loQueQuedoPendiente?: string;
        fallas?: any[];
      }[] = [];

      if (isCurrentMonth) {
        pms.filter((pm) => pm.estadoGral === "Seguimiento").forEach((pm) => {
          seguimientoDelMesList.push({
            codigoPM: pm.codigoPM,
            nombrePM: pm.nombrePM,
            estructuras: pm.estructuras || [],
            loQueQuedoPendiente: pm.loQueQuedoPendiente || pm.ultimoReporteTecnico?.loQueQuedoPendiente || "En seguimiento con tareas pendientes",
            fallas: pm.activeFailures || []
          });
        });
      } else {
        const seenPMs = new Set<string>();
        pms.forEach((pm) => {
          pm.intervenciones.forEach((int) => {
            if (int.fecha && int.resultado === "Seguimiento") {
              const iDate = parseLocalDate(int.fecha);
              if (!isNaN(iDate.getTime()) && iDate >= m.startDate && iDate < m.endDate && !seenPMs.has(pm.codigoPM)) {
                seenPMs.add(pm.codigoPM);
                seguimientoDelMesList.push({
                  codigoPM: pm.codigoPM,
                  nombrePM: pm.nombrePM,
                  estructuras: pm.estructuras || [],
                  loQueQuedoPendiente: int.loQueQuedoPendiente || int.descripcion || "En seguimiento",
                  fallas: int.fallasPendientes || []
                });
              }
            }
          });
        });
      }

      if (isCurrentMonth) {
        activeCountInMonth = activeFailurePMs.length;
      } else {
        failureLifecycles.forEach((f) => {
          const reportedBeforeOrInMonth = f.reportDate < m.endDate;
          const notResolvedYet = !f.resolvedDate || f.resolvedDate >= m.endDate;

          if (reportedBeforeOrInMonth && notResolvedYet) {
            activeCountInMonth++;
          }
        });
      }

      return {
        name: m.label,
        "Fallas del Mes": fallasDelMesList.length,
        "En Seguimiento": seguimientoDelMesList.length,
        "Arreglados del Mes": arregladosDelMesList.length,
        "Balance Acumulado": activeCountInMonth,
        fallasDelMesList,
        seguimientoDelMesList,
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
      const arreglados = data.arregladosDelMesList || [];

      return (
        <div 
          className="bg-white dark:bg-zinc-950/95 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xl max-w-xs text-xs font-sans space-y-2.5 backdrop-blur-md hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs">{label}</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono font-medium">
              {data["Fallas del Mes"]} falla | {data["En Seguimiento"] || 0} seg. | {data["Arreglados del Mes"]} corr.
            </span>
          </div>

          {/* Resumen interactivo con botones rápidos que dirigen a la pestaña respectiva */}
          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMonthModal(data);
                setModalTab("fallas");
                setModalSearchTerm("");
              }}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 p-1 rounded-lg text-center transition-all cursor-pointer group"
              title="Click para abrir modal en pestaña de Puntos en Falla"
            >
              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] group-hover:text-red-700 dark:group-hover:text-red-300">Falla</span>
              <strong className="text-red-600 dark:text-red-400 font-bold text-xs">{data["Fallas del Mes"]}</strong>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMonthModal(data);
                setModalTab("seguimiento");
                setModalSearchTerm("");
              }}
              className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 p-1 rounded-lg text-center transition-all cursor-pointer group"
              title="Click para abrir modal en pestaña de En Seguimiento"
            >
              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] group-hover:text-amber-700 dark:group-hover:text-amber-300">Seg.</span>
              <strong className="text-amber-600 dark:text-amber-400 font-bold text-xs">{data["En Seguimiento"] || 0}</strong>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMonthModal(data);
                setModalTab("corregidos");
                setModalSearchTerm("");
              }}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 p-1 rounded-lg text-center transition-all cursor-pointer group"
              title="Click para abrir modal en pestaña de Corregidos"
            >
              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] group-hover:text-emerald-300">Corr.</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">{data["Arreglados del Mes"]}</strong>
            </button>

            <div className="bg-sky-500/10 border border-sky-500/20 p-1 rounded-lg text-center">
              <span className="text-slate-500 dark:text-zinc-400 block text-[9px]">Acum.</span>
              <strong className="text-sky-400 font-bold text-xs">{data["Balance Acumulado"]}</strong>
            </div>
          </div>

          {/* Previsualización rápida de fallas y reparaciones */}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-500 tracking-wider">
              <span>Vista Rápida:</span>
              <span className="text-slate-500 dark:text-zinc-400 font-medium lowercase font-mono">
                {fallas.length} en falla • {arreglados.length} corr.
              </span>
            </div>

            {fallas.length === 0 && arreglados.length === 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-zinc-500 italic">Sin novedades en este mes</p>
            ) : (
              <div className="space-y-1">
                {fallas.slice(0, 2).map((item: any, idx: number) => (
                  <div key={`f-${idx}`} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-200 dark:border-zinc-900/60 last:border-none">
                    <span className="font-mono font-bold text-red-600 dark:text-red-400 truncate max-w-[95px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      {item.codigoPM}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[135px] text-right">
                      {item.componente || item.nombrePM}
                    </span>
                  </div>
                ))}
                {arreglados.slice(0, 2).map((item: any, idx: number) => {
                  const compLabel = item.fallasCorregidas && item.fallasCorregidas[0]?.componente
                    ? `${item.fallasCorregidas[0].componente}${item.fallasCorregidas.length > 1 ? ` (+${item.fallasCorregidas.length - 1})` : ""}`
                    : (item.tecnico || item.nombrePM);
                  return (
                    <div key={`c-${idx}`} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-200 dark:border-zinc-900/60 last:border-none">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[95px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        {item.codigoPM}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[135px] text-right">
                        {compLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón de acción destacado */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMonthModal(data);
              setModalTab("fallas");
              setModalSearchTerm("");
            }}
            className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <span>Navegar Fallas y Corregidos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => exportUnifiedPMsToExcel(
              pms,
              baseData?.relaciones || {}
            )}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-950/20 hover:shadow-emerald-950/30 active:scale-95 cursor-pointer uppercase tracking-wider shrink-0"
            title="Descargar reporte general de puntos de medida en formato Excel con hojas de Pendientes y En Seguimiento (.xlsx)"
          >
            <Download className="w-4 h-4 text-white" />
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => generateExecutivePDFReport(
              pms, 
              baseData, 
              combinedChartData
            )}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95 cursor-pointer uppercase tracking-wider shrink-0"
            title="Descargar informe ejecutivo formal en formato PDF"
          >
            <Download className="w-4 h-4 text-zinc-950" />
            <span>Informe</span>
          </button>
        </div>
      </div>
      
      {/* CORE STATS GRID (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* STAT 1: PMs IN FAILURE */}
        <div 
          onClick={() => onNavigate("directorio")}
          className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex items-center gap-4 hover:border-red-500/50 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-all cursor-pointer group"
          title="Ver puntos en falla en el Directorio de Pendientes"
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Puntos en Falla</p>
              <span className="text-[10px] text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Ver →</span>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{pmsInFailure}</span>
                <span className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 rounded-lg shadow-sm">
                  {failurePercentage}%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                ({pmsInFailure} de {totalPMs} PMs)
              </span>
            </div>
          </div>
        </div>

        {/* STAT 2: PARA INSTALACIÓN */}
        <div 
          onClick={() => onNavigate("directorio")}
          className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex items-center gap-4 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-all cursor-pointer group"
          title="Ver puntos de instalación en el Directorio de Pendientes"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform shrink-0">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Para Instalación</p>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Ver →</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{pmsInInstallation}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mt-1">
              Puntos pendientes por montaje
            </span>
          </div>
        </div>

        {/* STAT 3: PUNTOS EN SEGUIMIENTO */}
        <div 
          onClick={() => onNavigate("directorio")}
          className="bg-slate-50 dark:bg-zinc-900/40 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-xl p-4.5 shadow-lg flex items-center gap-4 hover:border-amber-500/50 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-all cursor-pointer group ring-1 ring-transparent hover:ring-amber-500/20"
          title="Ver puntos en seguimiento en el Directorio de Pendientes"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shrink-0">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-extrabold">Puntos en Seguimiento</p>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Ver directorio →</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-zinc-100">{pmsInSeguimiento}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block mt-1">
              Intervenidos con tareas pendientes
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

          {/* Breakdown Pills by Type (Strictly PB, L, CTO, PT) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800/60">
            {VALID_STRUCTURE_TYPES.filter(t => typeCounts[t] > 0).length === 0 ? (
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium">Sin estructuras afectadas</span>
            ) : (
              VALID_STRUCTURE_TYPES.filter(t => typeCounts[t] > 0).map((typeKey) => (
                <span
                  key={typeKey}
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700/80 text-slate-700 dark:text-zinc-300 flex items-center gap-1"
                  title={`${typeKey} (${STRUCTURE_TYPE_LABELS[typeKey]}): ${typeCounts[typeKey]} afectadas`}
                >
                  <span className="text-amber-600 dark:text-amber-400 font-black">{typeKey}:</span>
                  <span>{typeCounts[typeKey]}</span>
                  <span className="text-slate-500 dark:text-zinc-500 font-sans text-[9px] hidden sm:inline">({STRUCTURE_TYPE_LABELS[typeKey]})</span>
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
                Desglose de estructuras asociadas a puntos de medida no "Ok", clasificadas por tipo (PB, L, CTO, PT).
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
              {VALID_STRUCTURE_TYPES.filter(t => typeCounts[t] > 0).map((typeKey) => (
                <button
                  key={typeKey}
                  onClick={() => setSelectedStructureTypeFilter(typeKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedStructureTypeFilter === typeKey
                      ? "bg-amber-500 text-zinc-950 shadow-md"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
                  title={`${typeKey}: ${STRUCTURE_TYPE_LABELS[typeKey]}`}
                >
                  {typeKey} ({STRUCTURE_TYPE_LABELS[typeKey]}) ({typeCounts[typeKey]})
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
                    <span 
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
                      title={`${item.type}: ${STRUCTURE_TYPE_LABELS[item.type as ValidStructureType] || item.type}`}
                    >
                      {item.type} • {STRUCTURE_TYPE_LABELS[item.type as ValidStructureType] || item.type}
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
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={combinedChartData}
              margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
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
                name="Puntos en Falla"
                fill="#ef4444" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={28}
                className="cursor-pointer"
                onClick={(entry: any) => {
                  if (entry && entry.payload) {
                    setSelectedMonthModal(entry.payload);
                    setModalTab("fallas");
                    setModalSearchTerm("");
                  }
                }}
              />
              <Bar 
                dataKey="En Seguimiento" 
                name="En Seguimiento"
                fill="#f59e0b" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={28}
                className="cursor-pointer"
                onClick={(entry: any) => {
                  if (entry && entry.payload) {
                    setSelectedMonthModal(entry.payload);
                    setModalTab("seguimiento");
                    setModalSearchTerm("");
                  }
                }}
              />
              <Bar 
                dataKey="Arreglados del Mes" 
                name="Intervenciones Corregidas"
                fill="#10b981" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={28}
                className="cursor-pointer"
                onClick={(entry: any) => {
                  if (entry && entry.payload) {
                    setSelectedMonthModal(entry.payload);
                    setModalTab("corregidos");
                    setModalSearchTerm("");
                  }
                }}
              />
              <Line 
                type="monotone" 
                dataKey="Balance Acumulado" 
                name="Balance Acumulado"
                stroke="#38bdf8" 
                strokeWidth={3}
                dot={{ r: 4, fill: "#38bdf8", strokeWidth: 2, stroke: "#09090b" }}
                activeDot={{ r: 6 }}
                className="cursor-pointer"
                onClick={(entry: any) => {
                  if (entry && entry.payload) {
                    setSelectedMonthModal(entry.payload);
                    setModalTab("fallas");
                    setModalSearchTerm("");
                  }
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MODAL / VENTANA EMERGENTE DE DETALLE COMPLETO DEL MES */}
      {selectedMonthModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelectedMonthModal(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl p-5 shadow-2xl space-y-4 max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ENCABEZADO DEL MODAL */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                  <span>Detalle Mensual de Puntos de Medida — {selectedMonthModal.name}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                  Navegación detallada de fallas registradas y reparaciones ejecutadas en este periodo.
                </p>
              </div>
              <button
                onClick={() => setSelectedMonthModal(null)}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-all cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TARJETAS DE MÉTRICAS INTERACTIVAS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
              <button
                type="button"
                onClick={() => setModalTab("fallas")}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                  modalTab === "fallas"
                    ? "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300 shadow-md ring-1 ring-red-500/40"
                    : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/15"
                }`}
                title="Ver listado de fallas del mes"
              >
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase flex items-center justify-between">
                  <span>En Falla</span>
                  {modalTab === "fallas" && (
                    <span className="text-[9px] bg-red-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">
                      Viendo
                    </span>
                  )}
                </div>
                <div className="text-xl font-black mt-1">{selectedMonthModal["Fallas del Mes"]}</div>
                <div className="text-[10px] font-sans text-slate-500 dark:text-zinc-400 mt-0.5">Click para ver</div>
              </button>

              <button
                type="button"
                onClick={() => setModalTab("seguimiento")}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                  modalTab === "seguimiento"
                    ? "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 shadow-md ring-1 ring-amber-500/40"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
                }`}
                title="Ver listado de puntos en seguimiento"
              >
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase flex items-center justify-between">
                  <span>En Seguimiento</span>
                  {modalTab === "seguimiento" && (
                    <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">
                      Viendo
                    </span>
                  )}
                </div>
                <div className="text-xl font-black mt-1">{selectedMonthModal["En Seguimiento"] || 0}</div>
                <div className="text-[10px] font-sans text-slate-500 dark:text-zinc-400 mt-0.5">Click para ver</div>
              </button>

              <button
                type="button"
                onClick={() => setModalTab("corregidos")}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                  modalTab === "corregidos"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/40"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                }`}
                title="Ver listado de puntos corregidos"
              >
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase flex items-center justify-between">
                  <span>Corregidos</span>
                  {modalTab === "corregidos" && (
                    <span className="text-[9px] bg-emerald-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">
                      Viendo
                    </span>
                  )}
                </div>
                <div className="text-xl font-black mt-1">{selectedMonthModal["Arreglados del Mes"]}</div>
                <div className="text-[10px] font-sans text-slate-500 dark:text-zinc-400 mt-0.5">Click para ver</div>
              </button>

              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 text-sky-400 text-left">
                <div className="text-[10px] font-sans font-extrabold text-slate-500 dark:text-zinc-400 uppercase">Acumulado</div>
                <div className="text-xl font-black mt-1">{selectedMonthModal["Balance Acumulado"]}</div>
                <div className="text-[10px] font-sans text-slate-500 dark:text-zinc-400 mt-0.5">Balance mensual</div>
              </div>
            </div>

            {/* SELECTOR DE PESTAÑAS Y BUSCADOR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1.5 border-t border-slate-200 dark:border-zinc-800/80">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalTab("fallas")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalTab === "fallas"
                      ? "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30 shadow-sm"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>En Falla ({selectedMonthModal.fallasDelMesList?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab("seguimiento")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalTab === "seguimiento"
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-sm"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>En Seguimiento ({selectedMonthModal.seguimientoDelMesList?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab("corregidos")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalTab === "corregidos"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Corregidos ({selectedMonthModal.arregladosDelMesList?.length || 0})</span>
                </button>
              </div>

              {/* BUSCADOR DENTRO DEL MODAL */}
              <div className="relative flex-1 sm:max-w-xs">
                <input
                  type="text"
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  placeholder="Filtrar por código, nombre, detalle..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" />
                {modalSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setModalSearchTerm("")}
                    className="absolute right-2 top-1.5 text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 text-xs px-1 cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* LISTA SCROLLABLE SEGÚN PESTAÑA SELECCIONADA */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pt-1 min-h-[220px]">
              {modalTab === "fallas" ? (
                // PESTAÑA: FALLAS DEL MES
                (() => {
                  const q = modalSearchTerm.toLowerCase();
                  const list = (selectedMonthModal.fallasDelMesList || []).filter((item: any) =>
                    !q ||
                    item.codigoPM.toLowerCase().includes(q) ||
                    item.nombrePM.toLowerCase().includes(q) ||
                    (item.componente && item.componente.toLowerCase().includes(q)) ||
                    (item.detalle && item.detalle.toLowerCase().includes(q)) ||
                    (item.estructuras && item.estructuras.some((e: string) => e.toLowerCase().includes(q)))
                  );

                  if (list.length === 0) {
                    return (
                      <div className="p-8 bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-xl text-center space-y-2">
                        <AlertTriangle className="w-8 h-8 text-slate-600 dark:text-zinc-600 mx-auto" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          {modalSearchTerm ? "No se encontraron fallas con ese criterio de búsqueda." : "No se registraron fallas en este mes."}
                        </p>
                      </div>
                    );
                  }

                  return list.map((item: any, idx: number) => (
                    <div 
                      key={`f-modal-${idx}`} 
                      className="p-3.5 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5 bg-white dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800">
                            <Wrench className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            {item.codigoPM}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.nombrePM}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.prioridad === "Alta" && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                              Prioridad Alta
                            </span>
                          )}
                          {item.estructuras && item.estructuras.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 px-2 py-0.5 rounded-md font-mono">
                              {item.estructuras.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {(item.componente || item.detalle) && (
                        <div className="text-xs text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between gap-2">
                          <div>
                            <strong className="font-bold text-red-600 dark:text-red-400">{item.componente || "Falla"}:</strong>{" "}
                            <span>{item.detalle || "Pendiente de atención"}</span>
                            {item.totalFallasActivas && item.totalFallasActivas > 1 && (
                              <span className="ml-2 text-[10px] bg-red-500/20 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-mono font-bold">
                                ({item.totalFallasActivas} fallas)
                              </span>
                            )}
                          </div>
                          {item.fechaReporteStr && (
                            <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 shrink-0">
                              Rep: {item.fechaReporteStr}
                            </span>
                          )}
                        </div>
                      )}

                      {item.observaciones && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic bg-white dark:bg-zinc-950/60 p-2 rounded border border-slate-200 dark:border-zinc-800/80">
                          &ldquo;{item.observaciones}&rdquo;
                        </p>
                      )}
                    </div>
                  ));
                })()
              ) : modalTab === "seguimiento" ? (
                // PESTAÑA: PUNTOS EN SEGUIMIENTO DEL MES
                (() => {
                  const q = modalSearchTerm.toLowerCase();
                  const list = (selectedMonthModal.seguimientoDelMesList || []).filter((item: any) =>
                    !q ||
                    item.codigoPM.toLowerCase().includes(q) ||
                    item.nombrePM.toLowerCase().includes(q) ||
                    (item.loQueQuedoPendiente && item.loQueQuedoPendiente.toLowerCase().includes(q)) ||
                    (item.estructuras && item.estructuras.some((e: string) => e.toLowerCase().includes(q)))
                  );

                  if (list.length === 0) {
                    return (
                      <div className="p-8 bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-xl text-center space-y-2">
                        <Clock className="w-8 h-8 text-slate-600 dark:text-zinc-600 mx-auto" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          {modalSearchTerm ? "No se encontraron puntos en seguimiento con ese criterio." : "No hay puntos en seguimiento registrados para este periodo."}
                        </p>
                      </div>
                    );
                  }

                  return list.map((item: any, idx: number) => (
                    <div 
                      key={`s-modal-${idx}`} 
                      className="p-3.5 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2.5 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5 bg-white dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            {item.codigoPM}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.nombrePM}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                            En Seguimiento
                          </span>
                          {item.estructuras && item.estructuras.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 px-2 py-0.5 rounded-md font-mono">
                              {item.estructuras.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.loQueQuedoPendiente && (
                        <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg space-y-0.5">
                          <strong className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 block tracking-wider">
                            Motivo / Tareas Pendientes:
                          </strong>
                          <p className="leading-relaxed whitespace-pre-wrap">{item.loQueQuedoPendiente}</p>
                        </div>
                      )}
                    </div>
                  ));
                })()
              ) : (
                // PESTAÑA: PUNTOS CORREGIDOS DEL MES (INTERVENCIONES)
                (() => {
                  const q = modalSearchTerm.toLowerCase();
                  const list = (selectedMonthModal.arregladosDelMesList || []).filter((item: any) =>
                    !q ||
                    item.codigoPM.toLowerCase().includes(q) ||
                    item.nombrePM.toLowerCase().includes(q) ||
                    (item.tecnico && item.tecnico.toLowerCase().includes(q)) ||
                    (item.descripcion && item.descripcion.toLowerCase().includes(q)) ||
                    (item.estructuras && item.estructuras.some((e: string) => e.toLowerCase().includes(q))) ||
                    (item.fallasCorregidas && item.fallasCorregidas.some((f: any) => 
                      (f.componente && f.componente.toLowerCase().includes(q)) ||
                      (f.detalle && f.detalle.toLowerCase().includes(q)) ||
                      (f.observaciones && f.observaciones.toLowerCase().includes(q))
                    ))
                  );

                  if (list.length === 0) {
                    return (
                      <div className="p-8 bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-xl text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-slate-600 dark:text-zinc-600 mx-auto" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          {modalSearchTerm ? "No se encontraron intervenciones corregidas con ese criterio de búsqueda." : "No se registraron intervenciones correctivas en este mes."}
                        </p>
                      </div>
                    );
                  }

                  return list.map((item: any, idx: number) => (
                    <div 
                      key={item.id || `c-modal-${idx}`} 
                      className="p-3.5 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2.5 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5 bg-white dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {item.codigoPM}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.nombrePM}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            Intervención Ejecutada
                          </span>
                          {item.estructuras && item.estructuras.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 px-2 py-0.5 rounded-md font-mono">
                              {item.estructuras.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* LISTA DE FALLAS CORREGIDAS EN ESTA INTERVENCIÓN */}
                      {item.fallasCorregidas && item.fallasCorregidas.length > 0 ? (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                            {item.fallasCorregidas.length === 1 
                              ? "Falla corregida en esta intervención:" 
                              : `${item.fallasCorregidas.length} fallas solucionadas en esta intervención:`}
                          </span>
                          <div className="space-y-1">
                            {item.fallasCorregidas.map((f: any, fIdx: number) => (
                              <div 
                                key={fIdx} 
                                className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between gap-2"
                              >
                                <div>
                                  <strong className="font-bold text-emerald-600 dark:text-emerald-400">{f.componente || "Componente"}:</strong>{" "}
                                  <span>{f.detalle || "Reparado"}</span>
                                </div>
                                {f.prioridad === "Alta" && (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 shrink-0">
                                    Alta
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                          Mantenimiento correctivo / puesta en marcha
                        </div>
                      )}

                      {/* DATOS DE INTERVENCIÓN (TÉCNICO, FECHA) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800/60">
                        <div className="flex items-center gap-3">
                          {item.tecnico && (
                            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-zinc-300">
                              <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" />
                              {item.tecnico}
                            </span>
                          )}
                          {item.fecha && (
                            <span className="flex items-center gap-1 font-mono text-slate-500 dark:text-zinc-400">
                              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" />
                              {item.fecha}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.descripcion && (
                        <div className="text-[11px] text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800/90 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-500 tracking-wider block">
                            Informe / Trabajos Realizados:
                          </span>
                          <p className="italic leading-relaxed">&ldquo;{item.descripcion}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  ));
                })()
              )}
            </div>

            {/* PIE DEL MODAL */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                {modalTab === "fallas"
                  ? `Mostrando fallas de ${selectedMonthModal.name}`
                  : `Mostrando puntos corregidos de ${selectedMonthModal.name}`}
              </span>
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


