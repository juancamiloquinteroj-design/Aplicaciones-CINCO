import React, { useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, RefreshCw, Cpu } from "lucide-react";
import { Estructura, PMBase, RelacionTransformacion } from "../types";
import { saveBaseNetworkData } from "../lib/firebase";

interface NetworkUploadProps {
  onUploadSuccess: (
    estructuras: Record<string, Estructura>,
    pms: Record<string, PMBase>,
    relaciones: Record<string, RelacionTransformacion>
  ) => void;
  estructurasCount: number;
  pmsCount: number;
  relacionesCount: number;
  currentBaseData?: {
    estructuras: Record<string, Estructura>;
    pms: Record<string, PMBase>;
    relaciones: Record<string, RelacionTransformacion>;
  };
}

export default function NetworkUpload({
  onUploadSuccess,
  estructurasCount,
  pmsCount,
  relacionesCount,
  currentBaseData
}: NetworkUploadProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [estructurasFile, setEstructurasFile] = useState<File | null>(null);
  const [pmsFile, setPmsFile] = useState<File | null>(null);
  const [relacionesFile, setRelacionesFile] = useState<File | null>(null);

  const detectDelimiter = (firstLine: string): string => {
    const clean = firstLine.replace(/^\uFEFF/, "");
    if (clean.includes(";")) return ";";
    if (clean.includes("\t")) return "\t";
    if (clean.includes(",")) return ",";
    return ";";
  };

  const parseRelacionesText = (text: string): Record<string, RelacionTransformacion> => {
    const lineas = text.split(/\r?\n/);
    if (lineas.length < 2) return {};

    const delim = detectDelimiter(lineas[0]);
    const headers = lineas[0].split(delim).map(h => h.trim().toUpperCase());

    const findExact = (names: string[]) => headers.findIndex(h => names.some(n => h === n));
    const findIncludes = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));

    const idxNemonico = findExact(["NEMONICO", "NEMÓNICO", "PM"]) !== -1 
      ? findExact(["NEMONICO", "NEMÓNICO", "PM"]) 
      : findIncludes(["NEMONICO", "NEMÓNICO", "PM"]);

    const idxCuenta = findExact(["CUENTA"]) !== -1 ? findExact(["CUENTA"]) : findIncludes(["CUENTA"]);
    
    // CT & F. CT
    const idxFCt = findExact(["F. CT", "F.CT", "FACTOR CT", "F CT", "F_CT"]) !== -1
      ? findExact(["F. CT", "F.CT", "FACTOR CT", "F CT", "F_CT"])
      : findIncludes(["F. CT", "FACTOR CT", "F_CT"]);
    const idxCT = headers.findIndex((h, i) => i !== idxFCt && (h === "CT" || h === "CTS" || h.startsWith("CT")));

    // PT & F. PT
    const idxFPt = findExact(["F. PT", "F.PT", "FACTOR PT", "F PT", "F_PT"]) !== -1
      ? findExact(["F. PT", "F.PT", "FACTOR PT", "F PT", "F_PT"])
      : findIncludes(["F. PT", "FACTOR PT", "F_PT"]);
    const idxPT = headers.findIndex((h, i) => i !== idxFPt && (h === "PT" || h === "PTS" || h.startsWith("PT")));

    const idxMedidor = findExact(["MEDIDOR", "MEDIDOR Nº", "NUM MEDIDOR"]) !== -1
      ? findExact(["MEDIDOR", "MEDIDOR Nº", "NUM MEDIDOR"])
      : findIncludes(["MEDIDOR"]);

    const idxMarca = findExact(["MARCA MEDIDOR", "MARCA_MEDIDOR", "MARCA"]) !== -1
      ? findExact(["MARCA MEDIDOR", "MARCA_MEDIDOR", "MARCA"])
      : findIncludes(["MARCA"]);

    const idxTipo = findExact(["TIPO DE MEDIDOR", "TIPO_MEDIDOR", "TIPO MEDIDOR"]) !== -1
      ? findExact(["TIPO DE MEDIDOR", "TIPO_MEDIDOR", "TIPO MEDIDOR"])
      : findIncludes(["TIPO"]);

    const idxClase = findExact(["CLASE"]) !== -1 ? findExact(["CLASE"]) : findIncludes(["CLASE"]);
    const idxFactorSist = findExact(["FACTOR SISTEMA", "FACTOR_SISTEMA", "FACTOR"]) !== -1
      ? findExact(["FACTOR SISTEMA", "FACTOR_SISTEMA", "FACTOR"])
      : findIncludes(["FACTOR SISTEMA"]);

    const idxComunicacion = findExact(["COMUNICACION", "COMUNICACIÓN"]) !== -1
      ? findExact(["COMUNICACION", "COMUNICACIÓN"])
      : findIncludes(["COMUNICACION", "COMUNICACIÓN"]);

    const idxDirIp = findExact(["DIR. IP", "DIR_IP", "DIR IP", "IP", "DIRECCION IP", "DIRECCIÓN IP"]) !== -1
      ? findExact(["DIR. IP", "DIR_IP", "DIR IP", "IP", "DIRECCION IP", "DIRECCIÓN IP"])
      : findIncludes(["IP", "DIR"]);

    const res: Record<string, RelacionTransformacion> = {};

    for (let i = 1; i < lineas.length; i++) {
      if (!lineas[i].trim()) continue;
      const vals = lineas[i].split(delim).map(v => v.trim());
      const nemonico = idxNemonico !== -1 && vals[idxNemonico] ? vals[idxNemonico] : "";
      if (nemonico) {
        res[nemonico] = {
          nemonico,
          cuenta: idxCuenta !== -1 && vals[idxCuenta] ? vals[idxCuenta] : "",
          ct: idxCT !== -1 && vals[idxCT] ? vals[idxCT] : "",
          fCt: idxFCt !== -1 && vals[idxFCt] ? vals[idxFCt] : "",
          pt: idxPT !== -1 && vals[idxPT] ? vals[idxPT] : "",
          fPt: idxFPt !== -1 && vals[idxFPt] ? vals[idxFPt] : "",
          medidor: idxMedidor !== -1 && vals[idxMedidor] ? vals[idxMedidor] : "",
          marcaMedidor: idxMarca !== -1 && vals[idxMarca] ? vals[idxMarca] : "",
          tipoMedidor: idxTipo !== -1 && vals[idxTipo] ? vals[idxTipo] : "",
          clase: idxClase !== -1 && vals[idxClase] ? vals[idxClase] : "",
          factorSistema: idxFactorSist !== -1 && vals[idxFactorSist] ? vals[idxFactorSist] : "",
          comunicacion: idxComunicacion !== -1 && vals[idxComunicacion] ? vals[idxComunicacion] : "",
          dirIp: idxDirIp !== -1 && vals[idxDirIp] ? vals[idxDirIp] : ""
        };
      }
    }

    return res;
  };

  const readFileText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, "UTF-8");
    });
  };

  const processFiles = async () => {
    if (!estructurasFile && !pmsFile && !relacionesFile) {
      setErrorMsg("Por favor, seleccione al menos un archivo para cargar (Estructuras, Puntos de Medida o Relaciones Transformación).");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let parsedEstructuras: Record<string, Estructura> = { ...(currentBaseData?.estructuras || {}) };
    let parsedPMs: Record<string, PMBase> = { ...(currentBaseData?.pms || {}) };
    let parsedRelaciones: Record<string, RelacionTransformacion> = { ...(currentBaseData?.relaciones || {}) };

    try {
      // 1. Process Estructuras if provided
      if (estructurasFile) {
        const text = await readFileText(estructurasFile);
        if (!text.trim()) throw new Error("El archivo de Estructuras está vacío.");

        const lineas = text.split(/\r?\n/);
        const delim = detectDelimiter(lineas[0]);
        const cleanHeaderLine = lineas[0].replace(/^\uFEFF/, "");
        const headers = cleanHeaderLine.split(delim).map(h => h.trim().toUpperCase().replace(/["']/g, ""));

        const idxE = headers.findIndex(h => h === "ESTRUCTURA" || h === "ESTRUCTURAS" || h === "CODIGO" || h.includes("ESTRUCTURA"));
        const idxT = headers.findIndex(h => h === "TIPO" || h.includes("TIPO"));
        const idxZ = headers.findIndex(h => h === "ZONA" || h.includes("ZONA"));
        const idxN = headers.findIndex(h => h === "NIVEL" || h.includes("NIVEL") || h.includes("TENSION") || h.includes("TENSIÓN"));

        if (idxE === -1) {
          throw new Error("El archivo de Estructuras no contiene la columna 'ESTRUCTURA'.");
        }

        const newEst: Record<string, Estructura> = { ...parsedEstructuras };
        for (let i = 1; i < lineas.length; i++) {
          if (!lineas[i].trim()) continue;
          const vals = lineas[i].split(delim);
          const estName = vals[idxE]?.trim().replace(/^["']|["']$/g, "");
          if (estName) {
            newEst[estName] = {
              tipo: idxT !== -1 && vals[idxT] ? vals[idxT].trim().replace(/^["']|["']$/g, "") : "N/A",
              zona: idxZ !== -1 && vals[idxZ] ? vals[idxZ].trim().replace(/^["']|["']$/g, "") : "N/A",
              nivel: idxN !== -1 && vals[idxN] ? vals[idxN].trim().replace(/^["']|["']$/g, "") : "N/A",
            };
          }
        }
        parsedEstructuras = newEst;
      }

      // 2. Process PMs if provided
      if (pmsFile) {
        const pmText = await readFileText(pmsFile);
        if (!pmText.trim()) throw new Error("El archivo de Puntos de Medida está vacío.");

        const pmLineas = pmText.split(/\r?\n/);
        const cleanFirstLine = pmLineas[0].replace(/^\uFEFF/, "");
        const delim = detectDelimiter(cleanFirstLine);
        const pmHeaders = cleanFirstLine.split(delim).map(h => h.trim().toUpperCase().replace(/["']/g, ""));

        const idxPM = pmHeaders.findIndex(h => 
          h === "PM" || h === "PUNTO DE MEDIDA" || h === "PUNTO_MEDIDA" || h === "CODIGO PM" || h === "CODIGOPM" || h === "NEMONICO" || h === "P.M." || h.startsWith("PM")
        );
        const idxEst = pmHeaders.findIndex(h => 
          h === "ESTRUCTURA" || h === "ESTRUCTURAS" || h === "LINEA" || h === "LINEAS" || h === "CIRCUITO" || h === "CIRCUITOS" || h.includes("ESTRUCTURA")
        );
        const idxNom = pmHeaders.findIndex(h => 
          h === "NOMBRE" || h === "DESCRIPCION" || h === "CLIENTE" || h === "NOMBRE PM" || h.includes("NOMBRE")
        );

        if (idxPM === -1 || idxEst === -1) {
          throw new Error("El archivo de Puntos de Medida debe contener las columnas 'PM' y 'ESTRUCTURA'.");
        }

        const newPMs: Record<string, PMBase> = { ...parsedPMs };
        for (let i = 1; i < pmLineas.length; i++) {
          if (!pmLineas[i].trim()) continue;
          const vals = pmLineas[i].split(delim);
          const pmCode = vals[idxPM]?.trim().replace(/^["']|["']$/g, "");
          const estRaw = vals[idxEst]?.trim().replace(/^["']|["']$/g, "");
          const name = idxNom !== -1 && vals[idxNom] ? vals[idxNom].trim().replace(/^["']|["']$/g, "") : "Sin Nombre";

          if (pmCode && estRaw) {
            if (!newPMs[pmCode]) {
              newPMs[pmCode] = { nombre: name, estructuras: [] };
            }
            if (name && name !== "Sin Nombre") {
              newPMs[pmCode].nombre = name;
            }

            // Support both multiple rows for same PM and/or comma/semicolon/slash separated structures in one cell
            const splitEsts = estRaw.split(/[,;\n\r+/]/).map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
            splitEsts.forEach(singleEst => {
              if (!newPMs[pmCode].estructuras.includes(singleEst)) {
                newPMs[pmCode].estructuras.push(singleEst);
              }
              // Auto-register structure in parsedEstructuras if not already present
              if (!parsedEstructuras[singleEst]) {
                const autoTipo = singleEst.startsWith("PB ") ? "PB" : singleEst.startsWith("CTO ") ? "CTO" : singleEst.startsWith("PT ") ? "PT" : "L";
                const autoNivel = singleEst.includes("34.5") ? "34.5 kV" : singleEst.includes("13.8") ? "13.8 kV" : "34.5 kV";
                parsedEstructuras[singleEst] = {
                  tipo: autoTipo,
                  zona: "Auto",
                  nivel: autoNivel
                };
              }
            });
          }
        }
        parsedPMs = newPMs;
      }

      // 3. Process Relaciones Transformacion if provided
      if (relacionesFile) {
        const relText = await readFileText(relacionesFile);
        if (!relText.trim()) throw new Error("El archivo de Relaciones Transformación está vacío.");

        const rels = parseRelacionesText(relText);
        if (Object.keys(rels).length === 0) {
          throw new Error("No se encontraron registros válidos en 'Relaciones Transformacion.csv'. Verifique el nombre de la columna 'NEMONICO' o 'PM'.");
        }
        parsedRelaciones = rels;
      }

      // Save to Firebase and update state
      await saveBaseNetworkData(parsedEstructuras, parsedPMs, parsedRelaciones);
      onUploadSuccess(parsedEstructuras, parsedPMs, parsedRelaciones);

      const msgParts = [];
      if (estructurasFile) msgParts.push(`${Object.keys(parsedEstructuras).length} estructuras`);
      if (pmsFile) msgParts.push(`${Object.keys(parsedPMs).length} puntos de medida`);
      if (relacionesFile) msgParts.push(`${Object.keys(parsedRelaciones).length} relaciones de transformación`);

      setSuccessMsg(`Base de datos actualizada con éxito (${msgParts.join(", ")}).`);
      setEstructurasFile(null);
      setPmsFile(null);
      setRelacionesFile(null);

      // Reset file inputs
      const estInput = document.getElementById("csvEstructuras") as HTMLInputElement;
      const pmInput = document.getElementById("csvPMs") as HTMLInputElement;
      const relInput = document.getElementById("csvRelaciones") as HTMLInputElement;
      if (estInput) estInput.value = "";
      if (pmInput) pmInput.value = "";
      if (relInput) relInput.value = "";
    } catch (err: any) {
      setErrorMsg(`Error procesando archivos: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="section_network_upload" className="bg-slate-50 dark:bg-zinc-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xl">
      <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Upload className="w-5 h-5 text-amber-500" />
        Base de Datos de Red y Especificaciones (CSV)
      </h3>
      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 font-medium leading-normal">
        Cargue los archivos CSV delimitados para actualizar el mapa de estructuras, puntos de medida y la tabla técnica de relaciones de transformación/medidores.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        
        {/* CARD A */}
        <div className="p-4 bg-white dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-850/80">
          <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            A. Estructuras.csv
          </label>
          <input
            id="csvEstructuras"
            type="file"
            accept=".csv"
            onChange={(e) => setEstructurasFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-500 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100 dark:file:bg-zinc-800 file:text-slate-900 dark:file:text-zinc-100 hover:file:bg-slate-200 dark:hover:file:bg-zinc-700 cursor-pointer"
          />
          <p className="mt-1.5 text-[10px] text-slate-500 dark:text-zinc-500 font-mono">Columnas: ESTRUCTURA, TIPO, ZONA, NIVEL</p>
        </div>

        {/* CARD B */}
        <div className="p-4 bg-white dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-850/80">
          <label className="block text-[11px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            B. Puntos de Medida.csv
          </label>
          <input
            id="csvPMs"
            type="file"
            accept=".csv"
            onChange={(e) => setPmsFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-500 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100 dark:file:bg-zinc-800 file:text-slate-900 dark:file:text-zinc-100 hover:file:bg-slate-200 dark:hover:file:bg-zinc-700 cursor-pointer"
          />
          <p className="mt-1.5 text-[10px] text-slate-500 dark:text-zinc-500 font-mono">Columnas: PM, ESTRUCTURA, NOMBRE</p>
        </div>

        {/* CARD C */}
        <div className="p-4 bg-white dark:bg-zinc-950 rounded-lg border border-amber-500/30">
          <label className="block text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            C. Relaciones Transformacion.csv
          </label>
          <input
            id="csvRelaciones"
            type="file"
            accept=".csv"
            onChange={(e) => setRelacionesFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-500 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100 dark:file:bg-zinc-800 file:text-amber-700 dark:file:text-amber-300 hover:file:bg-slate-200 dark:hover:file:bg-zinc-700 cursor-pointer"
          />
          <p className="mt-1.5 text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
            Columnas: NEMONICO, CUENTA, CT, F. CT, PT, F. PT, MEDIDOR, MARCA, TIPO, CLASE, FACTOR, COMUNICACION, IP
          </p>
        </div>
        
      </div>

      {errorMsg && (
        <div className="p-3.5 mb-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3.5 border-t border-slate-200 dark:border-zinc-800/80">
        <div className="text-xs text-slate-500 dark:text-zinc-400 flex flex-wrap gap-2 items-center">
          <span className="font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">Estado actual:</span>{" "}
          {estructurasCount > 0 || relacionesCount > 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Activo ({estructurasCount} Estructuras, {pmsCount} PMs, {relacionesCount} Relaciones)
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              Sin datos de red cargados
            </span>
          )}
        </div>

        <button
          onClick={processFiles}
          disabled={loading || (!estructurasFile && !pmsFile && !relacionesFile)}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all duration-150 uppercase tracking-wide ${
            loading || (!estructurasFile && !pmsFile && !relacionesFile)
              ? "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-600 cursor-not-allowed border border-slate-200 dark:border-zinc-800/50"
              : "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/5 cursor-pointer"
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Actualizar Base de Datos
            </>
          )}
        </button>
      </div>
    </div>
  );
}
