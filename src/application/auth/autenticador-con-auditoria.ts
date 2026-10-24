import { Autenticador } from './autenticador';
import { AutenticadorDecorador } from './autenticador-decorador';
import { ResultadoAutenticacion } from './flujo-autenticacion';
import { BitacoraAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';

/**
 * Deja cada intento en la bitácora de auditoría permanente, a diferencia de
 * AutenticadorConBitacora, que solo la guarda en memoria. Nunca registra lo
 * que la persona escribió, solo el resultado.
 */
export class AutenticadorConAuditoria extends AutenticadorDecorador {
  constructor(
    interno: Autenticador,
    private readonly auditoria: BitacoraAuditoria,
    private readonly actor: string,
    private readonly factor: string,
  ) {
    super(interno);
  }

  autenticar(valorPresentado: string): ResultadoAutenticacion {
    const resultado = super.autenticar(valorPresentado);
    this.auditoria.registrar({
      actor: this.actor,
      accion: `autenticacion.${this.factor}`,
      resultado: resultado.autenticado ? 'exito' : resultado.factor === 'bloqueado' ? 'denegado' : 'fallo',
      detalle: resultado.motivo,
    });
    return resultado;
  }
}
