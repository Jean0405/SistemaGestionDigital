import { TipoDocumento } from '../../domain/documentos/tipo-documento';

/** Tipos de documento que reconoce el sistema, con su propio formato de validación. */
const definiciones: Record<string, [nombre: string, patron: RegExp]> = {
  CC: ['Cédula de ciudadanía', /^\d{6,10}$/],
  CE: ['Cédula de extranjería', /^[A-Z]{0,2}\d{6,9}$/],
  PA: ['Pasaporte', /^[A-Z0-9]{6,9}$/],
  TI: ['Tarjeta de identidad', /^\d{10,11}$/],
};

/** Flyweight Factory: entrega siempre la misma instancia de TipoDocumento para un código dado. */
export class FabricaTiposDocumento {
  private static readonly instancias = new Map<string, TipoDocumento>();

  static obtener(codigo: string): TipoDocumento {
    const existente = FabricaTiposDocumento.instancias.get(codigo);
    if (existente) return existente;

    const definicion = definiciones[codigo];
    if (!definicion) throw new Error(`Tipo de documento desconocido: ${codigo}`);

    const [nombre, patron] = definicion;
    const nuevo = new TipoDocumento(codigo, nombre, patron);
    FabricaTiposDocumento.instancias.set(codigo, nuevo);
    return nuevo;
  }

  static cantidadCreados(): number {
    return FabricaTiposDocumento.instancias.size;
  }
}
