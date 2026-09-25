import { Notificacion } from './notificacion';
import { ResultadoEnvio } from './enviador-notificaciones';

/** Envía el mensaje tal cual, por el canal que le hayan dado. */
export class NotificacionSimple extends Notificacion {
  enviar(destino: string, mensaje: string): ResultadoEnvio {
    return this.canal.enviar(destino, mensaje);
  }
}
