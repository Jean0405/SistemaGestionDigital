/** Pruebas de cada factor (los "Productos" del Factory Method) por separado. */
import { ConfigManager } from '../src/infrastructure/config/config-manager';
import { FactorContrasena } from '../src/application/auth/factor-contrasena';
import { FactorTokenTelefono } from '../src/application/auth/factor-token-telefono';
import { FactorRostro } from '../src/application/auth/factor-rostro';

// Valida la regla del factor de contraseña: comparación exacta contra la registrada.
test('la contraseña se acepta solo si coincide con la registrada', () => {
  const factor = new FactorContrasena('clave-secreta');
  expect(factor.verificar('clave-secreta').superado).toBe(true);
  expect(factor.verificar('otra').superado).toBe(false);
});

// Valida que el factor de token revisa el código y también su vencimiento.
test('el token vale solo si es el enviado y todavía no expiró', () => {
  expect(new FactorTokenTelefono('123456', Date.now()).verificar('123456').superado).toBe(true);
  expect(new FactorTokenTelefono('123456', Date.now()).verificar('000000').superado).toBe(false);

  const expirado = new FactorTokenTelefono('123456', Date.now() - 10 * 60 * 1000);
  expect(expirado.verificar('123456').superado).toBe(false);
});

// Valida que el factor de rostro no tiene el umbral fijo: lo toma del Singleton (ETAPA 2).
test('el rostro se mide contra el umbral que entrega el Singleton de configuración', () => {
  ConfigManager.reiniciar();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'secreto-de-pruebas-1234';
  process.env.BIOMETRIA_UMBRAL = '0.85';

  expect(new FactorRostro().verificar('0.9').superado).toBe(true);
  expect(new FactorRostro().verificar('0.7').superado).toBe(false);

  ConfigManager.reiniciar();
});
