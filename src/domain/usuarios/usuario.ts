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

/** Servicio del Estado que usa SGID como su forma de iniciar sesión ("Iniciar sesión con SGID"). */
export interface ServicioConectado {
  clienteId: string;
  nombre: string;
  /** A dónde SGID devuelve a la persona después de autenticarse. */
  urlRetorno: string;
  /** Solo se guarda el hash; el secreto en claro se muestra una única vez. */
  secretoHash: string;
  activo: boolean;
  creadoEn: number;
}
