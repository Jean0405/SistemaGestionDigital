/** Persona registrada, con lo necesario para autenticarla con sus tres factores. */
export interface Usuario {
  usuarioId: string;
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  correo: string | null;
  rol: string;
  contrasenaHash: string;
  descriptorRostro: number[];
  creadoEn: number;
}

/** Sistema de otra entidad del Estado autorizado a usar la API de integración. */
export interface EntidadExterna {
  clienteId: string;
  nombre: string;
  rol: string;
  /** Solo se guarda el hash; el secreto en claro se muestra una única vez. */
  secretoHash: string;
  activa: boolean;
  creadaEn: number;
}
