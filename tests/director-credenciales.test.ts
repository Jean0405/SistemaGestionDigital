/** Pruebas del Director: arma credenciales completas con recetas por rol. */
import { ConfigManager } from '../src/infrastructure/config/config-manager';
import { DirectorCredenciales } from '../src/application/credencial/director-credenciales';

describe('DirectorCredenciales', () => {
  const envOriginal = { ...process.env };
  const director = new DirectorCredenciales();

  beforeEach(() => {
    ConfigManager.reiniciar();
    process.env = { ...envOriginal, NODE_ENV: 'test', JWT_SECRET: 'secreto-de-pruebas-1234' };
  });

  afterAll(() => {
    process.env = envOriginal;
    ConfigManager.reiniciar();
  });

  // Valida que cada receta arma el rol y los permisos que le corresponden.
  test('cada receta arma el rol y los permisos que le corresponden', () => {
    const ciudadano = director.construirCredencialCiudadano('u1', 'Ana', ['contraseña']);
    const admin = director.construirCredencialAdministrador('u2', 'Luis', ['contraseña', 'rostro']);
    const externa = director.construirCredencialEntidadExterna('u3', 'RUES', ['token-telefono']);

    expect(ciudadano.rol).toBe('ciudadano');
    expect(admin.permisos).toContain('gestionar-roles');
    expect(externa.permisos).toEqual(['validar-identidad-externa']);
  });

  // Valida que dos credenciales seguidas no se mezclan entre sí.
  test('dos credenciales seguidas quedan independientes', () => {
    const uno = director.construirCredencialCiudadano('u1', 'Ana', ['contraseña']);
    const dos = director.construirCredencialAdministrador('u2', 'Luis', ['rostro']);

    expect(uno.usuarioId).not.toBe(dos.usuarioId);
    expect(uno.permisos).not.toEqual(dos.permisos);
  });
});
