export interface Estructura {
  tipo: string;
  zona: string;
  nivel: string;
}

export interface PMBase {
  nombre: string;
  estructuras: string[];
}

export interface RelacionTransformacion {
  nemonico: string;
  cuenta?: string;
  ct?: string;
  fCt?: string;
  pt?: string;
  fPt?: string;
  medidor?: string;
  marcaMedidor?: string;
  tipoMedidor?: string;
  clase?: string;
  factorSistema?: string;
  comunicacion?: string;
  dirIp?: string;
}

export interface ActiveFailure {
  id: string;
  componente: "CTs" | "PTs" | "Medidor" | "Cableado" | "Telemedida" | "Compacto" | "Para Revisión" | "Instalación";
  detalle: string;
  fechaReporte: string;
  observaciones: string;
  fechaReparacion: string; // YYYY-MM-DD o "Sin definir"
  vecesReprogramada: number;
  prioridad?: "Normal" | "Alta";
}

export interface IntervencionFalla {
  id: string;
  componente: string;
  detalle: string;
  fechaReporte?: string;
  observaciones?: string;
  fechaReparacion?: string;
  vecesReprogramada?: number;
  prioridad?: "Normal" | "Alta";
}

export interface IntervencionSnapshotPrevio {
  estadoGral: "Ok" | "En falla" | "Instalación" | "Para Revisión" | "Revisado" | "Seguimiento";
  revisado?: boolean;
  prioridad?: "Normal" | "Alta";
  loQueQuedoPendiente?: string;
  activeFailures: ActiveFailure[];
}

export interface Intervencion {
  id: string;
  fecha: string; // ISO string o YYYY-MM-DD
  descripcion: string;
  tecnico: string;
  fallasCorregidas: IntervencionFalla[];
  fallasPendientes: IntervencionFalla[];
  resultado?: "Corregido" | "Seguimiento";
  loQueQuedoPendiente?: string;
  proximaRevision?: string;
  snapshotPrevio?: IntervencionSnapshotPrevio;
  devueltaAPendientes?: boolean;
}

export interface PM {
  id: string; // Firestore ID
  codigoPM: string;
  nombrePM: string;
  estadoGral: "Ok" | "En falla" | "Instalación" | "Para Revisión" | "Revisado" | "Seguimiento";
  revisado?: boolean;
  prioridad?: "Normal" | "Alta";
  estructuras: string[];
  activeFailures: ActiveFailure[];
  intervenciones: Intervencion[];
  loQueQuedoPendiente?: string;
  ultimoReporteTecnico?: {
    fecha: string;
    tecnico: string;
    descripcion: string;
    loQueQuedoPendiente?: string;
  };
  createdAt: string;
  updatedAt: string;
}
