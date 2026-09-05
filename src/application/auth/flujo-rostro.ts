import { FlujoAutenticacion } from './flujo-autenticacion';
import { FactorAutenticacion } from './factor-autenticacion';
import { FactorRostro } from './factor-rostro';

/** Creador que autentica con el rostro. */
export class FlujoRostro extends FlujoAutenticacion {
  protected crearFactor(): FactorAutenticacion {
    return new FactorRostro();
  }
}
