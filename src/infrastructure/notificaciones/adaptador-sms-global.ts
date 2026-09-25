import { EnviadorNotificaciones, ResultadoEnvio } from '../../application/notificaciones/enviador-notificaciones';
import { SmsGlobalSDK } from './sms-global-sdk';

/** Adapta el SDK de SMS Global (sendMessage) a la interfaz que el sistema entiende. */
export class AdaptadorSmsGlobal implements EnviadorNotificaciones {
  constructor(private readonly sdk: SmsGlobalSDK = new SmsGlobalSDK()) {}

  enviar(destino: string, mensaje: string): ResultadoEnvio {
    const respuesta = this.sdk.sendMessage(destino, mensaje);
    return {
      enviado: respuesta.status === 'SENT',
      proveedor: 'sms-global',
      referencia: respuesta.id,
    };
  }
}
