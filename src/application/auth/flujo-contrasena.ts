import { FlujoAutenticacion } from './flujo-autenticacion';
import { FactorAutenticacion } from './factor-autenticacion';
import { FactorContrasena } from './factor-contrasena';

/** Creador que autentica con la contraseña. */
export class FlujoContrasena extends FlujoAutenticacion {
  constructor(private readonly contrasenaRegistrada: string) {
    super();
  }

  protected crearFactor(): FactorAutenticacion {
    return new FactorContrasena(this.contrasenaRegistrada);
  }
}
