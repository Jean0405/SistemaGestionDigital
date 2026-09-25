import { EnviadorNotificaciones, ResultadoEnvio } from './enviador-notificaciones';

/** Abstracción del Bridge: un tipo de notificación, sin saber por qué canal viaja. */
export abstract class Notificacion {
  constructor(protected readonly canal: EnviadorNotificaciones) {}

  abstract enviar(destino: string, mensaje: string): ResultadoEnvio;
}
