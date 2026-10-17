/** Datos de identidad de un ciudadano, tal como los guarda el sistema. */
export interface DatosIdentidad {
  usuarioId: string;
  nombreCompleto: string;
  documento: string;
}

/** Sujeto (interfaz): lo que cualquiera que consulte identidades necesita. */
export interface RepositorioIdentidad {
  obtener(usuarioId: string): DatosIdentidad;
}
