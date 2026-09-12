/**
 * Demostración ejecutable.
 * ETAPA 2: Singleton (Gestor de Configuración).
 * ETAPA 3: Factory Method (autenticación multifactor).
 * ETAPA 4: Builder (emisión de la credencial digital).
 */
import { ConfigManager } from './infrastructure/config/config-manager';
import { FlujoAutenticacion } from './application/auth/flujo-autenticacion';
import { FlujoContrasena } from './application/auth/flujo-contrasena';
import { FlujoTokenTelefono } from './application/auth/flujo-token-telefono';
import { FlujoRostro } from './application/auth/flujo-rostro';
import { DirectorCredenciales } from './application/credencial/director-credenciales';

const config = ConfigManager.getInstance();
console.log(`SGID iniciando en entorno "${config.obtener('entorno')}"`);
console.log(`API escuchará en el puerto ${config.obtener('puertoApi')}`);
console.log(`Umbral facial configurado: ${config.obtener('biometriaUmbralMinimo')}\n`);

// El sistema ya tiene la contraseña registrada y ya envió el código por SMS.
const flujos: FlujoAutenticacion[] = [
  new FlujoContrasena('clave-del-ciudadano'),
  new FlujoTokenTelefono('482913', Date.now()),
  new FlujoRostro(),
];
const respuestas = ['clave-del-ciudadano', '482913', '0.91'];

console.log('Intento de autenticación multifactor:');
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
}
