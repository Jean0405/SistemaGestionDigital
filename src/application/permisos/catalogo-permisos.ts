import { GrupoPermisos } from '../../domain/permisos/grupo-permisos';
import { PermisoSimple } from '../../domain/permisos/permiso-simple';

/** Catálogo de permisos del sistema, armado como un árbol (Composite). */

const identidad = new GrupoPermisos('identidad')
  .agregar(new PermisoSimple('consultar-identidad'))
  .agregar(new PermisoSimple('editar-identidad'));

const auditoria = new GrupoPermisos('auditoria')
  .agregar(new PermisoSimple('ver-auditoria'))
  .agregar(new PermisoSimple('exportar-auditoria'));

export const catalogoPermisos = {
  ciudadano: new GrupoPermisos('permisos-ciudadano').agregar(new PermisoSimple('consultar-identidad')),

  administrador: new GrupoPermisos('permisos-administrador')
    .agregar(identidad)
    .agregar(auditoria)
    .agregar(new PermisoSimple('gestionar-roles')),

  entidadExterna: new GrupoPermisos('permisos-entidad-externa').agregar(
    new PermisoSimple('validar-identidad-externa'),
  ),
};
