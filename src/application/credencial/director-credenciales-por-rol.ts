import { CredencialDigitalBuilder } from './credencial-digital-builder';
import { CredencialDigital } from '../../domain/credencial/credencial-digital';
import { GestorRoles } from '../permisos/gestor-roles';

/**
 * Director cuyas recetas no están escritas a mano: los permisos de cada rol
 * salen del árbol del Composite que mantiene el administrador. El Builder
 * (ETAPA 4) es el mismo de siempre. DirectorCredenciales sigue disponible
 * para la demo por consola, con sus tres recetas fijas.
 */
export class DirectorCredencialesPorRol {
  constructor(private readonly roles: GestorRoles) {}

  construir(usuarioId: string, nombre: string, rol: string, factores: string[]): CredencialDigital {
    const builder = new CredencialDigitalBuilder().establecerUsuario(usuarioId, nombre).establecerRol(rol);
    this.roles.permisosDe(rol).forEach((permiso) => builder.agregarPermiso(permiso));
    factores.forEach((factor) => builder.agregarFactorSuperado(factor));
    return builder.obtenerCredencial();
  }
}
