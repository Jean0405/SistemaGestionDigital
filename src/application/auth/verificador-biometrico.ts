/**
 * Ejemplo de cómo el resto del sistema usa el Gestor de Configuración.
 *
 * Este verificador decide si una lectura biométrica es aceptable comparando
 * su puntaje de similitud contra el umbral mínimo definido en la
 * configuración. No recibe el umbral por parámetro ni lo tiene "quemado":
 * lo pide al Singleton, que es la única fuente de esa información.
 */
import { ConfigManager } from '../../infrastructure/config/config-manager';

export class VerificadorBiometrico {
  /**
   * @param puntajeSimilitud valor entre 0 y 1 devuelto por el lector biométrico
   * @returns true si el puntaje alcanza el umbral mínimo configurado
   */
  public esCoincidenciaValida(puntajeSimilitud: number): boolean {
    const umbral = ConfigManager.getInstance().obtener('biometriaUmbralMinimo');
    return puntajeSimilitud >= umbral;
  }
}
