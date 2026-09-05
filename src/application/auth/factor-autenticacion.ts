/**
 * Un factor de autenticación: una forma de comprobar la identidad.
 * El sistema combina tres (contraseña, token al teléfono y rostro).
 *
 * Es el "Producto" del patrón Factory Method.
 */
export interface FactorAutenticacion {
  readonly nombre: string;
  verificar(valorPresentado: string): ResultadoFactor;
}

export interface ResultadoFactor {
  superado: boolean;
  detalle: string;
}
