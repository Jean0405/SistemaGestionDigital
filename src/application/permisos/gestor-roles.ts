/**
 * Roles editables por el administrador. Cada rol se arma como un árbol del
 * Composite (ETAPA 7): "¿qué permisos tiene?" se responde con `listar()` y
 * "¿tiene este permiso?" con `contiene()`, igual que en el catálogo fijo.
 */
import { GrupoPermisos } from '../../domain/permisos/grupo-permisos';
import { PermisoSimple } from '../../domain/permisos/permiso-simple';
import { Rol } from '../../domain/permisos/rol';
import { ColeccionJson } from '../../infrastructure/persistencia/coleccion-json';
import { BitacoraAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';
import { ErrorDeNegocio } from '../comun';

/** Todos los permisos que existen, en grupos. Con estas piezas se arman los roles. */
export const catalogoDePermisos: Record<string, { descripcion: string; permisos: Record<string, string> }> = {
  identidad: {
    descripcion: 'Datos de identidad de los ciudadanos',
    permisos: {
      'consultar-identidad': 'Ver su propia identidad verificada',
      'editar-identidad': 'Corregir datos de identidad',
    },
  },
  auditoria: {
    descripcion: 'Trazabilidad de las operaciones',
    permisos: {
      'ver-auditoria': 'Consultar la bitácora de auditoría',
      'exportar-auditoria': 'Descargar la bitácora completa',
    },
  },
  administracion: {
    descripcion: 'Gestión del sistema',
    permisos: {
      'gestionar-roles': 'Crear y editar roles y sus permisos',
      'gestionar-usuarios': 'Cambiar el rol de los usuarios y desbloquearlos',
      'gestionar-entidades': 'Registrar y revocar entidades externas',
    },
  },
  integracion: {
    descripcion: 'API para otras entidades del Estado',
    permisos: {
      'validar-identidad-externa': 'Validar si un documento corresponde a una persona registrada',
    },
  },
};

/** Roles con los que arranca el sistema la primera vez. */
const rolesBase: Rol[] = [
  { nombre: 'ciudadano', descripcion: 'Persona que se autentica y consulta su propia identidad', componentes: ['consultar-identidad'], base: true },
  { nombre: 'administrador', descripcion: 'Configura roles, usuarios y entidades, y supervisa la auditoría', componentes: ['identidad', 'auditoria', 'administracion'], base: true },
  { nombre: 'entidad-externa', descripcion: 'Sistema de otra entidad del Estado que valida identidades por la API', componentes: ['integracion'], base: true },
];

const esGrupo = (nombre: string) => nombre in catalogoDePermisos;
const esPermiso = (nombre: string) => Object.values(catalogoDePermisos).some((grupo) => nombre in grupo.permisos);

/** Arma el árbol: cada grupo es un nodo compuesto con sus permisos como hojas; los permisos sueltos son hojas directas. */
function armarArbol(rol: Rol): GrupoPermisos {
  const raiz = new GrupoPermisos(rol.nombre);
  for (const componente of rol.componentes) {
    if (esGrupo(componente)) {
      const grupo = new GrupoPermisos(componente);
      Object.keys(catalogoDePermisos[componente].permisos).forEach((permiso) => grupo.agregar(new PermisoSimple(permiso)));
      raiz.agregar(grupo);
    } else {
      raiz.agregar(new PermisoSimple(componente));
    }
  }
  return raiz;
}

export class GestorRoles {
  constructor(
    private readonly roles: ColeccionJson<Rol>,
    private readonly auditoria: BitacoraAuditoria,
  ) {
    rolesBase.forEach((rol) => {
      if (!roles.buscar(rol.nombre)) roles.guardar(rol);
    });
  }

  listar(): Rol[] {
    return this.roles.listar();
  }

  buscar(nombre: string): Rol | undefined {
    return this.roles.buscar(nombre);
  }

  permisosDe(nombre: string): string[] {
    const rol = this.buscar(nombre);
    return rol ? [...new Set(armarArbol(rol).listar())] : [];
  }

  tienePermiso(nombre: string, permiso: string): boolean {
    const rol = this.buscar(nombre);
    return rol ? armarArbol(rol).contiene(permiso) : false;
  }

  crear(nombre: string, descripcion: string, componentes: string[], actor: string): Rol {
    if (!/^[a-z][a-z0-9-]{2,30}$/.test(String(nombre))) {
      throw new ErrorDeNegocio('El nombre del rol debe tener de 3 a 31 caracteres: minúsculas, números y guiones.');
    }
    if (this.buscar(nombre)) throw new ErrorDeNegocio(`Ya existe un rol llamado "${nombre}".`, 409);

    const rol: Rol = { nombre, descripcion: String(descripcion ?? ''), componentes: validar(componentes), base: false };
    this.roles.guardar(rol);
    this.registrar(actor, 'roles.crear', `${nombre}: ${rol.componentes.join(', ')}`);
    return rol;
  }

  actualizar(nombre: string, descripcion: string, componentes: string[], actor: string): Rol {
    const anterior = this.buscar(nombre);
    if (!anterior) throw new ErrorDeNegocio(`No existe el rol "${nombre}".`, 404);

    const rol: Rol = { ...anterior, descripcion: String(descripcion ?? ''), componentes: validar(componentes) };
    // Si el administrador pierde este permiso, nadie podría volver a entrar al panel.
    if (nombre === 'administrador' && !armarArbol(rol).contiene('gestionar-roles')) {
      throw new ErrorDeNegocio('El rol administrador debe conservar el permiso "gestionar-roles".');
    }
    this.roles.guardar(rol);
    this.registrar(actor, 'roles.actualizar', `${nombre}: [${anterior.componentes.join(', ')}] → [${rol.componentes.join(', ')}]`);
    return rol;
  }

  eliminar(nombre: string, cuentasConElRol: number, actor: string): void {
    const rol = this.buscar(nombre);
    if (!rol) throw new ErrorDeNegocio(`No existe el rol "${nombre}".`, 404);
    if (rol.base) throw new ErrorDeNegocio('Los roles base del sistema no se pueden eliminar.');
    if (cuentasConElRol > 0) throw new ErrorDeNegocio(`No se puede eliminar: ${cuentasConElRol} cuenta(s) tienen este rol.`, 409);

    this.roles.eliminar(nombre);
    this.registrar(actor, 'roles.eliminar', nombre);
  }

  private registrar(actor: string, accion: string, detalle: string): void {
    this.auditoria.registrar({ actor, accion, resultado: 'exito', detalle });
  }
}

/** Solo se aceptan grupos y permisos del catálogo: el administrador no puede inventar permisos. */
function validar(componentes: unknown): string[] {
  if (!Array.isArray(componentes) || componentes.length === 0) {
    throw new ErrorDeNegocio('El rol debe tener al menos un grupo o permiso.');
  }
  const desconocidos = componentes.filter((c) => !esGrupo(c) && !esPermiso(c));
  if (desconocidos.length > 0) throw new ErrorDeNegocio(`Permisos o grupos desconocidos: ${desconocidos.join(', ')}.`);
  return [...new Set(componentes as string[])];
}
