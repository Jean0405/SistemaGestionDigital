import { DatosIdentidad, RepositorioIdentidad } from '../../domain/identidad/repositorio-identidad';
import { CredencialDigital } from '../../domain/credencial/credencial-digital';

/** Proxy de protección: solo deja pasar al repositorio real si la credencial tiene el permiso. */
export class RepositorioIdentidadProxy implements RepositorioIdentidad {
  constructor(
    private readonly real: RepositorioIdentidad,
    private readonly credencial: CredencialDigital,
    private readonly permisoRequerido = 'consultar-identidad',
  ) {}

  obtener(usuarioId: string): DatosIdentidad {
    if (!this.credencial.permisos.includes(this.permisoRequerido)) {
      throw new Error(`Acceso denegado: falta el permiso "${this.permisoRequerido}".`);
    }
    return this.real.obtener(usuarioId);
  }
}
