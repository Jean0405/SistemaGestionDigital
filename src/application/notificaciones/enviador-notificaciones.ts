/** Lo que el sistema necesita para enviar un mensaje, sin importar el proveedor real. */
export interface EnviadorNotificaciones {
  enviar(destino: string, mensaje: string): ResultadoEnvio;
}

export interface ResultadoEnvio {
  enviado: boolean;
  proveedor: string;
  referencia: string;
}
