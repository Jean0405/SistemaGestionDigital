import { TipoDocumento } from './tipo-documento';

/** Contexto: une el flyweight compartido (tipo) con los datos propios de cada persona. */
export class DocumentoIdentidad {
  constructor(
    public readonly tipo: TipoDocumento,
    public readonly numero: string,
    public readonly titular: string,
  ) {}

  esValido(): boolean {
    return this.tipo.validar(this.numero);
  }
}
