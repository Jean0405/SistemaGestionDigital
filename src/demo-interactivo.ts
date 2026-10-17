/**
 * Demo interactiva para presentar el proyecto en vivo.
 *
 * A diferencia de index.ts (que usa valores fijos para mostrar que todo
 * funciona), aquí los datos los escribe quien está probando: la contraseña,
 * el código del teléfono, el puntaje facial, etc. Usa las mismas clases de
 * cada etapa, solo que con entrada real por consola.
 */
import * as readline from 'readline';
import { ConfigManager } from './infrastructure/config/config-manager';
import { FlujoContrasena } from './application/auth/flujo-contrasena';
import { FlujoTokenTelefono } from './application/auth/flujo-token-telefono';
import { FlujoRostro } from './application/auth/flujo-rostro';
import { AutenticadorConBitacora } from './application/auth/autenticador-con-bitacora';
import { AutenticadorConLimiteIntentos } from './application/auth/autenticador-con-limite-intentos';
import { DirectorCredenciales } from './application/credencial/director-credenciales';
import { RepositorioIdentidadMemoria } from './infrastructure/identidad/repositorio-identidad-memoria';
import { RepositorioIdentidadProxy } from './application/identidad/repositorio-identidad-proxy';
import { catalogoPermisos } from './application/permisos/catalogo-permisos';
import { FabricaTiposDocumento } from './application/documentos/fabrica-tipos-documento';
import { DocumentoIdentidad } from './domain/documentos/documento-identidad';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const preguntar = (texto: string): Promise<string> => new Promise((resolve) => rl.question(texto, resolve));

// Datos "registrados" del ciudadano de prueba. En un sistema real vendrían de una base de datos.
const CONTRASENA_REGISTRADA = 'clave-del-ciudadano';
const CODIGO_SMS_ENVIADO = '482913';

async function main() {
  const config = ConfigManager.getInstance();
  console.log(`\nSGID — demo en vivo (entorno "${config.obtener('entorno')}")`);
  console.log(`Contraseña registrada: "${CONTRASENA_REGISTRADA}" · Código ya enviado al teléfono: "${CODIGO_SMS_ENVIADO}"`);
  console.log('(para que puedas probar valores correctos e incorrectos)\n');

  // Contraseña, protegida con bitácora + límite de intentos (Decorator sobre Factory Method).
  const contrasena = new AutenticadorConBitacora(
    new AutenticadorConLimiteIntentos(new FlujoContrasena(CONTRASENA_REGISTRADA), 3),
  );
  let pasoContrasena = false;
  for (let intento = 1; intento <= 3 && !pasoContrasena; intento++) {
    const valor = await preguntar(`Intento ${intento}/3 — contraseña: `);
    const r = contrasena.autenticar(valor);
    console.log(`  -> ${r.motivo}`);
    pasoContrasena = r.autenticado;
  }

  // Token enviado al teléfono.
  let pasoToken = false;
  if (pasoContrasena) {
    const valor = await preguntar('\nCódigo recibido por SMS: ');
    const r = new FlujoTokenTelefono(CODIGO_SMS_ENVIADO, Date.now()).autenticar(valor);
    console.log(`  -> ${r.motivo}`);
    pasoToken = r.autenticado;
  }

  // Rostro: puntaje simulado entre 0 y 1 (no hay cámara real en esta demo).
  let pasoRostro = false;
  if (pasoToken) {
    const umbral = config.obtener('biometriaUmbralMinimo');
    const valor = await preguntar(`\nPuntaje facial de 0 a 1 (el umbral configurado es ${umbral}): `);
    const r = new FlujoRostro().autenticar(valor);
    console.log(`  -> ${r.motivo}`);
    pasoRostro = r.autenticado;
  }

  if (!pasoContrasena || !pasoToken || !pasoRostro) {
    console.log('\nAcceso DENEGADO. No se emite credencial.');
    rl.close();
    return;
  }

  console.log('\nAcceso CONCEDIDO. Emitiendo credencial (Builder)...');
  const credencial = new DirectorCredenciales().construirCredencialCiudadano('ciudadano-001', 'Ana Pérez', [
    'contraseña',
    'token-telefono',
    'rostro',
  ]);
  console.log(credencial);

  // Proxy: la consulta de identidad solo pasa si la credencial trae el permiso.
  const identidades = new RepositorioIdentidadProxy(new RepositorioIdentidadMemoria(), credencial);
  console.log('\nConsulta de identidad vía proxy:', identidades.obtener('ciudadano-001'));

  // Composite: buscar un permiso cualquiera en el catálogo del administrador.
  const permiso = await preguntar('\n¿Qué permiso buscas en el catálogo de administrador? (ej: ver-auditoria): ');
  console.log(`  ¿lo incluye? ${catalogoPermisos.administrador.contiene(permiso)}`);

  // Flyweight: validar un número de documento de tipo cédula.
  const numeroDoc = await preguntar('\nNúmero de cédula a validar: ');
  const documento = new DocumentoIdentidad(FabricaTiposDocumento.obtener('CC'), numeroDoc, 'Ana Pérez');
  console.log(`  ¿es un número válido de cédula? ${documento.esValido()}`);

  rl.close();
}

main();
