/**
 * Integración con otras entidades del Estado (un hospital, una notaría...).
 *
 * El administrador registra la entidad y le entrega un `client_id` y un
 * `client_secret`. Con ellos la entidad pide un token (OAuth2, "client
 * credentials") y pregunta si un documento es de una persona registrada.
 * La respuesta es mínima: sí o no, sin entregar los datos de la persona.
 */
import { randomBytes } from 'crypto';
import { Autenticador } from '../auth/autenticador';
import { AutenticadorConAuditoria } from '../auth/autenticador-con-auditoria';
import { AutenticadorConLimiteIntentos } from '../auth/autenticador-con-limite-intentos';
import { FlujoContrasenaSegura } from '../auth/flujo-contrasena-segura';
import { DirectorCredencialesPorRol } from '../credencial/director-credenciales-por-rol';
import { RepositorioIdentidadProxy } from '../identidad/repositorio-identidad-proxy';
import { GestorRoles } from '../permisos/gestor-roles';
import { ServicioUsuarios } from '../usuarios/servicio-usuarios';
import { ErrorDeNegocio, actorDe, enmascarar, obtenerTipoDocumento } from '../comun';
import { DocumentoIdentidad } from '../../domain/documentos/documento-identidad';
import { EntidadExterna, Usuario } from '../../domain/usuarios/usuario';
import { CredencialDigital } from '../../domain/credencial/credencial-digital';
import { BitacoraAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';
import { ColeccionJson } from '../../infrastructure/persistencia/coleccion-json';
import { RepositorioUsuariosArchivo } from '../../infrastructure/persistencia/repositorio-usuarios-archivo';
import { hashear } from '../../infrastructure/seguridad/criptografia';
import { TokensJwt } from '../../infrastructure/seguridad/tokens-jwt';

export const PERMISO_VALIDAR = 'validar-identidad-externa';

const actorEntidad = (e: EntidadExterna) => `Entidad: ${e.nombre} [${e.clienteId}]`;

/** Compara nombres sin importar mayúsculas, tildes ni espacios de más. */
function normalizar(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export class ServicioIntegracion {
  /** El secreto de cada entidad, protegido con límite de intentos y auditoría (Decorator). */
  private readonly protegidos = new Map<string, Autenticador>();
  private readonly director: DirectorCredencialesPorRol;

  constructor(
    private readonly entidades: ColeccionJson<EntidadExterna>,
    private readonly identidades: RepositorioUsuariosArchivo,
    private readonly usuarios: ServicioUsuarios,
    private readonly roles: GestorRoles,
    private readonly tokens: TokensJwt,
    private readonly auditoria: BitacoraAuditoria,
  ) {
    this.director = new DirectorCredencialesPorRol(roles);
  }

  /** Lista sin el hash del secreto. */
  listar() {
    return this.entidades.listar().map(({ secretoHash, ...entidad }) => entidad);
  }

  contarConRol(rol: string): number {
    return this.entidades.listar().filter((e) => e.activa && e.rol === rol).length;
  }

  /** Devuelve el secreto en claro una sola vez; después solo queda su hash. */
  registrar(nombre: string, rol: string, quien: Usuario) {
    nombre = String(nombre ?? '').trim();
    if (nombre.length < 3 || nombre.length > 80) throw new ErrorDeNegocio('El nombre de la entidad debe tener entre 3 y 80 caracteres.');
    if (!this.roles.buscar(rol)) throw new ErrorDeNegocio(`No existe el rol "${rol}".`, 404);

    const secreto = randomBytes(24).toString('base64url');
    const entidad: EntidadExterna = {
      clienteId: 'gov-' + randomBytes(6).toString('hex'),
      nombre,
      rol,
      secretoHash: hashear(secreto),
      activa: true,
      creadaEn: Date.now(),
    };
    this.entidades.guardar(entidad);
    this.auditoria.registrar({ actor: actorDe(quien), accion: 'entidades.registrar', resultado: 'exito', detalle: `${actorEntidad(entidad)} con rol ${rol}` });
    return { clienteId: entidad.clienteId, secreto, nombre, rol };
  }

  revocar(clienteId: string, quien: Usuario): void {
    const entidad = this.entidades.buscar(clienteId);
    if (!entidad) throw new ErrorDeNegocio('No existe esa entidad.', 404);
    this.entidades.guardar({ ...entidad, activa: false });
    this.auditoria.registrar({ actor: actorDe(quien), accion: 'entidades.revocar', resultado: 'exito', detalle: actorEntidad(entidad) });
  }

  /** OAuth2 client credentials: el secreto se comprueba como una contraseña más (Factory Method). */
  emitirToken(clienteId: string, secreto: string) {
    const entidad = this.entidades.buscar(String(clienteId ?? ''));
    if (!entidad || !entidad.activa) {
      this.auditoria.registrar({ actor: `Cliente [${String(clienteId).slice(0, 24)}]`, accion: 'integracion.token', resultado: 'denegado', detalle: 'Cliente no registrado o revocado' });
      throw new ErrorDeNegocio('Credenciales de cliente inválidas.', 401, 'invalid_client');
    }

    if (!this.protegidos.has(entidad.clienteId)) {
      const flujo = new FlujoContrasenaSegura(entidad.secretoHash);
      this.protegidos.set(entidad.clienteId, new AutenticadorConAuditoria(new AutenticadorConLimiteIntentos(flujo, 5), this.auditoria, actorEntidad(entidad), 'credenciales-cliente'));
    }
    const resultado = this.protegidos.get(entidad.clienteId)!.autenticar(String(secreto ?? ''));
    if (!resultado.autenticado) throw new ErrorDeNegocio('Credenciales de cliente inválidas.', 401, 'invalid_client');

    const credencial = this.director.construir(entidad.clienteId, entidad.nombre, entidad.rol, ['credenciales-cliente']);
    return {
      access_token: this.tokens.emitir(credencial),
      token_type: 'Bearer',
      expires_in: Math.round((credencial.expiraEn - credencial.emitidaEn) / 1000),
      scope: credencial.permisos.join(' '),
    };
  }

  /** El token debe ser de una entidad que siga activa. */
  entidadActiva(credencial: CredencialDigital): EntidadExterna {
    const entidad = this.entidades.buscar(credencial.usuarioId);
    if (!entidad || !entidad.activa) throw new ErrorDeNegocio('El token no es de una entidad activa.', 401, 'invalid_token');
    return entidad;
  }

  validarIdentidad(credencial: CredencialDigital, solicitud: { tipoDocumento: string; numeroDocumento: string; nombreCompleto?: string }) {
    const entidad = this.entidadActiva(credencial);
    const tipoDocumento = String(solicitud.tipoDocumento ?? '').toUpperCase();
    const numeroDocumento = String(solicitud.numeroDocumento ?? '').trim().toUpperCase();

    // Flyweight: antes de buscar nada, el tipo de documento revisa el formato.
    const tipo = obtenerTipoDocumento(tipoDocumento);
    if (!new DocumentoIdentidad(tipo, numeroDocumento, '').esValido()) {
      throw new ErrorDeNegocio(`El número no tiene el formato de ${tipo.nombre}.`, 400, 'documento_invalido');
    }

    let valida = false;
    let coincideNombre: boolean | null = null;
    const usuarioId = this.usuarios.idPara(tipoDocumento, numeroDocumento);
    if (this.usuarios.buscarPorId(usuarioId)) {
      // Proxy (ETAPA 10): el mismo de siempre, con el permiso que exige la integración.
      const protegido = new RepositorioIdentidadProxy(this.identidades, credencial, PERMISO_VALIDAR);
      let identidad;
      try {
        identidad = protegido.obtener(usuarioId);
      } catch (error) {
        throw new ErrorDeNegocio((error as Error).message, 403, 'insufficient_scope');
      }
      valida = true;
      if (solicitud.nombreCompleto) coincideNombre = normalizar(solicitud.nombreCompleto) === normalizar(identidad.nombreCompleto);
    }

    const registro = this.auditoria.registrar({
      actor: actorEntidad(entidad),
      accion: 'integracion.validar',
      resultado: 'exito',
      detalle: `${tipoDocumento} ${enmascarar(numeroDocumento)} → ${valida ? 'registrada' : 'no registrada'}`,
    });
    return { valida, coincideNombre, tipoDocumento, consultadoEn: registro.fecha, registroAuditoria: registro.numero };
  }
}
