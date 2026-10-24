import { Usuario } from '../../domain/usuarios/usuario';
import { DocumentoIdentidad } from '../../domain/documentos/documento-identidad';
import { RepositorioUsuariosArchivo } from '../../infrastructure/persistencia/repositorio-usuarios-archivo';
import { BitacoraAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';
import { Cifrador, hashear } from '../../infrastructure/seguridad/criptografia';
import { GestorRoles } from '../permisos/gestor-roles';
import { ErrorDeNegocio, actorDe, enmascarar, obtenerTipoDocumento } from '../comun';

export interface DatosRegistro {
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  correo?: string;
  contrasena: string;
  descriptorRostro: number[];
}

/** El descriptor facial que calcula face-api.js en el navegador: 128 números. */
export function validarRostro(descriptor: unknown): asserts descriptor is number[] {
  if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every(Number.isFinite)) {
    throw new ErrorDeNegocio('No se recibió un rostro válido desde la cámara.');
  }
}

export class ServicioUsuarios {
  constructor(
    private readonly repositorio: RepositorioUsuariosArchivo,
    private readonly roles: GestorRoles,
    private readonly cifrador: Cifrador,
    private readonly auditoria: BitacoraAuditoria,
  ) {}

  /** Identificador seudónimo: sale del documento, pero no deja ver el documento. */
  idPara(tipoDocumento: string, numeroDocumento: string): string {
    const tipo = String(tipoDocumento).trim().toUpperCase();
    const numero = String(numeroDocumento).trim().toUpperCase();
    return 'u-' + this.cifrador.huella(`${tipo}:${numero}`).slice(0, 20);
  }

  buscarPorDocumento(tipoDocumento: string, numeroDocumento: string): Usuario | undefined {
    return this.repositorio.buscarPorId(this.idPara(tipoDocumento, numeroDocumento));
  }

  buscarPorId(usuarioId: string): Usuario | undefined {
    return this.repositorio.buscarPorId(usuarioId);
  }

  hayAdministrador(): boolean {
    return this.repositorio.listar().some((u) => this.roles.tienePermiso(u.rol, 'gestionar-roles'));
  }

  contarConRol(rol: string): number {
    return this.repositorio.listar().filter((u) => u.rol === rol).length;
  }

  /** Lo que ve el administrador: los datos sensibles enmascarados. */
  listarParaAdministrador() {
    return this.repositorio.listar().map((u) => ({
      usuarioId: u.usuarioId,
      nombreCompleto: u.nombreCompleto,
      documento: `${u.tipoDocumento} ${enmascarar(u.numeroDocumento)}`,
      telefono: enmascarar(u.telefono, 3),
      rol: u.rol,
      creadoEn: u.creadoEn,
    }));
  }

  /**
   * El rol lo decide el servidor, nunca quien se registra: la primera persona
   * (cuando aún no hay administrador) entra como administrador; las demás, como ciudadanos.
   */
  registrar(datos: DatosRegistro, comoAdministrador: boolean): Usuario {
    if (comoAdministrador && this.hayAdministrador()) {
      throw new ErrorDeNegocio('Ya existe un administrador. Los nuevos registros entran como ciudadanos.', 409);
    }

    const nombreCompleto = String(datos.nombreCompleto ?? '').trim();
    const tipoDocumento = String(datos.tipoDocumento ?? '').trim().toUpperCase();
    const numeroDocumento = String(datos.numeroDocumento ?? '').trim().toUpperCase();
    const telefono = String(datos.telefono ?? '').replace(/\s/g, '');
    const correo = datos.correo ? String(datos.correo).trim() : null;
    const contrasena = String(datos.contrasena ?? '').trim();

    if (!/^[\p{L} .'-]{3,80}$/u.test(nombreCompleto)) throw new ErrorDeNegocio('Escribe el nombre completo (solo letras).');

    // Flyweight (ETAPA 9): el tipo de documento compartido valida su propio formato.
    const tipo = obtenerTipoDocumento(tipoDocumento);
    if (!new DocumentoIdentidad(tipo, numeroDocumento, nombreCompleto).esValido()) {
      throw new ErrorDeNegocio(`El número no tiene el formato de ${tipo.nombre}.`);
    }

    if (!/^\+?\d{7,15}$/.test(telefono)) throw new ErrorDeNegocio('El teléfono debe tener entre 7 y 15 dígitos.');
    if (correo && !/^\S+@\S+\.\S+$/.test(correo)) throw new ErrorDeNegocio('El correo no es válido.');
    if (contrasena.length < 8 || !/\d/.test(contrasena) || !/\p{L}/u.test(contrasena)) {
      throw new ErrorDeNegocio('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    }
    validarRostro(datos.descriptorRostro);

    const usuarioId = this.idPara(tipoDocumento, numeroDocumento);
    if (this.repositorio.buscarPorId(usuarioId)) throw new ErrorDeNegocio('Ya hay una persona registrada con ese documento.', 409);

    const usuario: Usuario = {
      usuarioId,
      nombreCompleto,
      tipoDocumento,
      numeroDocumento,
      telefono,
      correo,
      rol: comoAdministrador ? 'administrador' : 'ciudadano',
      contrasenaHash: hashear(contrasena),
      descriptorRostro: datos.descriptorRostro,
      creadoEn: Date.now(),
    };
    this.repositorio.guardar(usuario);
    this.auditoria.registrar({
      actor: actorDe(usuario),
      accion: 'usuarios.registro',
      resultado: 'exito',
      detalle: `Registro como ${usuario.rol} con ${tipoDocumento} ${enmascarar(numeroDocumento)}`,
    });
    return usuario;
  }

  /** Nadie cambia su propio rol: así siempre queda al menos el administrador que hace el cambio. */
  cambiarRol(usuarioId: string, rolNuevo: string, quien: Usuario): Usuario {
    const usuario = this.repositorio.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorDeNegocio('No existe ese usuario.', 404);
    if (!this.roles.buscar(rolNuevo)) throw new ErrorDeNegocio(`No existe el rol "${rolNuevo}".`, 404);
    if (usuario.usuarioId === quien.usuarioId) throw new ErrorDeNegocio('No puedes cambiar tu propio rol.', 403);

    this.repositorio.guardar({ ...usuario, rol: rolNuevo });
    this.auditoria.registrar({
      actor: actorDe(quien),
      accion: 'usuarios.cambiar-rol',
      resultado: 'exito',
      detalle: `${actorDe(usuario)}: ${usuario.rol} → ${rolNuevo}`,
    });
    return { ...usuario, rol: rolNuevo };
  }
}
