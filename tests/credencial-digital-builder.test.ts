/** Pruebas del Builder: arma la CredencialDigital paso a paso. */
import { ConfigManager } from '../src/infrastructure/config/config-manager';
import { CredencialDigitalBuilder } from '../src/application/credencial/credencial-digital-builder';

describe('CredencialDigitalBuilder', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    ConfigManager.reiniciar();
    process.env = { ...envOriginal, NODE_ENV: 'test', JWT_SECRET: 'secreto-de-pruebas-1234' };
  });

  afterAll(() => {
    process.env = envOriginal;
    ConfigManager.reiniciar();
  });

  // Valida que el builder acumula lo que se le agrega paso a paso.
  test('arma la credencial con los datos, permisos y factores acumulados', () => {
    const credencial = new CredencialDigitalBuilder()
      .establecerUsuario('u1', 'Ana Pérez')
      .establecerRol('ciudadano')
      .agregarFactorSuperado('contraseña')
      .agregarFactorSuperado('rostro')
      .agregarPermiso('consultar-identidad')
      .obtenerCredencial();

    expect(credencial.usuarioId).toBe('u1');
    expect(credencial.factoresSuperados).toEqual(['contraseña', 'rostro']);
    expect(credencial.permisos).toEqual(['consultar-identidad']);
  });

  // Valida que no se arma un producto incompleto.
  test('no entrega la credencial si falta usuario, rol o factores', () => {
    expect(() => new CredencialDigitalBuilder().obtenerCredencial()).toThrow(/usuario/i);
    expect(() =>
      new CredencialDigitalBuilder().establecerUsuario('u1', 'Ana').obtenerCredencial(),
    ).toThrow(/rol/i);
    expect(() =>
      new CredencialDigitalBuilder().establecerUsuario('u1', 'Ana').establecerRol('ciudadano').obtenerCredencial(),
    ).toThrow(/factor/i);
  });

  // Valida que la vigencia sale del Singleton de configuración, no de un número fijo aquí.
  test('la expiración usa los minutos configurados en el Singleton', () => {
    process.env.JWT_EXPIRACION_MIN = '30';
    const credencial = new CredencialDigitalBuilder()
      .establecerUsuario('u1', 'Ana')
      .establecerRol('ciudadano')
      .agregarFactorSuperado('contraseña')
      .obtenerCredencial();

    expect(credencial.expiraEn - credencial.emitidaEn).toBe(30 * 60_000);
  });
});
