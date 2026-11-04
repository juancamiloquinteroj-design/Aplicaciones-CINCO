import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PM, Estructura, PMBase, RelacionTransformacion } from "../types";
import { getStructureType, VALID_STRUCTURE_TYPES, ValidStructureType, STRUCTURE_TYPE_LABELS } from "./structureUtils";

/**
 * EXPORT UNIFIED PMS DIRECTORY TO A SINGLE EXCEL (.xlsx) WITH TWO SHEETS:
 * 1. "Puntos Pendientes" (Puntos activos en falla, instalación o revisión, excluyendo seguimiento)
 * 2. "En Seguimiento" (Puntos con intervenciones o revisiones en seguimiento continuo)
 */
export function exportUnifiedPMsToExcel(
  pms: PM[],
  relacionesDict: Record<string, RelacionTransformacion> = {}
) {
  const workbook = XLSX.utils.book_new();

  // 1. HOJA DE PUNTOS PENDIENTES (INCLUYE PUNTOS EN FALLA, EN SEGUIMIENTO E INSTALACIÓN)
  const pendingPMs = pms.filter(pm => {
    if (pm.estadoGral === "Ok" && (!pm.activeFailures || pm.activeFailures.length === 0)) return false;
    return true;
  });

  const pendingRows = pendingPMs.map((pm, index) => {
    const activeFails = pm.activeFailures || [];
    const failDetails = activeFails.map(f => `${f.componente}: ${f.detalle}`).join(" | ");
    const failObs = activeFails.map(f => f.observaciones || "").filter(Boolean).join(" | ");
    const failDates = activeFails.map(f => f.fechaReparacion || "Sin definir").join(" | ");
    const failReprogrammed = activeFails.map(f => f.vecesReprogramada ? `${f.vecesReprogramada}x` : "0").join(" | ");
    const isPMAlta = pm.prioridad === "Alta" || activeFails.some(f => f.prioridad === "Alta");
    const tech = relacionesDict[pm.codigoPM];
    const isSeguimiento = pm.estadoGral === "Seguimiento";
    const numRevisiones = isSeguimiento ? (pm.intervenciones ? pm.intervenciones.length : 1) : 0;

    return {
      "Nº": index + 1,
      "Código PM": pm.codigoPM,
      "Nombre del PM": pm.nombrePM,
      "Estado General": isSeguimiento ? "En Seguimiento" : pm.estadoGral,
      "Prioridad": isPMAlta ? "Alta" : "Normal",
      "Revisiones": numRevisiones,
      "Estructuras Afectadas": pm.estructuras ? pm.estructuras.join(", ") : "",
      "Cantidad Estructuras": pm.estructuras ? pm.estructuras.length : 0,
      "Fallas Activas (Componente: Detalle)": failDetails || "Sin fallas activas registradas",
      "Fechas Programadas Intervención": failDates || "N/A",
      "Veces Reprogramada": failReprogrammed,
      "Observaciones de Falla": failObs || "N/A",
      "Intervenciones Previas": pm.intervenciones ? pm.intervenciones.length : 0,
      "Medidor": tech?.medidor || "N/A",
      "Marca / Tipo Medidor": tech ? `${tech.marcaMedidor || ""} ${tech.tipoMedidor || ""}`.trim() || "N/A" : "N/A",
      "Relación CT / PT": tech ? `CT: ${tech.ct || "N/A"} (F:${tech.fCt || "-"}) | PT: ${tech.pt || "N/A"} (F:${tech.fPt || "-"})` : "N/A",
      "Factor Sistema": tech?.factorSistema || "N/A",
      "IP / Comunicación": tech ? `${tech.dirIp || ""} (${tech.comunicacion || ""})`.trim() || "N/A" : "N/A"
    };
  });

  const pendingWorksheet = XLSX.utils.json_to_sheet(
    pendingRows.length > 0 ? pendingRows : [{ "Mensaje": "Sin registros de puntos de medida pendientes" }]
  );
  if (pendingRows.length > 0) {
    const keys = Object.keys(pendingRows[0]);
    pendingWorksheet["!cols"] = keys.map(k => ({
      wch: Math.max(k.length + 3, 14)
    }));
  }
  XLSX.utils.book_append_sheet(workbook, pendingWorksheet, "Puntos Pendientes");

  // 2. HOJA DE EN SEGUIMIENTO
  const seguimientoPMs = pms.filter(pm => pm.estadoGral === "Seguimiento");

  const seguimientoRows = seguimientoPMs.map((pm, index) => {
    const activeFails = pm.activeFailures || [];
    const failDetails = activeFails.map(f => `${f.componente}: ${f.detalle}`).join(" | ");
    const failDates = activeFails.map(f => f.fechaReparacion || "Sin definir").join(" | ");
    const isPMAlta = pm.prioridad === "Alta" || activeFails.some(f => f.prioridad === "Alta");
    const tech = relacionesDict[pm.codigoPM];
    const lastIntervention = pm.intervenciones && pm.intervenciones.length > 0 
      ? pm.intervenciones[pm.intervenciones.length - 1] 
      : undefined;

    const ultimoTecnico = pm.ultimoReporteTecnico?.tecnico || lastIntervention?.tecnico || "N/A";
    const ultimaFecha = pm.ultimoReporteTecnico?.fecha || lastIntervention?.fecha || "N/A";
    const ultimaDescripcion = pm.ultimoReporteTecnico?.descripcion || lastIntervention?.descripcion || "N/A";
    const pendiente = pm.loQueQuedoPendiente || pm.ultimoReporteTecnico?.loQueQuedoPendiente || lastIntervention?.loQueQuedoPendiente || "N/A";
    const proximaRevision = lastIntervention?.proximaRevision || "Sin definir";

    return {
      "Nº": index + 1,
      "Código PM": pm.codigoPM,
      "Nombre del PM": pm.nombrePM,
      "Estado General": "Seguimiento",
      "Prioridad": isPMAlta ? "Alta" : "Normal",
      "Estructuras Afectadas": pm.estructuras ? pm.estructuras.join(", ") : "",
      "Cantidad Estructuras": pm.estructuras ? pm.estructuras.length : 0,
      "Lo que quedó Pendiente": pendiente,
      "Próxima Fecha de Revisión": proximaRevision,
      "Última Fecha de Revisión": ultimaFecha,
      "Último Técnico Responsable": ultimoTecnico,
      "Descripción Última Actividad": ultimaDescripcion,
      "Revisiones Realizadas": pm.intervenciones ? pm.intervenciones.length : 0,
      "Fallas Pendientes / Activas": failDetails || "Sin fallas pendientes",
      "Fechas Programadas": failDates || "N/A",
      "Medidor": tech?.medidor || "N/A",
      "Marca / Tipo Medidor": tech ? `${tech.marcaMedidor || ""} ${tech.tipoMedidor || ""}`.trim() || "N/A" : "N/A",
      "Relación CT / PT": tech ? `CT: ${tech.ct || "N/A"} (F:${tech.fCt || "-"}) | PT: ${tech.pt || "N/A"} (F:${tech.fPt || "-"})` : "N/A",
      "Factor Sistema": tech?.factorSistema || "N/A",
      "IP / Comunicación": tech ? `${tech.dirIp || ""} (${tech.comunicacion || ""})`.trim() || "N/A" : "N/A"
    };
  });

  const seguimientoWorksheet = XLSX.utils.json_to_sheet(
    seguimientoRows.length > 0 ? seguimientoRows : [{ "Mensaje": "Sin registros de puntos de medida en seguimiento" }]
  );
  if (seguimientoRows.length > 0) {
    const keys = Object.keys(seguimientoRows[0]);
    seguimientoWorksheet["!cols"] = keys.map(k => ({
      wch: Math.max(k.length + 3, 14)
    }));
  }
  XLSX.utils.book_append_sheet(workbook, seguimientoWorksheet, "En Seguimiento");

  // Descarga el archivo Excel unificado
  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Reporte_Puntos_de_Medida_General_${todayStr}.xlsx`);
}

/**
 * EXPORT PENDING PMS DIRECTORY TO EXCEL (.xlsx)
 */
export function exportPMsToExcel(
  pms: PM[],
  relacionesDict: Record<string, RelacionTransformacion> = {},
  titleSuffix?: string
) {
  // Export active/pending PMs (state != "Ok")
  const activePMs = pms.filter(pm => pm.estadoGral !== "Ok");

  const rows = activePMs.map((pm, index) => {
    const activeFails = pm.activeFailures || [];

    const failDetails = activeFails.map(f => `${f.componente}: ${f.detalle}`).join(" | ");
    const failObs = activeFails.map(f => f.observaciones || "").filter(Boolean).join(" | ");
    const failDates = activeFails.map(f => f.fechaReparacion || "Sin definir").join(" | ");
    const failReprogrammed = activeFails.map(f => f.vecesReprogramada ? `${f.vecesReprogramada}x` : "0").join(" | ");

    const isPMAlta = pm.prioridad === "Alta" || activeFails.some(f => f.prioridad === "Alta");

    return {
      "Nº": index + 1,
      "Código PM": pm.codigoPM,
      "Nombre del PM": pm.nombrePM,
      "Estado General": pm.revisado ? `${pm.estadoGral} (Revisado)` : pm.estadoGral,
      "Prioridad": isPMAlta ? "Alta" : "Normal",
      "Estructuras Afectadas": pm.estructuras ? pm.estructuras.join(", ") : "",
      "Cantidad Estructuras": pm.estructuras ? pm.estructuras.length : 0,
      "Lo que quedó Pendiente (Seguimiento)": pm.loQueQuedoPendiente || "N/A",
      "Fallas Activas (Componente: Detalle)": failDetails || "Sin fallas activas registradas",
      "Fechas Programadas de Intervención": failDates || "N/A",
      "Veces Reprogramada": failReprogrammed,
      "Observaciones de Falla": failObs || "N/A",
      "Intervenciones Realizadas": pm.intervenciones ? pm.intervenciones.length : 0
    };
  });

  const sheetName = titleSuffix ? titleSuffix.slice(0, 31) : "Puntos Pendientes";
  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Mensaje": `Sin registros en ${sheetName}` }]);
  
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    worksheet["!cols"] = keys.map(k => ({
      wch: Math.max(k.length + 3, 15)
    }));
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanTitle = titleSuffix ? titleSuffix.replace(/\s+/g, "_") : "Pendientes";
  XLSX.writeFile(workbook, `Reporte_Puntos_de_Medida_${cleanTitle}_${todayStr}.xlsx`);
}

/**
 * GENERATE DASHBOARD EXECUTIVE REPORT (PDF)
 */
export function generateExecutivePDFReport(
  pms: PM[],
  baseData?: {
    estructuras: Record<string, Estructura>;
    pms: Record<string, PMBase>;
  },
  combinedChartData: any[] = []
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timeFormatted = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  // Core metrics
  const pmsInSeguimiento = pms.filter(pm => pm.estadoGral === "Seguimiento").length;
  const pmsInFailure = pms.filter(pm => pm.estadoGral === "En falla" || (pm.estadoGral as string) === "Para Revisión").length;
  const pmsInInstallation = pms.filter(pm => pm.estadoGral === "Instalación").length;

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

  const typeCounts: Record<ValidStructureType, number> = {
    PB: 0,
    L: 0,
    CTO: 0,
    PT: 0
  };
  affectedStructures.forEach(estCode => {
    const estObj = baseData?.estructuras?.[estCode];
    const type = getStructureType(estCode, estObj);
    if (type) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
  });

  const totalPendingPMs = pms.filter(pm => pm.estadoGral !== "Ok").length;
  const baseCount = baseData?.pms ? Object.keys(baseData.pms).length : 0;
  const totalPMs = baseCount > 0 ? baseCount : pms.length;
  const failurePercentage = totalPMs > 0 ? ((pmsInFailure / totalPMs) * 100).toFixed(1) : "0.0";
  const affectedPercentage = totalPMs > 0 ? ((totalPendingPMs / totalPMs) * 100).toFixed(1) : "0.0";

  const totalEstructurasCount = baseData?.estructuras ? Object.keys(baseData.estructuras).length : 0;
  const structuresPercentage = totalEstructurasCount > 0 ? ((totalAffectedStructures / totalEstructurasCount) * 100).toFixed(1) : "0.0";

  // Page 1 Header Banner
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 210, 32, "F");

  // Amber Accent Line
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 32, 210, 2, "F");

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("INFORME EJECUTIVO DE CONTROL OPERATIVO", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(212, 212, 216);
  doc.text("Estado de Red, Incidencias en Puntos de Medida y Programación", 14, 21);

  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text(`Fecha de emisión: ${dateFormatted} - ${timeFormatted}`, 14, 27);

  let currentY = 42;

  // EXECUTIVE SUMMARY BOX
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, 182, 30, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 30, 2, 2, "D");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RESUMEN EJECUTIVO DE IMPACTO Y OPERACIÓN", 18, currentY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const summaryParagraph = 
    `El presente informe consolida el monitoreo en tiempo real de la infraestructura de medición de la red eléctrica. ` +
    `Actualmente se registran ${totalPendingPMs} puntos de medida con requerimientos de atención u operaciones pendientes (${affectedPercentage}% ` +
    `del parque total de ${totalPMs} PMs). De éstos, ${pmsInFailure} presentan fallas operativas activas (${failurePercentage}%), ` +
    `${pmsInSeguimiento} se encuentran en estado de seguimiento continuo y ${pmsInInstallation} corresponden a puntos para instalación. ` +
    `La afectación compromete directamente a ${totalAffectedStructures} estructuras de distribución (${structuresPercentage}% del total registrado de ${totalEstructurasCount}).`;

  const splitSummary = doc.splitTextToSize(summaryParagraph, 174);
  doc.text(splitSummary, 18, currentY + 13);

  currentY += 36;

  // TABLA 1: INDICADORES CLAVE (KPIs)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Indicadores Clave de Desempeño (KPIs)", 14, currentY);

  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [["Indicador Operativo", "Cantidad", "% Afectación / Total Base", "Estado Operativo"]],
    body: [
      ["Puntos de Medida en Falla", `${pmsInFailure}`, `${failurePercentage}% (${pmsInFailure} / ${totalPMs})`, pmsInFailure > 0 ? "Atención Prioritaria" : "Normal"],
      ["Puntos en Seguimiento", `${pmsInSeguimiento}`, `${totalPMs > 0 ? ((pmsInSeguimiento / totalPMs) * 100).toFixed(1) : "0.0"}% (${pmsInSeguimiento} / ${totalPMs})`, pmsInSeguimiento > 0 ? "Monitoreo Activo" : "Al Día"],
      ["Puntos para Instalación", `${pmsInInstallation}`, `${totalPMs > 0 ? ((pmsInInstallation / totalPMs) * 100).toFixed(1) : "0.0"}% (${pmsInInstallation} / ${totalPMs})`, "En Proceso"],
      ["Estructuras de Red Afectadas", `${totalAffectedStructures}`, `${structuresPercentage}% (${totalAffectedStructures} / ${totalEstructurasCount})`, totalAffectedStructures > 0 ? "Impacto en Infraestructura" : "Sin Afectación"],
      ["Total Acciones Pendientes", `${totalPendingPMs}`, `${affectedPercentage}% del Total`, "Monitoreo General"]
    ],
    theme: "grid",
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // TABLA 2: DESGLOSE DE ESTRUCTURAS AFECTADAS POR TIPO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Desglose de Estructuras Afectadas por Tipo", 14, currentY);

  currentY += 4;

  const structRows = VALID_STRUCTURE_TYPES.filter(t => typeCounts[t] > 0).map((typeKey) => {
    const count = typeCounts[typeKey];
    const pct = totalAffectedStructures > 0 ? ((count / totalAffectedStructures) * 100).toFixed(1) : "0.0";
    const desc = STRUCTURE_TYPE_LABELS[typeKey] || "Estructura de distribución";
    return [typeKey, desc, `${count}`, `${pct}%`];
  });

  if (structRows.length === 0) {
    structRows.push(["N/A", "Sin estructuras afectadas", "0", "0%"]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [["Tipo", "Descripción", "Cantidad Afectada", "% sobre Afectadas"]],
    body: structRows,
    theme: "grid",
    headStyles: {
      fillColor: [217, 119, 6],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // TABLA 3: TRAZABILIDAD Y EVOLUCIÓN MENSUAL
  if (combinedChartData && combinedChartData.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Trazabilidad y Evolución Mensual de Incidencias", 14, currentY);

    currentY += 4;

    const chartRows = combinedChartData.map((d: any) => [
      d.name || "N/A",
      `${d["Fallas del Mes"] || 0} fallas`,
      `${d["Arreglados del Mes"] || 0} corregidas`,
      `${d["Balance Acumulado"] || 0} pendientes`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Mes / Período", "Fallas Reportadas", "Fallas Corregidas", "Balance Acumulado Pendiente"]],
      body: chartRows,
      theme: "grid",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // FOOTER
  if (currentY > 260) {
    doc.addPage();
    currentY = 30;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY, 196, currentY);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Informe ejecutivo generado automáticamente desde la Plataforma de Control Operativo de Red.", 14, currentY + 5);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages} - Confidencial para Gestión Operativa`, 196, 287, { align: "right" });
  }

  // Save File
  const filename = `Informe_Ejecutivo_Control_Operativo_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
