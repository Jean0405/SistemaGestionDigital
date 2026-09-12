import { CredencialDigitalBuilder } from './credencial-digital-builder';
import { CredencialDigital } from '../../domain/credencial/credencial-digital';

/** Director: conoce las "recetas" de permisos por rol y las arma con el builder. */
export class DirectorCredenciales {
  construirCredencialCiudadano(usuarioId: string, nombre: string, factores: string[]): CredencialDigital {
    const builder = new CredencialDigitalBuilder();
    builder.establecerUsuario(usuarioId, nombre).establecerRol('ciudadano');
    factores.forEach((factor) => builder.agregarFactorSuperado(factor));
    return builder.agregarPermiso('consultar-identidad').obtenerCredencial();
  }

  construirCredencialAdministrador(usuarioId: string, nombre: string, factores: string[]): CredencialDigital {
    const builder = new CredencialDigitalBuilder();
    builder.establecerUsuario(usuarioId, nombre).establecerRol('administrador');
    factores.forEach((factor) => builder.agregarFactorSuperado(factor));
    return builder
      .agregarPermiso('consultar-identidad')
      .agregarPermiso('gestionar-roles')
      .agregarPermiso('ver-auditoria')
      .obtenerCredencial();
  }

  construirCredencialEntidadExterna(usuarioId: string, nombre: string, factores: string[]): CredencialDigital {
    const builder = new CredencialDigitalBuilder();
    builder.establecerUsuario(usuarioId, nombre).establecerRol('entidad-externa');
    factores.forEach((factor) => builder.agregarFactorSuperado(factor));
    return builder.agregarPermiso('validar-identidad-externa').obtenerCredencial();
  }
}
