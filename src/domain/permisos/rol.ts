/**
 * Un rol guardado: su nombre y las piezas con las que se arma su árbol de
 * permisos (Composite). Cada pieza es un grupo completo (`auditoria`) o un
 * permiso suelto (`consultar-identidad`).
 */
export interface Rol {
  nombre: string;
  descripcion: string;
  componentes: string[];
  /** Los roles base vienen con el sistema y no se pueden eliminar. */
  base: boolean;
}
