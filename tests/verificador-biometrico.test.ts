/**
 * Prueba que muestra cómo otra parte del sistema depende del Singleton.
 *
 * El VerificadorBiometrico no sabe de dónde sale el umbral: lo toma del
 * Gestor de Configuración. Cambiando la configuración cambia su resultado.
 */
import { ConfigManager } from '../src/infrastructure/config/config-manager';
import { VerificadorBiometrico } from '../src/application/auth/verificador-biometrico';

describe('VerificadorBiometrico + ConfigManager', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    ConfigManager.reiniciar();
    process.env = { ...envOriginal, NODE_ENV: 'test', JWT_SECRET: 'secreto-de-pruebas-1234' };
  });

  afterAll(() => {
    process.env = envOriginal;
    ConfigManager.reiniciar();
  });

  test('acepta el puntaje cuando alcanza el umbral configurado', () => {
    process.env.BIOMETRIA_UMBRAL = '0.85';
    const verificador = new VerificadorBiometrico();

    expect(verificador.esCoincidenciaValida(0.9)).toBe(true);
    expect(verificador.esCoincidenciaValida(0.85)).toBe(true);
  });

  test('rechaza el puntaje cuando no alcanza el umbral configurado', () => {
    process.env.BIOMETRIA_UMBRAL = '0.85';
    const verificador = new VerificadorBiometrico();

    expect(verificador.esCoincidenciaValida(0.8)).toBe(false);
  });

  test('si cambia el umbral en la configuración, cambia la decisión', () => {
    process.env.BIOMETRIA_UMBRAL = '0.6';
    const verificador = new VerificadorBiometrico();

    expect(verificador.esCoincidenciaValida(0.7)).toBe(true);
  });
});
