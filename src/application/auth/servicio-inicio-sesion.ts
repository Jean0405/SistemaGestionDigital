/**
 * Caso de uso "iniciar sesión" con los tres factores, en el orden que la
 * persona quiera. Aquí se combinan varios patrones:
 *
 *  - Factory Method: FlujoContrasenaSegura, FlujoTokenTelefono y FlujoRostro.
 *  - Decorator: cada flujo se envuelve con límite de intentos y auditoría.
 *  - Adapter: el código SMS sale por el primer proveedor que responda.
 *  - Builder + Bridge: al final se emite la credencial y se avisa del inicio de sesión.
 */
import { randomInt, randomUUID } from 'crypto';
import { Autenticador } from './autenticador';
import { AutenticadorConAuditoria } from './autenticador-con-auditoria';
import { AutenticadorConBitacora } from './autenticador-con-bitacora';
import { AutenticadorConLimiteIntentos } from './autenticador-con-limite-intentos';
import { FlujoAutenticacion, ResultadoAutenticacion } from './flujo-autenticacion';
import { FlujoContrasenaSegura } from './flujo-contrasena-segura';
import { FlujoRostro } from './flujo-rostro';
import { FlujoTokenTelefono } from './flujo-token-telefono';
import { Usuario } from '../../domain/usuarios/usuario';
import { DirectorCredencialesPorRol } from '../credencial/director-credenciales-por-rol';
import { NotificacionSimple } from '../notificaciones/notificacion-simple';
import { NotificacionUrgente } from '../notificaciones/notificacion-urgente';
import { GestorRoles } from '../permisos/gestor-roles';
import { ServicioUsuarios, validarRostro } from '../usuarios/servicio-usuarios';
import { ErrorDeNegocio, actorDe, enmascarar } from '../comun';
import { AdaptadorSmsGlobal } from '../../infrastructure/notificaciones/adaptador-sms-global';
import { AdaptadorSmsLocal } from '../../infrastructure/notificaciones/adaptador-sms-local';
import { EnviadorCorreo } from '../../infrastructure/notificaciones/enviador-correo';
import { BitacoraAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';
import { CredencialFirmada, TokensJwt } from '../../infrastructure/seguridad/tokens-jwt';

export const FACTORES_REQUERIDOS = ['contraseña', 'token-telefono', 'rostro'];
const MAXIMO_FALLOS = 3;
const VIGENCIA_INTENTO_MS = 10 * 60 * 1000;

/** Un inicio de sesión en curso: de quién es y qué factores ya superó. */
interface Intento {
  usuarioId: string;
  creadoEn: number;
  factoresSuperados: string[];
  autenticadorCodigo: Autenticador | null;
  /** Los SMS que llegarían al teléfono real; en la demo se ven en un teléfono simulado. */
  bandeja: { texto: string; recibidoEn: number }[];
}

export class ServicioInicioSesion {
  private readonly intentos = new Map<string, Intento>();
  /** Los autenticadores ya decorados de cada persona. El bloqueo dura hasta que un administrador lo quite. */
  private readonly protegidos = new Map<string, { contrasena: AutenticadorConBitacora; rostro: Autenticador }>();
  private readonly proveedoresSms = [new AdaptadorSmsGlobal(), new AdaptadorSmsLocal()];
  private readonly director: DirectorCredencialesPorRol;

  constructor(
    private readonly usuarios: ServicioUsuarios,
    roles: GestorRoles,
    private readonly tokens: TokensJwt,
    private readonly auditoria: BitacoraAuditoria,
  ) {
    this.director = new DirectorCredencialesPorRol(roles);
  }

  iniciar(tipoDocumento: string, numeroDocumento: string) {
    const usuario = this.usuarios.buscarPorDocumento(tipoDocumento, numeroDocumento);
    if (!usuario) throw new ErrorDeNegocio('No hay ninguna persona registrada con ese documento.', 404);

    const intentoId = randomUUID();
    this.intentos.set(intentoId, { usuarioId: usuario.usuarioId, creadoEn: Date.now(), factoresSuperados: [], autenticadorCodigo: null, bandeja: [] });
    return { intentoId, nombre: usuario.nombreCompleto, telefono: enmascarar(usuario.telefono, 3) };
  }

  verificarContrasena(intentoId: string, valor: string) {
    const { intento, usuario } = this.obtener(intentoId);
    const autenticador = this.protegidosDe(usuario).contrasena;
    const resultado = this.probar(intento, 'contraseña', autenticador, valor);
    return { ...resultado, bitacora: autenticador.bitacora };
  }

  enviarCodigo(intentoId: string) {
    const { intento, usuario } = this.obtener(intentoId);
    const codigo = String(randomInt(100000, 1000000)); // aleatorio y criptográficamente seguro
    const mensaje = `SGID: tu código de verificación es ${codigo}. Vence en 5 minutos. No lo compartas.`;

    // Adapter: los dos proveedores se usan igual; si el primero falla, se prueba el siguiente.
    const envios = [];
    for (const proveedor of this.proveedoresSms) {
      const envio = proveedor.enviar(usuario.telefono, mensaje);
      envios.push(envio);
      if (envio.enviado) break;
    }

    // Cada código nuevo trae su propio límite de intentos.
    intento.autenticadorCodigo = this.proteger(new FlujoTokenTelefono(codigo, Date.now()), actorDe(usuario), 'token-telefono');
    intento.bandeja.unshift({ texto: mensaje, recibidoEn: Date.now() });
    return { telefono: enmascarar(usuario.telefono, 3), envios };
  }

  bandeja(intentoId: string) {
    return this.obtener(intentoId).intento.bandeja;
  }

  verificarCodigo(intentoId: string, valor: string) {
    const { intento } = this.obtener(intentoId);
    if (!intento.autenticadorCodigo) throw new ErrorDeNegocio('Primero pide que te envíen un código.');

    const resultado = this.probar(intento, 'token-telefono', intento.autenticadorCodigo, valor);
    if (resultado.autenticado) intento.autenticadorCodigo = null; // un solo uso
    return resultado;
  }

  verificarRostro(intentoId: string, descriptor: unknown) {
    const { intento, usuario } = this.obtener(intentoId);
    validarRostro(descriptor);

    // Qué tan distintos son los dos rostros: 0 es idéntico.
    const distancia = Math.sqrt(usuario.descriptorRostro.reduce((suma, valor, i) => suma + (valor - descriptor[i]) ** 2, 0));
    const puntaje = Math.max(0, 1 - distancia);

    // El mismo FlujoRostro de la ETAPA 3: compara el puntaje con el umbral del Singleton.
    const resultado = this.probar(intento, 'rostro', this.protegidosDe(usuario).rostro, String(puntaje));
    return { ...resultado, distancia, puntaje };
  }

  /** Con los tres factores: credencial con los permisos del rol (Builder), firmada como JWT, y aviso (Bridge). */
  completar(intentoId: string) {
    const { intento, usuario } = this.obtener(intentoId);
    const faltan = FACTORES_REQUERIDOS.filter((f) => !intento.factoresSuperados.includes(f));
    if (faltan.length > 0) throw new ErrorDeNegocio(`Faltan factores por superar: ${faltan.join(', ')}.`);

    const credencial = this.director.construir(usuario.usuarioId, usuario.nombreCompleto, usuario.rol, intento.factoresSuperados);
    const token = this.tokens.emitir(credencial);
    this.intentos.delete(intentoId);

    const aviso = `Nuevo inicio de sesión en SGID (${new Date().toLocaleString('es-CO')}). Si no fuiste tú, avisa a soporte.`;
    const avisos = {
      sms: new NotificacionUrgente(this.proveedoresSms[0]).enviar(usuario.telefono, aviso),
      correo: usuario.correo ? new NotificacionSimple(new EnviadorCorreo()).enviar(usuario.correo, aviso) : null,
    };

    this.auditoria.registrar({ actor: actorDe(usuario), accion: 'sesion.inicio', resultado: 'exito', detalle: `Credencial emitida con rol ${usuario.rol}` });
    return { token, credencial, avisos };
  }

  cerrarSesion(token: string, credencial: CredencialFirmada): void {
    this.tokens.revocar(token);
    this.auditoria.registrar({ actor: actorDe(credencial), accion: 'sesion.cierre', resultado: 'exito', detalle: 'Token revocado' });
  }

  /** Olvidar los autenticadores de la persona reinicia su contador de intentos. */
  desbloquear(usuarioId: string, quien: Usuario): void {
    const usuario = this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorDeNegocio('No existe ese usuario.', 404);
    this.protegidos.delete(usuarioId);
    this.auditoria.registrar({ actor: actorDe(quien), accion: 'usuarios.desbloquear', resultado: 'exito', detalle: actorDe(usuario) });
  }

  /** Decorator: límite de intentos por dentro y auditoría por fuera, sin que el flujo se entere. */
  private proteger(flujo: FlujoAutenticacion, actor: string, factor: string): Autenticador {
    return new AutenticadorConAuditoria(new AutenticadorConLimiteIntentos(flujo, MAXIMO_FALLOS), this.auditoria, actor, factor);
  }

  private protegidosDe(usuario: Usuario) {
    if (!this.protegidos.has(usuario.usuarioId)) {
      const actor = actorDe(usuario);
      this.protegidos.set(usuario.usuarioId, {
        // A la contraseña se le suma la bitácora en memoria, que la pantalla muestra.
        contrasena: new AutenticadorConBitacora(this.proteger(new FlujoContrasenaSegura(usuario.contrasenaHash), actor, 'contraseña')),
        rostro: this.proteger(new FlujoRostro(), actor, 'rostro'),
      });
    }
    return this.protegidos.get(usuario.usuarioId)!;
  }

  private probar(intento: Intento, factor: string, autenticador: Autenticador, valor: string): ResultadoAutenticacion {
    const resultado = autenticador.autenticar(String(valor ?? ''));
    if (resultado.autenticado && !intento.factoresSuperados.includes(factor)) intento.factoresSuperados.push(factor);
    return resultado;
  }

  private obtener(intentoId: string) {
    const intento = this.intentos.get(intentoId);
    const usuario = intento && this.usuarios.buscarPorId(intento.usuarioId);
    if (!intento || !usuario || Date.now() - intento.creadoEn > VIGENCIA_INTENTO_MS) {
      throw new ErrorDeNegocio('El inicio de sesión no existe o venció; vuelve a empezar.', 404);
    }
    return { intento, usuario };
  }
}
