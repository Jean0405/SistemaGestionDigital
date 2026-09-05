/**
 * Factory Method. `FlujoAutenticacion` (el Creador) define el procedimiento
 * común para validar un factor y delega en `crearFactor()` cuál usar.
 * Sumar un factor nuevo es crear una subclase; este archivo no se toca.
 */
import { FactorAutenticacion } from './factor-autenticacion';

export interface ResultadoAutenticacion {
  factor: string;
  autenticado: boolean;
  motivo: string;
}

export abstract class FlujoAutenticacion {
  /** Factory Method: cada subclase devuelve su factor. */
  protected abstract crearFactor(): FactorAutenticacion;

  /** Procedimiento fijo: igual para todos los factores. */
  public autenticar(valorPresentado: string): ResultadoAutenticacion {
    const factor = this.crearFactor();
    const entrada = valorPresentado.trim();

    if (entrada === '') {
      return {
        factor: factor.nombre,
        autenticado: false,
        motivo: 'No se recibió ningún valor para verificar.',
      };
    }

    const resultado = factor.verificar(entrada);
    return {
      factor: factor.nombre,
      autenticado: resultado.superado,
      motivo: resultado.detalle,
    };
  }
}
