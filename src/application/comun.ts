/** Piezas pequeñas que usan varios servicios. */
import { FabricaTiposDocumento } from './documentos/fabrica-tipos-documento';
import { TipoDocumento } from '../domain/documentos/tipo-documento';

/** Error esperado de una regla de negocio; la capa web lo traduce a una respuesta HTTP. */
export class ErrorDeNegocio extends Error {
  constructor(
    mensaje: string,
    public readonly estado = 400,
    /** Código corto para la API de integración (por ejemplo `invalid_client`, de OAuth2). */
    public readonly codigo = 'solicitud_invalida',
  ) {
    super(mensaje);
  }
}

/** Deja visibles solo los últimos caracteres: `1005184201` → `******4201`. */
export function enmascarar(valor: string, visibles = 4): string {
  return '*'.repeat(Math.max(0, valor.length - visibles)) + valor.slice(-visibles);
}

/** Cómo aparece alguien en la auditoría: su nombre y el inicio de su identificador. */
export function actorDe(cuenta: { nombreCompleto: string; usuarioId: string }): string {
  return `${cuenta.nombreCompleto} [${cuenta.usuarioId.slice(0, 10)}]`;
}

/** Flyweight (ETAPA 9): la fábrica entrega el tipo de documento compartido. */
export function obtenerTipoDocumento(codigo: string): TipoDocumento {
  try {
    return FabricaTiposDocumento.obtener(codigo);
  } catch {
    throw new ErrorDeNegocio(`Tipo de documento desconocido: "${codigo}".`);
  }
}
