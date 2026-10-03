/** Un permiso individual o un grupo de permisos: ambos se tratan igual. */
export interface NodoPermiso {
  readonly nombre: string;
  contiene(permiso: string): boolean;
  listar(): string[];
}
