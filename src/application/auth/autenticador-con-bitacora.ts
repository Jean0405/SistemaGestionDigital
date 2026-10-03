import { AutenticadorDecorador } from './autenticador-decorador';
import { ResultadoAutenticacion } from './flujo-autenticacion';

/** Agrega un registro de auditoría de cada intento, sin tocar el autenticador original. */
export class AutenticadorConBitacora extends AutenticadorDecorador {
  public readonly bitacora: string[] = [];

  autenticar(valorPresentado: string): ResultadoAutenticacion {
    const resultado = super.autenticar(valorPresentado);
    this.bitacora.push(`[${resultado.factor}] autenticado=${resultado.autenticado} · ${resultado.motivo}`);
    return resultado;
  }
}
