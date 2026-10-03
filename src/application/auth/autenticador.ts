import { ResultadoAutenticacion } from './flujo-autenticacion';

/** Lo mínimo para autenticar. Cualquier FlujoAutenticacion ya lo cumple, sin tocarle nada. */
export interface Autenticador {
  autenticar(valorPresentado: string): ResultadoAutenticacion;
}
