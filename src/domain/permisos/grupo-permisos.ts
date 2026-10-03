import { NodoPermiso } from './nodo-permiso';

/** Compuesto del Composite: agrupa permisos simples u otros grupos, a cualquier profundidad. */
export class GrupoPermisos implements NodoPermiso {
  private readonly hijos: NodoPermiso[] = [];

  constructor(public readonly nombre: string) {}

  agregar(nodo: NodoPermiso): this {
    this.hijos.push(nodo);
    return this;
  }

  contiene(permiso: string): boolean {
    return this.hijos.some((hijo) => hijo.contiene(permiso));
  }

  listar(): string[] {
    return this.hijos.flatMap((hijo) => hijo.listar());
  }
}
