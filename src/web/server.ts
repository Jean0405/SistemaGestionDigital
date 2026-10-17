/**
 * Servidor web de la demo del SGID.
 *
 * Expone por HTTP las mismas clases que ya usan las demás demos
 * (index.ts, demo-interactivo.ts); no hay lógica de negocio nueva aquí,
 * salvo el cálculo de similitud facial (ver distanciaEuclidiana más abajo),
 * que es lo único que no estaba resuelto por una clase existente.
 */
import express from 'express';
import path from 'path';
import { ConfigManager } from '../infrastructure/config/config-manager';
import { FlujoContrasena } from '../application/auth/flujo-contrasena';
import { FlujoTokenTelefono } from '../application/auth/flujo-token-telefono';
import { FlujoRostro } from '../application/auth/flujo-rostro';
import { AutenticadorConBitacora } from '../application/auth/autenticador-con-bitacora';
import { AutenticadorConLimiteIntentos } from '../application/auth/autenticador-con-limite-intentos';
import { DirectorCredenciales } from '../application/credencial/director-credenciales';
import { CredencialDigital } from '../domain/credencial/credencial-digital';
import { AdaptadorSmsGlobal } from '../infrastructure/notificaciones/adaptador-sms-global';
import { AdaptadorSmsLocal } from '../infrastructure/notificaciones/adaptador-sms-local';
import { EnviadorCorreo } from '../infrastructure/notificaciones/enviador-correo';
import { NotificacionUrgente } from '../application/notificaciones/notificacion-urgente';
import { NotificacionSimple } from '../application/notificaciones/notificacion-simple';
import { catalogoPermisos } from '../application/permisos/catalogo-permisos';
import { FabricaTiposDocumento } from '../application/documentos/fabrica-tipos-documento';
import { DocumentoIdentidad } from '../domain/documentos/documento-identidad';
import { RepositorioIdentidadMemoria } from '../infrastructure/identidad/repositorio-identidad-memoria';
import { RepositorioIdentidadProxy } from '../application/identidad/repositorio-identidad-proxy';

type Rol = 'ciudadano' | 'administrador' | 'entidadExterna';

/** Estado de la demo: una sola "sesión" en memoria, igual para todo el que la abra en el navegador. */
interface Sesion {
  contrasenaRegistrada: string;
  contrasenaProtegida: AutenticadorConBitacora | null;
  codigoSms: string;
  codigoEnviadoEn: number;
  descriptorRostro: number[] | null;
  factoresSuperados: string[];
  credencial: CredencialDigital | null;
}

function nuevaSesion(): Sesion {
  return {
    contrasenaRegistrada: '',
    contrasenaProtegida: null,
    codigoSms: '',
    codigoEnviadoEn: 0,
    descriptorRostro: null,
    factoresSuperados: [],
    credencial: null,
  };
}

let sesion = nuevaSesion();

/** Qué tan distintos son dos rostros: 0 es idéntico, mientras más alto, menos se parecen. */
function distanciaEuclidiana(a: number[], b: number[]): number {
  let suma = 0;
  for (let i = 0; i < a.length; i++) suma += (a[i] - b[i]) ** 2;
  return Math.sqrt(suma);
}

function marcarSuperado(factor: string) {
  if (!sesion.factoresSuperados.includes(factor)) sesion.factoresSuperados.push(factor);
}

const app = express();
app.use(express.json({ limit: '2mb' })); // el descriptor facial es un array de 128 números, no pesa casi nada, pero se deja margen
app.use(express.static(path.join(__dirname, '../../public')));

// --- Contraseña: se registra primero, nadie la trae puesta de fábrica ---

app.post('/api/auth/contrasena/registrar', (req, res) => {
  const valor = String(req.body.valor ?? '').trim();
  if (!valor) {
    res.status(400).json({ error: 'La contraseña no puede estar vacía.' });
    return;
  }

  // Factory Method (ETAPA 3) envuelto en Decorator (ETAPA 8): se recrea con la contraseña elegida.
  sesion.contrasenaRegistrada = valor;
  sesion.contrasenaProtegida = new AutenticadorConBitacora(
    new AutenticadorConLimiteIntentos(new FlujoContrasena(valor), 3),
  );
  res.json({ ok: true });
});

app.post('/api/auth/contrasena/verificar', (req, res) => {
  if (!sesion.contrasenaProtegida) {
    res.status(400).json({ error: 'Primero registra una contraseña.' });
    return;
  }

  const resultado = sesion.contrasenaProtegida.autenticar(String(req.body.valor ?? ''));
  if (resultado.autenticado) marcarSuperado('contraseña');
  res.json({ ...resultado, bitacora: sesion.contrasenaProtegida.bitacora });
});

// --- Token por teléfono: código al azar, hay que "revisar el teléfono" para verlo (Adapter, ETAPA 5) ---

app.post('/api/sms/enviar', (_req, res) => {
  sesion.codigoSms = String(Math.floor(100000 + Math.random() * 900000));
  sesion.codigoEnviadoEn = Date.now();
  const mensaje = `Tu código es ${sesion.codigoSms}`;

  res.json({
    global: new AdaptadorSmsGlobal().enviar('3001234567', mensaje),
    local: new AdaptadorSmsLocal().enviar('3001234567', mensaje),
  });
});

/** Simula abrir la bandeja de mensajes del teléfono (no hay un SMS real detrás). */
app.get('/api/sms/bandeja', (_req, res) => {
  if (!sesion.codigoSms) {
    res.status(400).json({ error: 'Todavía no se ha enviado ningún código.' });
    return;
  }
  res.json({ codigo: sesion.codigoSms, enviadoEn: sesion.codigoEnviadoEn });
});

app.post('/api/auth/token', (req, res) => {
  const resultado = new FlujoTokenTelefono(sesion.codigoSms, sesion.codigoEnviadoEn).autenticar(String(req.body.valor ?? ''));
  if (resultado.autenticado) marcarSuperado('token-telefono');
  res.json(resultado);
});

// --- Rostro: se registra una muestra real de la cámara y se compara contra otra ---

app.post('/api/auth/rostro/registrar', (req, res) => {
  const descriptor = req.body.descriptor;
  if (!Array.isArray(descriptor) || descriptor.length === 0) {
    res.status(400).json({ error: 'No se recibió un rostro válido desde la cámara.' });
    return;
  }
  sesion.descriptorRostro = descriptor;
  res.json({ ok: true });
});

app.post('/api/auth/rostro/verificar', (req, res) => {
  const descriptor = req.body.descriptor;
  if (!sesion.descriptorRostro) {
    res.status(400).json({ error: 'Primero registra tu rostro.' });
    return;
  }
  if (!Array.isArray(descriptor) || descriptor.length === 0) {
    res.status(400).json({ error: 'No se recibió un rostro válido desde la cámara.' });
    return;
  }

  const distancia = distanciaEuclidiana(sesion.descriptorRostro, descriptor);
  const puntaje = Math.max(0, 1 - distancia);

  // A partir de aquí, el mismo FlujoRostro de la ETAPA 3, sin ningún cambio.
  const resultado = new FlujoRostro().autenticar(String(puntaje));
  if (resultado.autenticado) marcarSuperado('rostro');
  res.json({ ...resultado, distancia, puntaje });
});

// --- Builder (ETAPA 4) + Bridge (ETAPA 6): emitir la credencial y avisar ---

app.post('/api/credencial/emitir', (req, res) => {
  if (sesion.factoresSuperados.length < 3) {
    res.status(400).json({ error: 'Faltan factores de autenticación por superar.' });
    return;
  }

  const rol: Rol = req.body.rol === 'administrador' || req.body.rol === 'entidadExterna' ? req.body.rol : 'ciudadano';
  const director = new DirectorCredenciales();
  const credencial =
    rol === 'administrador'
      ? director.construirCredencialAdministrador('ciudadano-001', 'Ana Pérez', sesion.factoresSuperados)
      : rol === 'entidadExterna'
        ? director.construirCredencialEntidadExterna('ciudadano-001', 'Ana Pérez', sesion.factoresSuperados)
        : director.construirCredencialCiudadano('ciudadano-001', 'Ana Pérez', sesion.factoresSuperados);

  sesion.credencial = credencial;

  const avisoSms = new NotificacionUrgente(new AdaptadorSmsGlobal()).enviar('3001234567', 'tu credencial ya está lista');
  const avisoCorreo = new NotificacionSimple(new EnviadorCorreo()).enviar('ana@sgid.gov', 'tu credencial ya está lista');

  res.json({ credencial, avisos: { sms: avisoSms, correo: avisoCorreo } });
});

// --- Proxy (ETAPA 10): solo responde si la credencial emitida tiene el permiso ---

app.get('/api/identidad', (_req, res) => {
  if (!sesion.credencial) {
    res.status(400).json({ error: 'Todavía no se ha emitido una credencial.' });
    return;
  }

  try {
    const proxy = new RepositorioIdentidadProxy(new RepositorioIdentidadMemoria(), sesion.credencial);
    res.json(proxy.obtener('ciudadano-001'));
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

// --- Composite (ETAPA 7): un permiso o un grupo entero se consultan igual ---

app.get('/api/permisos', (req, res) => {
  const rol = String(req.query.rol ?? 'administrador') as keyof typeof catalogoPermisos;
  const permiso = String(req.query.permiso ?? '');
  const catalogo = catalogoPermisos[rol] ?? catalogoPermisos.administrador;

  res.json({ todos: catalogo.listar(), incluye: permiso ? catalogo.contiene(permiso) : null });
});

// --- Flyweight (ETAPA 9): valida un número de documento compartiendo el mismo TipoDocumento ---

app.get('/api/documento/:numero', (req, res) => {
  const documento = new DocumentoIdentidad(FabricaTiposDocumento.obtener('CC'), req.params.numero, 'Ana Pérez');
  res.json({ valido: documento.esValido(), tiposCreados: FabricaTiposDocumento.cantidadCreados() });
});

// Permite repetir la demo sin reiniciar el servidor.
app.post('/api/reset', (_req, res) => {
  sesion = nuevaSesion();
  res.json({ ok: true });
});

const config = ConfigManager.getInstance();

// Para que la página muestre contra qué umbral se está comparando el rostro (Singleton, ETAPA 2).
app.get('/api/config', (_req, res) => {
  res.json({ umbralFacial: config.obtener('biometriaUmbralMinimo') });
});

const puerto = config.obtener('puertoApi');
app.listen(puerto, () => {
  console.log(`SGID escuchando en http://localhost:${puerto}`);
});
