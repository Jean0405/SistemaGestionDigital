import { CredencialDigital } from '../../domain/credencial/credencial-digital';

/** Pasos que cualquier builder de credenciales debe ofrecer. */
export interface ConstructorCredencial {
  establecerUsuario(usuarioId: string, nombreCompleto: string): this;
  establecerRol(rol: string): this;
  agregarPermiso(permiso: string): this;
  agregarFactorSuperado(factor: string): this;
  obtenerCredencial(): CredencialDigital;
}
