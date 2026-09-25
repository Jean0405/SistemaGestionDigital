import { Notificacion } from './notificacion';
import { ResultadoEnvio } from './enviador-notificaciones';

/** Marca el mensaje como urgente y reintenta una vez si el canal falla. */
export class NotificacionUrgente extends Notificacion {
  enviar(destino: string, mensaje: string): ResultadoEnvio {
    const mensajeUrgente = `URGENTE: ${mensaje}`;
    const primerIntento = this.canal.enviar(destino, mensajeUrgente);
    if (primerIntento.enviado) return primerIntento;

    return this.canal.enviar(destino, mensajeUrgente);
  }
}
