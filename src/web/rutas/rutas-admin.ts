/** Panel de administración: roles y permisos, usuarios, entidades externas y auditoría. */
import { Router } from 'express';
import { Sistema } from '../app';
import { requierePermiso, requiereToken, requiereUsuario } from '../seguridad-http';
import { actorDe } from '../../application/comun';

export function rutasAdmin(sistema: Sistema): Router {
  const r = Router();
  const { roles, usuarios, sesiones, integracion, auditoria } = sistema;
  const permiso = (nombre: string) => requierePermiso(sistema, nombre);
  const cuentasConRol = (rol: string) => usuarios.contarConRol(rol) + integracion.contarConRol(rol);

  r.use(requiereToken(sistema), requiereUsuario(sistema));

  // --- Roles y permisos ---
  r.get('/roles', permiso('gestionar-roles'), (_req, res) => {
    res.json(roles.listar().map((rol) => ({ ...rol, permisos: roles.permisosDe(rol.nombre), enUso: cuentasConRol(rol.nombre) })));
  });

  r.post('/roles', permiso('gestionar-roles'), (req, res) => {
    const { nombre, descripcion, componentes } = req.body;
    res.status(201).json(roles.crear(nombre, descripcion, componentes, actorDe(res.locals.usuario)));
  });

  r.put('/roles/:nombre', permiso('gestionar-roles'), (req, res) => {
    res.json(roles.actualizar(req.params.nombre, req.body.descripcion, req.body.componentes, actorDe(res.locals.usuario)));
  });

  r.delete('/roles/:nombre', permiso('gestionar-roles'), (req, res) => {
    roles.eliminar(req.params.nombre, cuentasConRol(req.params.nombre), actorDe(res.locals.usuario));
    res.json({ ok: true });
  });

  // --- Usuarios ---
  r.get('/usuarios', permiso('gestionar-usuarios'), (_req, res) => {
    res.json(usuarios.listarParaAdministrador());
  });

  r.put('/usuarios/:id/rol', permiso('gestionar-usuarios'), (req, res) => {
    res.json({ rol: usuarios.cambiarRol(req.params.id, String(req.body.rol), res.locals.usuario).rol });
  });

  r.post('/usuarios/:id/desbloquear', permiso('gestionar-usuarios'), (req, res) => {
    sesiones.desbloquear(req.params.id, res.locals.usuario);
    res.json({ ok: true });
  });

  // --- Entidades gubernamentales externas ---
  r.get('/entidades', permiso('gestionar-entidades'), (_req, res) => {
    res.json(integracion.listar());
  });

  r.post('/entidades', permiso('gestionar-entidades'), (req, res) => {
    res.status(201).json(integracion.registrar(req.body.nombre, req.body.rol ?? 'entidad-externa', res.locals.usuario));
  });

  r.delete('/entidades/:id', permiso('gestionar-entidades'), (req, res) => {
    integracion.revocar(req.params.id, res.locals.usuario);
    res.json({ ok: true });
  });

  // --- Auditoría ---
  r.get('/auditoria', permiso('ver-auditoria'), (_req, res) => {
    res.json({ integridad: auditoria.verificar(), registros: auditoria.listar().slice(-300).reverse() });
  });

  r.get('/auditoria/exportar', permiso('exportar-auditoria'), (_req, res) => {
    auditoria.registrar({ actor: actorDe(res.locals.usuario), accion: 'auditoria.exportar', resultado: 'exito', detalle: 'Descarga completa' });
    res.json({ integridad: auditoria.verificar(), registros: auditoria.listar() });
  });

  return r;
}
