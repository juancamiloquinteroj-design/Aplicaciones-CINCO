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
  componente: "CTs" | "PTs" | "Medidor" | "Cableado" | "Telemedida" | "Para Revisión" | "Instalación";
  detalle: string;
  fechaReporte: string;
  observaciones: string;
  fechaReparacion: string; // YYYY-MM-DD o "Sin definir"
  vecesReprogramada: number;
  prioridad?: "Normal" | "Alta";
}

export interface Intervencion {
  id: string;
  fecha: string; // ISO string o YYYY-MM-DD
  descripcion: string;
  tecnico: string;
  fallasCorregidas: {
    id: string;
    componente: string;
    detalle: string;
  }[];
  fallasPendientes: {
    id: string;
    componente: string;
    detalle: string;
  }[];
}

export interface PM {
  id: string; // Firestore ID
  codigoPM: string;
  nombrePM: string;
  estadoGral: "Ok" | "En falla" | "Instalación" | "Para Revisión" | "Revisado";
  revisado?: boolean;
  prioridad?: "Normal" | "Alta";
  estructuras: string[];
  activeFailures: ActiveFailure[];
  intervenciones: Intervencion[];
  createdAt: string;
  updatedAt: string;
}
