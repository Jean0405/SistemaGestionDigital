import { FactorAutenticacion, ResultadoFactor } from './factor-autenticacion';

/** Factor que compara con la contraseña registrada */
export class FactorContrasena implements FactorAutenticacion {
  public readonly nombre = 'contraseña';

  constructor(private readonly contrasenaRegistrada: string) {}

  public verificar(valorPresentado: string): ResultadoFactor {
    const superado = valorPresentado === this.contrasenaRegistrada;
    return {
      superado,
      detalle: superado ? 'Contraseña correcta.' : 'Contraseña incorrecta.',
    };
  }
}
