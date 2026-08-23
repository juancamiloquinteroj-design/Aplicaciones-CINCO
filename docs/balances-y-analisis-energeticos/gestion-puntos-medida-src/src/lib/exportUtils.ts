import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PM, Estructura, PMBase, RelacionTransformacion } from "../types";

/**
 * EXPORT PENDING PMS DIRECTORY TO EXCEL (.xlsx)
 */
export function exportPMsToExcel(
  pms: PM[],
  relacionesDict: Record<string, RelacionTransformacion> = {}
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
      "Fallas Activas (Componente: Detalle)": failDetails || "Sin fallas activas registradas",
      "Fechas Programadas de Intervención": failDates || "N/A",
      "Veces Reprogramada": failReprogrammed,
      "Observaciones de Falla": failObs || "N/A",
      "Intervenciones Realizadas": pm.intervenciones ? pm.intervenciones.length : 0
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Mensaje": "Sin puntos de medida pendientes" }]);
  
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    worksheet["!cols"] = keys.map(k => ({
      wch: Math.max(k.length + 3, 15)
    }));
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Puntos Pendientes");

  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Reporte_Puntos_de_Medida_Pendientes_${todayStr}.xlsx`);
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
  combinedChartData: any[] = [],
  scheduleStats?: {
    thisWeekList: any[];
    overdueList: any[];
    notScheduledList: any[];
    reprogrammedList: any[];
  }
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
  const pmsInFailure = pms.filter(pm => pm.estadoGral === "En falla" || (pm.estadoGral as string) === "Para Revisión").length;
  const pmsInInstallation = pms.filter(pm => pm.estadoGral === "Instalación").length;

  const affectedStructures = new Set<string>();
  pms.forEach(pm => {
    if (pm.estadoGral !== "Ok") {
      pm.estructuras?.forEach(est => affectedStructures.add(est));
    }
  });
  const totalAffectedStructures = affectedStructures.size;

  const typeCounts: Record<string, number> = {};
  affectedStructures.forEach(estCode => {
    let type = "OTROS";
    const estObj = baseData?.estructuras?.[estCode];
    if (estObj?.tipo) {
      type = estObj.tipo.toUpperCase().trim();
    } else if (estCode.toUpperCase().startsWith("PB")) type = "PB";
    else if (estCode.toUpperCase().startsWith("L")) type = "L";
    else if (estCode.toUpperCase().startsWith("PT")) type = "PT";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const totalPendingPMs = pms.filter(pm => pm.estadoGral !== "Ok").length;
  const baseCount = baseData?.pms ? Object.keys(baseData.pms).length : 0;
  const totalPMs = baseCount > 0 ? baseCount : pms.length;
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
    `del parque total de ${totalPMs} PMs). De éstos, ${pmsInFailure} presentan fallas operativas activas y ${pmsInInstallation} corresponden a puntos para instalación. ` +
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
      ["Puntos de Medida en Falla", `${pmsInFailure}`, `${affectedPercentage}% (${pmsInFailure} / ${totalPMs})`, pmsInFailure > 0 ? "Atención Prioritaria" : "Normal"],
      ["Puntos para Instalación", `${pmsInInstallation}`, `N/A (${pmsInInstallation})`, "En Proceso"],
      ["Estructuras de Red Afectadas", `${totalAffectedStructures}`, `${structuresPercentage}% (${totalAffectedStructures} / ${totalEstructurasCount})`, totalAffectedStructures > 0 ? "Impacto en Infraestructura" : "Sin Afectación"],
      ["Total Acciones Pendientes", `${totalPendingPMs}`, `${affectedPercentage}% del Total`, "Monitoreo Activo"]
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

  const structRows = Object.entries(typeCounts).map(([typeKey, count]) => {
    const pct = totalAffectedStructures > 0 ? ((count / totalAffectedStructures) * 100).toFixed(1) : "0.0";
    let desc = "Estructura de distribución";
    if (typeKey === "PB") desc = "Poste Baja Tensión (PB)";
    else if (typeKey === "L") desc = "Línea / Red de Distribución (L)";
    else if (typeKey === "PT") desc = "Poste de Transformación (PT)";
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

  // TABLA 3: ESTADO DE PROGRAMACIÓN
  if (scheduleStats) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Estado de Programación de Intervenciones", 14, currentY);

    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [["Categoría de Programación", "Cantidad", "Estatus de Alerta", "Recomendación Operativa"]],
      body: [
        ["Programadas para Esta Semana", `${scheduleStats.thisWeekList.length}`, "Programada", "Ejecutar cuadrillas según cronograma"],
        ["Acciones VENCIDAS (Fuera de fecha)", `${scheduleStats.overdueList.length}`, "ALERTA VENCIDA", "Atención e intervención inmediata"],
        ["Pendientes Sin Fecha Asignada", `${scheduleStats.notScheduledList.length}`, "Sin Fecha", "Asignar fecha de reparación"],
        ["Intervenciones Reprogramadas", `${scheduleStats.reprogrammedList.length}`, "Reprogramado", "Revisar causas de aplazamiento"]
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
  }

  // TABLA 4: TRAZABILIDAD Y EVOLUCIÓN MENSUAL
  if (combinedChartData && combinedChartData.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("4. Trazabilidad y Evolución Mensual de Incidencias", 14, currentY);

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
