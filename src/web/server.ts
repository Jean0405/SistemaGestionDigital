/**
 * Servidor web de la demo del SGID.
 *
 * Expone por HTTP las mismas clases que ya usan las demás demos
 * (index.ts, demo-interactivo.ts); no hay lógica de negocio nueva aquí,
 * solo la conexión entre la página y los patrones ya implementados.
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

const CONTRASENA_REGISTRADA = 'clave-del-ciudadano';
const CODIGO_SMS = '482913';

type Rol = 'ciudadano' | 'administrador' | 'entidadExterna';

/** Estado de la demo: una sola "sesión" en memoria, igual para todo el que la abra en el navegador. */
interface Sesion {
  contrasenaProtegida: AutenticadorConBitacora;
  codigoEnviadoEn: number;
  factoresSuperados: string[];
  credencial: CredencialDigital | null;
}

function nuevaSesion(): Sesion {
  return {
    // Decorator (ETAPA 8) envolviendo el Factory Method (ETAPA 3), tal cual en las otras demos.
    contrasenaProtegida: new AutenticadorConBitacora(
      new AutenticadorConLimiteIntentos(new FlujoContrasena(CONTRASENA_REGISTRADA), 3),
    ),
    codigoEnviadoEn: 0,
    factoresSuperados: [],
    credencial: null,
  };
}

let sesion = nuevaSesion();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Adapter (ETAPA 5): "envía" el código por dos proveedores de SMS distintos.
app.post('/api/sms/enviar', (_req, res) => {
  sesion.codigoEnviadoEn = Date.now();
  const mensaje = `Tu código es ${CODIGO_SMS}`;
  res.json({
    global: new AdaptadorSmsGlobal().enviar('3001234567', mensaje),
    local: new AdaptadorSmsLocal().enviar('3001234567', mensaje),
  });
});

// Factory Method (ETAPA 3) + Decorator (ETAPA 8) para la contraseña.
app.post('/api/auth/contrasena', (req, res) => {
  const resultado = sesion.contrasenaProtegida.autenticar(String(req.body.valor ?? ''));
  if (resultado.autenticado) sesion.factoresSuperados.push('contraseña');
  res.json({ ...resultado, bitacora: sesion.contrasenaProtegida.bitacora });
});

app.post('/api/auth/token', (req, res) => {
  const resultado = new FlujoTokenTelefono(CODIGO_SMS, sesion.codigoEnviadoEn).autenticar(String(req.body.valor ?? ''));
  if (resultado.autenticado) sesion.factoresSuperados.push('token-telefono');
  res.json(resultado);
});

app.post('/api/auth/rostro', (req, res) => {
  const resultado = new FlujoRostro().autenticar(String(req.body.valor ?? ''));
  if (resultado.autenticado) sesion.factoresSuperados.push('rostro');
  res.json(resultado);
});

// Builder + Director (ETAPA 4) y Bridge (ETAPA 6) para avisar que ya está lista.
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

// Proxy (ETAPA 10): solo responde si la credencial emitida tiene el permiso.
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

// Composite (ETAPA 7): un permiso o un grupo entero se consultan igual.
app.get('/api/permisos', (req, res) => {
  const rol = String(req.query.rol ?? 'administrador') as keyof typeof catalogoPermisos;
  const permiso = String(req.query.permiso ?? '');
  const catalogo = catalogoPermisos[rol] ?? catalogoPermisos.administrador;

  res.json({ todos: catalogo.listar(), incluye: permiso ? catalogo.contiene(permiso) : null });
});

// Flyweight (ETAPA 9): valida un número de documento compartiendo el mismo TipoDocumento.
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
const puerto = config.obtener('puertoApi');
app.listen(puerto, () => {
  console.log(`SGID escuchando en http://localhost:${puerto}`);
});
