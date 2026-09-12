/** Credencial digital emitida a un usuario tras autenticarse. Es el "Producto" del Builder. */
export interface CredencialDigital {
  usuarioId: string;
  nombreCompleto: string;
  rol: string;
  permisos: string[];
  factoresSuperados: string[];
  emitidaEn: number;
  expiraEn: number;
}
