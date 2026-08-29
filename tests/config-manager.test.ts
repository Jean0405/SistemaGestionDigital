/**
 * Pruebas del Gestor de Configuración (patrón Singleton).
 *
 * Se comprueba lo esencial del patrón:
 *  - siempre se obtiene la misma instancia,
 *  - la configuración se carga una sola vez,
 *  - los valores no se pueden modificar,
 *  - la validación rechaza configuraciones incorrectas.
 */
import { ConfigManager } from '../src/infrastructure/config/config-manager';

describe('ConfigManager (Singleton)', () => {
  // Guardamos las variables de entorno originales para restaurarlas al final.
  const envOriginal = { ...process.env };

  beforeEach(() => {
    ConfigManager.reiniciar();
    process.env = { ...envOriginal, NODE_ENV: 'test', JWT_SECRET: 'secreto-de-pruebas-1234' };
  });

  afterAll(() => {
    process.env = envOriginal;
    ConfigManager.reiniciar();
  });

  test('getInstance() devuelve siempre la misma instancia', () => {
    const a = ConfigManager.getInstance();
    const b = ConfigManager.getInstance();

    expect(a).toBe(b);
  });

  test('la configuración se lee una sola vez, aunque cambie el entorno después', () => {
    process.env.API_PORT = '4000';
    const primera = ConfigManager.getInstance();
    expect(primera.obtener('puertoApi')).toBe(4000);

    // Cambiamos la variable de entorno luego de crear la instancia.
    process.env.API_PORT = '9999';
    const segunda = ConfigManager.getInstance();

    // Sigue entregando el valor cargado la primera vez.
    expect(segunda.obtener('puertoApi')).toBe(4000);
  });

  test('aplica valores por defecto cuando no hay variables de entorno', () => {
    delete process.env.API_PORT;
    delete process.env.BIOMETRIA_UMBRAL;

    const config = ConfigManager.getInstance().obtenerTodo();

    expect(config.puertoApi).toBe(3000);
    expect(config.biometriaUmbralMinimo).toBe(0.85);
    expect(config.db.host).toBe('localhost');
  });

  test('los valores de configuración no se pueden modificar', () => {
    const config = ConfigManager.getInstance().obtenerTodo();

    expect(() => {
      (config as { puertoApi: number }).puertoApi = 1;
    }).toThrow();

    expect(Object.isFrozen(config)).toBe(true);
  });

  test('reiniciar() permite crear una instancia nueva con otra configuración', () => {
    process.env.API_PORT = '3000';
    const antes = ConfigManager.getInstance();
    expect(antes.obtener('puertoApi')).toBe(3000);

    ConfigManager.reiniciar();
    process.env.API_PORT = '5000';
    const despues = ConfigManager.getInstance();

    expect(despues).not.toBe(antes);
    expect(despues.obtener('puertoApi')).toBe(5000);
  });

  test('rechaza un puerto inválido', () => {
    process.env.API_PORT = 'abc';
    expect(() => ConfigManager.getInstance()).toThrow(/API_PORT/);
  });

  test('rechaza un secreto de token demasiado corto', () => {
    process.env.JWT_SECRET = 'corto';
    expect(() => ConfigManager.getInstance()).toThrow(/JWT_SECRET/);
  });

  test('rechaza un umbral biométrico fuera del rango 0 a 1', () => {
    process.env.BIOMETRIA_UMBRAL = '1.5';
    expect(() => ConfigManager.getInstance()).toThrow(/BIOMETRIA_UMBRAL/);
  });

  test('en producción exige un JWT_SECRET propio', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => ConfigManager.getInstance()).toThrow(/producción/);
  });
});
