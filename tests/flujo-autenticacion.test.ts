/** Pruebas del Factory Method: el creador `FlujoAutenticacion` y sus subclases. */
import { ConfigManager } from '../src/infrastructure/config/config-manager';
import { FlujoAutenticacion } from '../src/application/auth/flujo-autenticacion';
import { FlujoContrasena } from '../src/application/auth/flujo-contrasena';
import { FlujoTokenTelefono } from '../src/application/auth/flujo-token-telefono';
import { FlujoRostro } from '../src/application/auth/flujo-rostro';

describe('FlujoAutenticacion (Factory Method)', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    ConfigManager.reiniciar();
    process.env = {
      ...envOriginal,
      NODE_ENV: 'test',
      JWT_SECRET: 'secreto-de-pruebas-1234',
      BIOMETRIA_UMBRAL: '0.85',
    };
  });

  afterAll(() => {
    process.env = envOriginal;
    ConfigManager.reiniciar();
  });

  // Valida el corazón del patrón: crearFactor() devuelve el producto correcto en cada subclase.
  test('cada subclase construye el factor que le corresponde', () => {
    expect(new FlujoContrasena('x').autenticar('x').factor).toBe('contraseña');
    expect(new FlujoTokenTelefono('1', Date.now()).autenticar('1').factor).toBe('token-telefono');
    expect(new FlujoRostro().autenticar('0.9').factor).toBe('rostro');
  });

  // Valida el paso común del creador, igual para todos los factores.
  test('el procedimiento común rechaza una entrada vacía sin ejecutar el factor', () => {
    const r = new FlujoContrasena('clave').autenticar('   ');
    expect(r.autenticado).toBe(false);
    expect(r.motivo).toMatch(/ningún valor/i);
  });

  // Valida que Factory Method y Singleton encajan: el flujo respeta la config vigente.
  test('si baja el umbral en la configuración, el flujo de rostro cambia su decisión', () => {
    expect(new FlujoRostro().autenticar('0.8').autenticado).toBe(false);

    ConfigManager.reiniciar();
    process.env.BIOMETRIA_UMBRAL = '0.7';
    expect(new FlujoRostro().autenticar('0.8').autenticado).toBe(true);
  });

  // Valida el beneficio del patrón: un mismo código recorre flujos distintos.
  test('los tres flujos se usan de forma polimórfica en un intento multifactor', () => {
    const flujos: FlujoAutenticacion[] = [
      new FlujoContrasena('clave'),
      new FlujoTokenTelefono('482913', Date.now()),
      new FlujoRostro(),
    ];
    const respuestas = ['clave', '482913', '0.95'];

    const todos = flujos.map((f, i) => f.autenticar(respuestas[i]).autenticado);
    expect(todos).toEqual([true, true, true]);
  });
});
