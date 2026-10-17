/** Flyweight: datos y regla de validación de un tipo de documento, iguales para cualquier ciudadano que lo tenga. */
export class TipoDocumento {
  constructor(
    public readonly codigo: string,
    public readonly nombre: string,
    private readonly patron: RegExp,
  ) {}

  validar(numero: string): boolean {
    return this.patron.test(numero);
  }
}
