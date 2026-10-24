import { FactorAutenticacion, ResultadoFactor } from './factor-autenticacion';
import { verificarHash } from '../../infrastructure/seguridad/criptografia';

/** Factor que compara contra el hash guardado, nunca contra la contraseña en claro. */
export class FactorContrasenaSegura implements FactorAutenticacion {
  public readonly nombre = 'contraseña';

  constructor(private readonly hashRegistrado: string) {}

  public verificar(valorPresentado: string): ResultadoFactor {
    const superado = verificarHash(valorPresentado, this.hashRegistrado);
    return {
      superado,
      detalle: superado ? 'Contraseña correcta.' : 'Contraseña incorrecta.',
    };
  }
}
