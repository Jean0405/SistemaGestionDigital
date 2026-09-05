import { FactorAutenticacion, ResultadoFactor } from './factor-autenticacion';

/** Factor que verifica el código enviado por SMS. */
export class FactorTokenTelefono implements FactorAutenticacion {
  public readonly nombre = 'token-telefono';
  private readonly validezMs = 5 * 60 * 1000;

  constructor(
    private readonly codigoEnviado: string,
    private readonly enviadoEn: number,
  ) {}

  public verificar(valorPresentado: string): ResultadoFactor {
    if (Date.now() - this.enviadoEn > this.validezMs) {
      return { superado: false, detalle: 'El código expiró; solicita uno nuevo.' };
    }

    const superado = valorPresentado === this.codigoEnviado;
    return {
      superado,
      detalle: superado ? 'Código válido.' : 'Código incorrecto.',
    };
  }
}
