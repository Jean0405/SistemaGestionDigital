import { Usuario } from '../../domain/usuarios/usuario';
import { DatosIdentidad, RepositorioIdentidad } from '../../domain/identidad/repositorio-identidad';
import { Cifrador } from '../seguridad/criptografia';
import { ColeccionJson } from './coleccion-json';

/** Así queda un usuario en el archivo: los datos sensibles cifrados y el rostro como texto cifrado. */
type UsuarioGuardado = Omit<Usuario, 'descriptorRostro'> & { descriptorRostro: string };

/**
 * Guarda los usuarios cifrando documento, teléfono, correo y rostro.
 * También es un sujeto real del Proxy (cumple RepositorioIdentidad), así que
 * RepositorioIdentidadProxy lo protege igual que al repositorio en memoria.
 */
export class RepositorioUsuariosArchivo implements RepositorioIdentidad {
  constructor(
    private readonly coleccion: ColeccionJson<UsuarioGuardado>,
    private readonly cifrador: Cifrador,
  ) {}

  guardar(usuario: Usuario): void {
    const c = this.cifrador;
    this.coleccion.guardar({
      ...usuario,
      numeroDocumento: c.cifrar(usuario.numeroDocumento),
      telefono: c.cifrar(usuario.telefono),
      correo: usuario.correo ? c.cifrar(usuario.correo) : null,
      descriptorRostro: c.cifrar(JSON.stringify(usuario.descriptorRostro)),
    });
  }

  buscarPorId(usuarioId: string): Usuario | undefined {
    const guardado = this.coleccion.buscar(usuarioId);
    return guardado ? this.descifrar(guardado) : undefined;
  }

  listar(): Usuario[] {
    return this.coleccion.listar().map((guardado) => this.descifrar(guardado));
  }

  /** Lo que pide el Proxy: los datos de identidad de una persona. */
  obtener(usuarioId: string): DatosIdentidad {
    const usuario = this.buscarPorId(usuarioId);
    if (!usuario) throw new Error(`No existe identidad para "${usuarioId}".`);
    return { usuarioId, nombreCompleto: usuario.nombreCompleto, documento: usuario.numeroDocumento };
  }

  private descifrar(guardado: UsuarioGuardado): Usuario {
    const c = this.cifrador;
    return {
      ...guardado,
      numeroDocumento: c.descifrar(guardado.numeroDocumento),
      telefono: c.descifrar(guardado.telefono),
      correo: guardado.correo ? c.descifrar(guardado.correo) : null,
      descriptorRostro: JSON.parse(c.descifrar(guardado.descriptorRostro)),
    };
  }
}
