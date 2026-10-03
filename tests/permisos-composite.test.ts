/** Pruebas del Composite: hojas y grupos de permisos se tratan de la misma forma. */
import { PermisoSimple } from '../src/domain/permisos/permiso-simple';
import { GrupoPermisos } from '../src/domain/permisos/grupo-permisos';
import { catalogoPermisos } from '../src/application/permisos/catalogo-permisos';

// Valida que una hoja se comporta como cualquier NodoPermiso: se busca y se lista a sí misma.
test('PermisoSimple se comporta como un NodoPermiso de un solo elemento', () => {
  const permiso = new PermisoSimple('consultar-identidad');

  expect(permiso.contiene('consultar-identidad')).toBe(true);
  expect(permiso.listar()).toEqual(['consultar-identidad']);
});

// Valida la composición: un grupo agrupa hojas y otros grupos sin distinguirlos.
test('GrupoPermisos agrupa hojas y otros grupos sin distinguirlos', () => {
  const grupo = new GrupoPermisos('ejemplo')
    .agregar(new PermisoSimple('a'))
    .agregar(new GrupoPermisos('sub').agregar(new PermisoSimple('b')));

  expect(grupo.listar()).toEqual(['a', 'b']);
  expect(grupo.contiene('b')).toBe(true);
  expect(grupo.contiene('c')).toBe(false);
});

// Valida el catálogo real: un permiso anidado dos niveles se encuentra igual que uno directo.
test('el catálogo de administrador encuentra permisos sin importar qué tan anidados estén', () => {
  expect(catalogoPermisos.administrador.contiene('ver-auditoria')).toBe(true);
  expect(catalogoPermisos.administrador.contiene('validar-identidad-externa')).toBe(false);
});
