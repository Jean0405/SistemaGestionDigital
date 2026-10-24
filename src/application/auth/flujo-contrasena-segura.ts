import { FlujoAutenticacion } from './flujo-autenticacion';
import { FactorAutenticacion } from './factor-autenticacion';
import { FactorContrasenaSegura } from './factor-contrasena-segura';

/**
 * Creador que autentica con una contraseña guardada como hash. Lo usan las
 * personas (su contraseña) y las entidades externas (su secreto de cliente).
 * Es un creador más del Factory Method: FlujoAutenticacion no se tocó.
 */
export class FlujoContrasenaSegura extends FlujoAutenticacion {
  constructor(private readonly hashRegistrado: string) {
    super();
  }

  protected crearFactor(): FactorAutenticacion {
    return new FactorContrasenaSegura(this.hashRegistrado);
  }
}
