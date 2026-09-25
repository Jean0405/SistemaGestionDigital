import { EnviadorNotificaciones, ResultadoEnvio } from '../../application/notificaciones/enviador-notificaciones';
import { SmsLocalSDK } from './sms-local-sdk';

/** Adapta el SDK de SMS Local (enviarTexto, que lanza error) a la interfaz que el sistema entiende. */
export class AdaptadorSmsLocal implements EnviadorNotificaciones {
  constructor(private readonly sdk: SmsLocalSDK = new SmsLocalSDK()) {}

  enviar(destino: string, mensaje: string): ResultadoEnvio {
    try {
      const referencia = this.sdk.enviarTexto({ numero: destino, texto: mensaje });
      return { enviado: true, proveedor: 'sms-local', referencia };
    } catch {
      return { enviado: false, proveedor: 'sms-local', referencia: '' };
    }
  }
}
