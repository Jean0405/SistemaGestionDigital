/** Pruebas del Adapter: dos SDKs con formas distintas, una sola interfaz de salida. */
import { AdaptadorSmsGlobal } from '../src/infrastructure/notificaciones/adaptador-sms-global';
import { AdaptadorSmsLocal } from '../src/infrastructure/notificaciones/adaptador-sms-local';
import { EnviadorNotificaciones } from '../src/application/notificaciones/enviador-notificaciones';

// Valida que el adaptador traduce la respuesta { status, id } del SDK Global a la interfaz común.
test('AdaptadorSmsGlobal traduce el éxito y el fallo del SDK a ResultadoEnvio', () => {
  const adaptador = new AdaptadorSmsGlobal();
  expect(adaptador.enviar('3001234567', 'hola').enviado).toBe(true);
  expect(adaptador.enviar('', 'hola').enviado).toBe(false);
});

// Valida que el adaptador traduce el string de éxito y la excepción del SDK Local a la misma interfaz.
test('AdaptadorSmsLocal traduce el éxito y la excepción del SDK a ResultadoEnvio', () => {
  const adaptador = new AdaptadorSmsLocal();
  expect(adaptador.enviar('3001234567', 'hola').enviado).toBe(true);
  expect(adaptador.enviar('', 'hola').enviado).toBe(false);
});

// Valida el beneficio del patrón: cualquier adaptador se usa igual sin saber qué proveedor hay detrás.
test('los dos adaptadores se usan de forma intercambiable', () => {
  const canales: EnviadorNotificaciones[] = [new AdaptadorSmsGlobal(), new AdaptadorSmsLocal()];
  const resultados = canales.map((c) => c.enviar('3001234567', 'tu código es 1234'));

  expect(resultados.every((r) => r.enviado)).toBe(true);
  expect(resultados.map((r) => r.proveedor)).toEqual(['sms-global', 'sms-local']);
});
