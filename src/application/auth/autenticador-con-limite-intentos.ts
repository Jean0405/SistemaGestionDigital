import { Autenticador } from './autenticador';
import { AutenticadorDecorador } from './autenticador-decorador';
import { ResultadoAutenticacion } from './flujo-autenticacion';

/** Bloquea el factor tras varios intentos fallidos seguidos, para frenar fuerza bruta. */
export class AutenticadorConLimiteIntentos extends AutenticadorDecorador {
  private fallosSeguidos = 0;

  constructor(interno: Autenticador, private readonly maximoFallos = 3) {
    super(interno);
  }

  autenticar(valorPresentado: string): ResultadoAutenticacion {
    if (this.fallosSeguidos >= this.maximoFallos) {
      return { factor: 'bloqueado', autenticado: false, motivo: 'Demasiados intentos fallidos; factor bloqueado.' };
    }

    const resultado = super.autenticar(valorPresentado);
    this.fallosSeguidos = resultado.autenticado ? 0 : this.fallosSeguidos + 1;
    return resultado;
  }
}
