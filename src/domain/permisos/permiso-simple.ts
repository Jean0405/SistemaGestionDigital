import { NodoPermiso } from './nodo-permiso';

/** Hoja del Composite: un permiso suelto, sin hijos. */
export class PermisoSimple implements NodoPermiso {
  constructor(public readonly nombre: string) {}

  contiene(permiso: string): boolean {
    return this.nombre === permiso;
  }

  listar(): string[] {
    return [this.nombre];
  }
}
