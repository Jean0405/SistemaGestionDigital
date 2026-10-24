/**
 * "Iniciar sesión con SGID" para los servicios del Estado (OAuth2, flujo
 * authorization code). Ningún servicio implementa su propia autenticación:
 *
 *  1. El servicio manda a la persona a SGID: /autorizar?client_id=...&redirect_uri=...&state=...
 *  2. La persona se autentica con sus tres factores y acepta compartir sus datos.
 *  3. SGID la devuelve al servicio con un código de un solo uso.
 *  4. El servicio canjea el código (con su client_secret) por un token y pide los datos de la persona.
 */
import { randomBytes } from 'crypto';
import { Autenticador } from '../auth/autenticador';
import { AutenticadorConAuditoria } from '../auth/autenticador-con-auditoria';
import { AutenticadorConLimiteIntentos } from '../auth/autenticador-con-limite-intentos';
import { FlujoContrasenaSegura } from '../auth/flujo-contrasena-segura';
import { CredencialDigitalBuilder } from '../credencial/credencial-digital-builder';
import { RepositorioIdentidadProxy } from '../identidad/repositorio-identidad-proxy';
import { ServicioUsuarios } from '../usuarios/servicio-usuarios';
import { ErrorDeNegocio, actorDe, obtenerTipoDocumento } from '../comun';
import { ServicioConectado, Usuario } from '../../domain/usuarios/usuario';
import { BitacoraAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';
import { ColeccionJson } from '../../infrastructure/persistencia/coleccion-json';
import { RepositorioUsuariosArchivo } from '../../infrastructure/persistencia/repositorio-usuarios-archivo';
import { hashear } from '../../infrastructure/seguridad/criptografia';
import { CredencialFirmada, TokensJwt } from '../../infrastructure/seguridad/tokens-jwt';

const VIGENCIA_CODIGO_MS = 5 * 60 * 1000;

/** Un código entregado al servicio y todavía sin canjear. */
interface CodigoAutorizacion {
  clienteId: string;
  urlRetorno: string;
  usuarioId: string;
  factores: string[];
  creadoEn: number;
}

const actorServicio = (s: ServicioConectado) => `Servicio: ${s.nombre} [${s.clienteId}]`;

export class ServicioIntegracion {
  private readonly codigos = new Map<string, CodigoAutorizacion>();
  /** El secreto de cada servicio, protegido con límite de intentos y auditoría (Decorator). */
  private readonly secretos = new Map<string, Autenticador>();

  constructor(
    private readonly servicios: ColeccionJson<ServicioConectado>,
    private readonly identidades: RepositorioUsuariosArchivo,
    private readonly usuarios: ServicioUsuarios,
    private readonly tokens: TokensJwt,
    private readonly auditoria: BitacoraAuditoria,
  ) {}

  // --- Administración ---

  /** Lista sin el hash del secreto. */
  listar() {
    return this.servicios.listar().map(({ secretoHash, ...servicio }) => servicio);
  }

  /** Devuelve el secreto en claro una sola vez; después solo queda su hash. */
  conectar(nombre: string, urlRetorno: string, quien: Usuario) {
    nombre = String(nombre ?? '').trim();
    urlRetorno = String(urlRetorno ?? '').trim();
    if (nombre.length < 3 || nombre.length > 80) throw new ErrorDeNegocio('El nombre del servicio debe tener entre 3 y 80 caracteres.');
    if (!/^https?:\/\/\S+$/.test(urlRetorno)) throw new ErrorDeNegocio('La URL de retorno debe empezar con http:// o https://');

    const secreto = randomBytes(24).toString('base64url');
    const servicio: ServicioConectado = {
      clienteId: 'gov-' + randomBytes(6).toString('hex'),
      nombre,
      urlRetorno,
      secretoHash: hashear(secreto),
      activo: true,
      creadoEn: Date.now(),
    };
    this.servicios.guardar(servicio);
    this.auditoria.registrar({ actor: actorDe(quien), accion: 'servicios.conectar', resultado: 'exito', detalle: actorServicio(servicio) });
    return { clienteId: servicio.clienteId, secreto, nombre, urlRetorno };
  }

  desconectar(clienteId: string, quien: Usuario): void {
    const servicio = this.servicios.buscar(clienteId);
    if (!servicio) throw new ErrorDeNegocio('No existe ese servicio.', 404);
    this.servicios.guardar({ ...servicio, activo: false });
    this.auditoria.registrar({ actor: actorDe(quien), accion: 'servicios.desconectar', resultado: 'exito', detalle: actorServicio(servicio) });
  }

  // --- Paso 1 y 3: la persona llega desde el servicio y vuelve con un código ---

  /** Comprueba que el servicio exista, esté activo y que la URL de retorno sea la registrada. */
  servicioPara(clienteId: string, urlRetorno: string): ServicioConectado {
    const servicio = this.servicios.buscar(String(clienteId ?? ''));
    if (!servicio || !servicio.activo) throw new ErrorDeNegocio('El servicio que te envió aquí no está conectado a SGID.', 400, 'invalid_client');
    if (servicio.urlRetorno !== urlRetorno) throw new ErrorDeNegocio('La URL de retorno no coincide con la registrada.', 400, 'invalid_request');
    return servicio;
  }

  /** La persona, ya autenticada, acepta compartir su identidad: se crea el código y la URL para volver. */
  autorizar(clienteId: string, urlRetorno: string, state: string, usuario: Usuario, factores: string[]): string {
    const servicio = this.servicioPara(clienteId, urlRetorno);
    const codigo = randomBytes(24).toString('base64url');
    this.codigos.set(codigo, { clienteId, urlRetorno, usuarioId: usuario.usuarioId, factores, creadoEn: Date.now() });

    this.auditoria.registrar({ actor: actorDe(usuario), accion: 'servicios.autorizar', resultado: 'exito', detalle: `Inició sesión en ${servicio.nombre}` });
    const url = new URL(urlRetorno);
    url.searchParams.set('code', codigo);
    if (state) url.searchParams.set('state', state);
    return url.toString();
  }

  // --- Paso 4: el servicio canjea el código y pide los datos ---

  canjearCodigo(codigo: string, clienteId: string, secreto: string, urlRetorno: string) {
    const servicio = this.servicios.buscar(String(clienteId ?? ''));
    if (!servicio || !servicio.activo) throw new ErrorDeNegocio('Credenciales de cliente inválidas.', 401, 'invalid_client');

    if (!this.secretos.has(servicio.clienteId)) {
      const flujo = new FlujoContrasenaSegura(servicio.secretoHash);
      this.secretos.set(servicio.clienteId, new AutenticadorConAuditoria(new AutenticadorConLimiteIntentos(flujo, 5), this.auditoria, actorServicio(servicio), 'secreto-cliente'));
    }
    if (!this.secretos.get(servicio.clienteId)!.autenticar(String(secreto ?? '')).autenticado) {
      throw new ErrorDeNegocio('Credenciales de cliente inválidas.', 401, 'invalid_client');
    }

    // El código es de un solo uso, vence en 5 minutos y solo sirve al servicio que lo pidió.
    const guardado = this.codigos.get(String(codigo ?? ''));
    this.codigos.delete(String(codigo ?? ''));
    const valido = guardado && guardado.clienteId === servicio.clienteId && guardado.urlRetorno === urlRetorno && Date.now() - guardado.creadoEn < VIGENCIA_CODIGO_MS;
    const usuario = valido ? this.usuarios.buscarPorId(guardado.usuarioId) : undefined;
    if (!valido || !usuario) throw new ErrorDeNegocio('El código no es válido o ya venció.', 400, 'invalid_grant');

    // Builder: la credencial que recibe el servicio solo permite leer la identidad de la persona.
    const builder = new CredencialDigitalBuilder()
      .establecerUsuario(usuario.usuarioId, usuario.nombreCompleto)
      .establecerRol(usuario.rol)
      .agregarPermiso('consultar-identidad');
    guardado.factores.forEach((factor) => builder.agregarFactorSuperado(factor));
    const credencial = builder.obtenerCredencial();

    return {
      access_token: this.tokens.emitir(credencial, servicio.clienteId),
      token_type: 'Bearer',
      expires_in: Math.round((credencial.expiraEn - credencial.emitidaEn) / 1000),
    };
  }

  /** Lo que el servicio recibe de la persona, leído a través del Proxy. */
  datosDeUsuario(credencial: CredencialFirmada) {
    const servicio = this.servicios.buscar(credencial.aud ?? '');
    if (!servicio || !servicio.activo) throw new ErrorDeNegocio('El servicio fue desconectado.', 401, 'invalid_token');

    let identidad;
    try {
      identidad = new RepositorioIdentidadProxy(this.identidades, credencial).obtener(credencial.usuarioId);
    } catch (error) {
      throw new ErrorDeNegocio((error as Error).message, 403, 'insufficient_scope');
    }
    const usuario = this.usuarios.buscarPorId(credencial.usuarioId)!;

    this.auditoria.registrar({ actor: actorServicio(servicio), accion: 'servicios.datos', resultado: 'exito', detalle: `Leyó la identidad de ${actorDe(usuario)}` });
    return {
      sub: credencial.usuarioId,
      nombreCompleto: identidad.nombreCompleto,
      tipoDocumento: obtenerTipoDocumento(usuario.tipoDocumento).nombre, // Flyweight
      numeroDocumento: identidad.documento,
      factores: credencial.factoresSuperados,
    };
  }
}
