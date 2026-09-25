/** Pruebas del Bridge: el tipo de notificación y el canal varían por separado. */
import { EnviadorNotificaciones, ResultadoEnvio } from '../src/application/notificaciones/enviador-notificaciones';
import { NotificacionSimple } from '../src/application/notificaciones/notificacion-simple';
import { NotificacionUrgente } from '../src/application/notificaciones/notificacion-urgente';
import { AdaptadorSmsGlobal } from '../src/infrastructure/notificaciones/adaptador-sms-global';
import { EnviadorCorreo } from '../src/infrastructure/notificaciones/enviador-correo';

/** Canal falso que guarda los mensajes recibidos y puede fallar los primeros N intentos. */
class CanalDePrueba implements EnviadorNotificaciones {
  public mensajes: string[] = [];
  private intentos = 0;

  constructor(private readonly fallosIniciales = 0) {}

  enviar(_destino: string, mensaje: string): ResultadoEnvio {
    this.mensajes.push(mensaje);
    this.intentos += 1;
    return { enviado: this.intentos > this.fallosIniciales, proveedor: 'prueba', referencia: mensaje };
  }
}

// Valida que la misma abstracción funciona igual sin importar el canal (Adapter de la ETAPA 5 o correo).
test('NotificacionSimple funciona igual con cualquier canal', () => {
  const porSms = new NotificacionSimple(new AdaptadorSmsGlobal());
  const porCorreo = new NotificacionSimple(new EnviadorCorreo());

  expect(porSms.enviar('3001234567', 'hola').enviado).toBe(true);
  expect(porCorreo.enviar('ana@sgid.gov', 'hola').enviado).toBe(true);
});

// Valida que la urgente le agrega el prefijo al mensaje antes de enviarlo.
test('NotificacionUrgente antepone "URGENTE:" al mensaje', () => {
  const canal = new CanalDePrueba();
  new NotificacionUrgente(canal).enviar('3001234567', 'código 1234');

  expect(canal.mensajes[0]).toBe('URGENTE: código 1234');
});

// Valida el reintento: si el canal falla la primera vez, la urgente lo intenta una vez más.
test('NotificacionUrgente reintenta una vez si el canal falla', () => {
  const canal = new CanalDePrueba(1);
  const resultado = new NotificacionUrgente(canal).enviar('3001234567', 'código 1234');

  expect(resultado.enviado).toBe(true);
  expect(canal.mensajes).toHaveLength(2);
});
