import { FlujoAutenticacion } from './flujo-autenticacion';
import { FactorAutenticacion } from './factor-autenticacion';
import { FactorTokenTelefono } from './factor-token-telefono';

/** Creador que autentica con el token enviado al teléfono. */
export class FlujoTokenTelefono extends FlujoAutenticacion {
  constructor(
    private readonly codigoEnviado: string,
    private readonly enviadoEn: number,
  ) {
    super();
  }

  protected crearFactor(): FactorAutenticacion {
    return new FactorTokenTelefono(this.codigoEnviado, this.enviadoEn);
  }
}
