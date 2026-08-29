/**
 * Punto de arranque de ejemplo.
 *
 * Muestra que dos partes distintas del sistema piden la configuración
 * y reciben siempre la misma instancia y los mismos valores.
 */
import { ConfigManager } from './infrastructure/config/config-manager';
import { VerificadorBiometrico } from './application/auth/verificador-biometrico';

const config = ConfigManager.getInstance();
console.log(`SGID iniciando en entorno "${config.obtener('entorno')}"`);
console.log(`API escuchará en el puerto ${config.obtener('puertoApi')}`);

const verificador = new VerificadorBiometrico();
console.log('¿Lectura biométrica de 0.90 es válida?', verificador.esCoincidenciaValida(0.9));
console.log('¿Lectura biométrica de 0.70 es válida?', verificador.esCoincidenciaValida(0.7));
