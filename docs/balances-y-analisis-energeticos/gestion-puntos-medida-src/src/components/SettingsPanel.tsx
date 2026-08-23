import React, { useState, useEffect } from "react";
import { Database, RefreshCw, CheckCircle2 } from "lucide-react";
import { getFirebaseStatus, testFirebaseConnection, FirebaseStatus } from "../lib/firebase";
import NetworkUpload from "./NetworkUpload";
import { Estructura, PMBase, RelacionTransformacion } from "../types";

interface SettingsPanelProps {
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
  onSync?: () => Promise<void>;
}

export default function SettingsPanel({
  onUploadSuccess,
  estructurasCount,
  pmsCount,
  relacionesCount,
  currentBaseData,
  onSync
}: SettingsPanelProps) {
  const [fbStatus, setFbStatus] = useState<FirebaseStatus>(getFirebaseStatus());
  const [checkingFb, setCheckingFb] = useState(false);

  useEffect(() => {
    let active = true;
    async function initialCheck() {
      setCheckingFb(true);
      const res = await testFirebaseConnection();
      if (active) {
        setFbStatus(res);
        setCheckingFb(false);
      }
    }
    initialCheck();
    return () => {
      active = false;
    };
  }, []);

  const handleTestConnection = async () => {
    setCheckingFb(true);
    if (onSync) {
      try {
        await onSync();
      } catch (err) {
        console.error("Error during manual sync:", err);
      }
    }
    const result = await testFirebaseConnection();
    setFbStatus(result);
    setCheckingFb(false);
  };

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: ESTADO DE LA CONEXIÓN FIREBASE */}
      <div id="section_firebase_status" className="bg-zinc-900/50 backdrop-blur-md p-6 rounded-xl border border-zinc-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-extrabold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            Sincronización en la Nube (Firebase)
          </h3>
          <button
            onClick={handleTestConnection}
            disabled={checkingFb}
            className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 border border-zinc-700 text-zinc-300 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingFb ? "animate-spin" : ""}`} />
            {checkingFb ? "Probando..." : "Sincronizar Ahora"}
          </button>
        </div>

        {fbStatus.connected ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Sincronización Activa y Conectada
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Todos los datos de la aplicación se están sincronizando en tiempo real con la base de datos central en la nube. Esto asegura que la información registrada en este dispositivo y en su celular se mantenga idéntica y actualizada al instante.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              Modo Offline / Sincronización Pendiente
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              La base de datos está guardando y protegiendo sus cambios localmente de forma segura. En cuanto se restablezca la conexión de red, todos sus registros se subirán automáticamente y se sincronizarán con los demás de manera transparente.
            </p>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: CARGA DE ARCHIVOS DE RED */}
      <NetworkUpload
        onUploadSuccess={onUploadSuccess}
        estructurasCount={estructurasCount}
        pmsCount={pmsCount}
        relacionesCount={relacionesCount}
        currentBaseData={currentBaseData}
      />
    </div>
  );
}
