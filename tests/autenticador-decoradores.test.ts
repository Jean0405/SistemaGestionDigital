/** Pruebas del Decorator: envolver un autenticador sin tocar el original. */
import { FlujoContrasena } from '../src/application/auth/flujo-contrasena';
import { AutenticadorConBitacora } from '../src/application/auth/autenticador-con-bitacora';
import { AutenticadorConLimiteIntentos } from '../src/application/auth/autenticador-con-limite-intentos';

// Valida que la bitácora registra cada intento sin cambiar el resultado del autenticador original.
test('AutenticadorConBitacora registra cada intento', () => {
  const autenticador = new AutenticadorConBitacora(new FlujoContrasena('clave-real'));

  expect(autenticador.autenticar('clave-real').autenticado).toBe(true);
  expect(autenticador.autenticar('clave-falsa').autenticado).toBe(false);
  expect(autenticador.bitacora).toHaveLength(2);
});

// Valida que bloquea tras varios fallos seguidos, incluso si luego llega la contraseña correcta.
test('AutenticadorConLimiteIntentos bloquea tras varios fallos seguidos', () => {
  const autenticador = new AutenticadorConLimiteIntentos(new FlujoContrasena('clave-real'), 2);

  autenticador.autenticar('mal');
  autenticador.autenticar('mal');
  const bloqueado = autenticador.autenticar('clave-real');

  expect(bloqueado.autenticado).toBe(false);
  expect(bloqueado.motivo).toMatch(/bloqueado/i);
});

// Valida que los decoradores se pueden apilar entre sí sin que el flujo original se entere.
test('los decoradores se pueden combinar entre sí', () => {
  const autenticador = new AutenticadorConBitacora(
    new AutenticadorConLimiteIntentos(new FlujoContrasena('clave-real'), 3),
  );

  autenticador.autenticar('clave-real');
  expect(autenticador.bitacora).toHaveLength(1);
});
