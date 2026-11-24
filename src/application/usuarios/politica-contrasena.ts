/**
 * Strategy. La regla que debe cumplir una contraseña nueva cambia según
 * quién se registra: el administrador controla todo el sistema, así que se
 * le exige más. `ServicioUsuarios` (el contexto) usa la política sin saber
 * cuál es; agregar otra regla es crear otra clase, sin tocar el registro.
 */
export interface PoliticaContrasena {
  /** Cómo se le explica la regla a la persona. */
  readonly descripcion: string;
  cumple(contrasena: string): boolean;
}

/** Estrategia para ciudadanos: 8 caracteres o más, con letras y números. */
export class PoliticaContrasenaCiudadano implements PoliticaContrasena {
  readonly descripcion = 'al menos 8 caracteres, con letras y números';

  cumple(contrasena: string): boolean {
    return contrasena.length >= 8 && /\d/.test(contrasena) && /\p{L}/u.test(contrasena);
  }
}

/** Estrategia para administradores: 12 caracteres o más, con mayúsculas, minúsculas, números y un símbolo. */
export class PoliticaContrasenaAdministrador implements PoliticaContrasena {
  readonly descripcion = 'al menos 12 caracteres, con mayúsculas, minúsculas, números y un símbolo';

  cumple(contrasena: string): boolean {
    return (
      contrasena.length >= 12 &&
      /\p{Lu}/u.test(contrasena) &&
      /\p{Ll}/u.test(contrasena) &&
      /\d/.test(contrasena) &&
      /[^\p{L}\d\s]/u.test(contrasena)
    );
  }
}

/** Elige la estrategia según el rol con el que la persona va a quedar. */
export function politicaPara(rol: string): PoliticaContrasena {
  return rol === 'administrador' ? new PoliticaContrasenaAdministrador() : new PoliticaContrasenaCiudadano();
}
