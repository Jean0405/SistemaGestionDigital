import { Autenticador } from './autenticador';
import { ResultadoAutenticacion } from './flujo-autenticacion';

/** Decorador base: envuelve un autenticador y, por defecto, solo le delega el trabajo. */
export abstract class AutenticadorDecorador implements Autenticador {
  constructor(protected readonly interno: Autenticador) {}

  autenticar(valorPresentado: string): ResultadoAutenticacion {
    return this.interno.autenticar(valorPresentado);
  }
}
