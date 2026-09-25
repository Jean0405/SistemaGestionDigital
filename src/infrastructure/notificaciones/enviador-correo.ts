import { EnviadorNotificaciones, ResultadoEnvio } from '../../application/notificaciones/enviador-notificaciones';

/** Canal de correo electrónico. No adapta ningún SDK externo, pero cumple el mismo puerto. */
export class EnviadorCorreo implements EnviadorNotificaciones {
  enviar(destino: string, mensaje: string): ResultadoEnvio {
    const enviado = destino.includes('@');
    return {
      enviado,
      proveedor: 'correo',
      referencia: enviado ? `mail-${Date.now()}` : '',
    };
  }
}
