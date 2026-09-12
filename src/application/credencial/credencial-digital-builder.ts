import { ConstructorCredencial } from './constructor-credencial';
import { CredencialDigital } from '../../domain/credencial/credencial-digital';
import { ConfigManager } from '../../infrastructure/config/config-manager';

/** Builder concreto: arma una CredencialDigital paso a paso. */
export class CredencialDigitalBuilder implements ConstructorCredencial {
  private usuarioId = '';
  private nombreCompleto = '';
  private rol = '';
  private readonly permisos: string[] = [];
  private readonly factoresSuperados: string[] = [];

  establecerUsuario(usuarioId: string, nombreCompleto: string): this {
    this.usuarioId = usuarioId;
    this.nombreCompleto = nombreCompleto;
    return this;
  }

  establecerRol(rol: string): this {
    this.rol = rol;
    return this;
  }

  agregarPermiso(permiso: string): this {
    this.permisos.push(permiso);
    return this;
  }

  agregarFactorSuperado(factor: string): this {
    this.factoresSuperados.push(factor);
    return this;
  }

  obtenerCredencial(): CredencialDigital {
    if (!this.usuarioId || !this.nombreCompleto) {
      throw new Error('Falta el usuario para emitir la credencial.');
    }
    if (!this.rol) {
      throw new Error('Falta el rol para emitir la credencial.');
    }
    if (this.factoresSuperados.length === 0) {
      throw new Error('No se puede emitir una credencial sin factores de autenticación superados.');
    }

    // La vigencia sale del Singleton de configuración (ETAPA 2), no de un número fijo aquí.
    const minutos = ConfigManager.getInstance().obtener('jwtExpiracionMinutos');
    const emitidaEn = Date.now();

    return Object.freeze({
      usuarioId: this.usuarioId,
      nombreCompleto: this.nombreCompleto,
      rol: this.rol,
      permisos: [...this.permisos],
      factoresSuperados: [...this.factoresSuperados],
      emitidaEn,
      expiraEn: emitidaEn + minutos * 60_000,
    });
  }
}
