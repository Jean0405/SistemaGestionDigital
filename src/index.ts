/**
 * Demostración ejecutable.
 * ETAPA 2: Singleton (Gestor de Configuración).
 * ETAPA 3: Factory Method (autenticación multifactor).
 * ETAPA 4: Builder (emisión de la credencial digital).
 * ETAPA 5: Adapter (envío de SMS con dos proveedores distintos).
 * ETAPA 6: Bridge (tipo de notificación + canal, por separado).
 */
import { ConfigManager } from './infrastructure/config/config-manager';
import { FlujoAutenticacion } from './application/auth/flujo-autenticacion';
import { FlujoContrasena } from './application/auth/flujo-contrasena';
import { FlujoTokenTelefono } from './application/auth/flujo-token-telefono';
import { FlujoRostro } from './application/auth/flujo-rostro';
import { DirectorCredenciales } from './application/credencial/director-credenciales';
import { AdaptadorSmsGlobal } from './infrastructure/notificaciones/adaptador-sms-global';
import { AdaptadorSmsLocal } from './infrastructure/notificaciones/adaptador-sms-local';
import { EnviadorCorreo } from './infrastructure/notificaciones/enviador-correo';
import { NotificacionSimple } from './application/notificaciones/notificacion-simple';
import { NotificacionUrgente } from './application/notificaciones/notificacion-urgente';

const config = ConfigManager.getInstance();
console.log(`SGID iniciando en entorno "${config.obtener('entorno')}"`);
console.log(`API escuchará en el puerto ${config.obtener('puertoApi')}`);
console.log(`Umbral facial configurado: ${config.obtener('biometriaUmbralMinimo')}\n`);

// El código ya se envió por dos proveedores de SMS distintos (Adapter, ETAPA 5).
const codigoOtp = '482913';
const porSmsGlobal = new AdaptadorSmsGlobal().enviar('3001234567', `Tu código es ${codigoOtp}`);
const porSmsLocal = new AdaptadorSmsLocal().enviar('3001234567', `Tu código es ${codigoOtp}`);
console.log('Envío del código de seguridad:');
console.log(`  [${porSmsGlobal.proveedor}] enviado=${porSmsGlobal.enviado} · ref=${porSmsGlobal.referencia}`);
console.log(`  [${porSmsLocal.proveedor}] enviado=${porSmsLocal.enviado} · ref=${porSmsLocal.referencia}`);

const flujos: FlujoAutenticacion[] = [
  new FlujoContrasena('clave-del-ciudadano'),
  new FlujoTokenTelefono(codigoOtp, Date.now()),
  new FlujoRostro(),
];
const respuestas = ['clave-del-ciudadano', codigoOtp, '0.91'];

console.log('\nIntento de autenticación multifactor:');
let todoOk = true;
const factoresSuperados: string[] = [];
flujos.forEach((flujo, i) => {
  const r = flujo.autenticar(respuestas[i]);
  todoOk = todoOk && r.autenticado;
  if (r.autenticado) factoresSuperados.push(r.factor);
  console.log(`  [${r.factor}] autenticado=${r.autenticado} · ${r.motivo}`);
});
console.log(`\nAcceso ${todoOk ? 'CONCEDIDO' : 'DENEGADO'}`);

if (todoOk) {
  const director = new DirectorCredenciales();
  const credencial = director.construirCredencialCiudadano('ciudadano-001', 'Ana Pérez', factoresSuperados);
  console.log('\nCredencial digital emitida:');
  console.log(credencial);

  // Mismo aviso, dos combinaciones de tipo de notificación y canal (Bridge, ETAPA 6).
  const avisoUrgentePorSms = new NotificacionUrgente(new AdaptadorSmsGlobal());
  const avisoSimplePorCorreo = new NotificacionSimple(new EnviadorCorreo());
  console.log('\nAviso de credencial lista:');
  console.log('  ', avisoUrgentePorSms.enviar('3001234567', 'tu credencial ya está lista'));
  console.log('  ', avisoSimplePorCorreo.enviar('ana@sgid.gov', 'tu credencial ya está lista'));
}
