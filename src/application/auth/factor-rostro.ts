import { FactorAutenticacion, ResultadoFactor } from './factor-autenticacion';
import { ConfigManager } from '../../infrastructure/config/config-manager';

/**
 * Factor que compara el puntaje del sensor facial contra el
 * umbral, que llega del Gestor de Configuración (Singleton de la ETAPA 2).
 */
export class FactorRostro implements FactorAutenticacion {
  public readonly nombre = 'rostro';

  public verificar(valorPresentado: string): ResultadoFactor {
    const puntaje = Number(valorPresentado);
    if (Number.isNaN(puntaje) || puntaje < 0 || puntaje > 1) {
      return { superado: false, detalle: 'Puntaje facial inválido (debe estar entre 0 y 1).' };
    }

    const umbral = ConfigManager.getInstance().obtener('biometriaUmbralMinimo');
    const superado = puntaje >= umbral;
    return {
      superado,
      detalle: superado
        ? 'Rostro reconocido.'
        : `Coincidencia facial insuficiente: ${puntaje.toFixed(2)} < umbral ${umbral}.`,
    };
  }
}
