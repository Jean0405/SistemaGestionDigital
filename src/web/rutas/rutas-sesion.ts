/** Registro, inicio de sesión con los tres factores y perfil de la persona. */
import { Router } from 'express';
import { Sistema } from '../app';
import { requiereToken, requiereUsuario } from '../seguridad-http';
import { catalogoDePermisos } from '../../application/permisos/gestor-roles';
import { FACTORES_REQUERIDOS } from '../../application/auth/servicio-inicio-sesion';
import { RepositorioIdentidadProxy } from '../../application/identidad/repositorio-identidad-proxy';
import { ErrorDeNegocio, enmascarar, obtenerTipoDocumento } from '../../application/comun';
import { DocumentoIdentidad } from '../../domain/documentos/documento-identidad';

const PERMISOS_DEL_PANEL = ['gestionar-roles', 'gestionar-usuarios', 'gestionar-servicios', 'ver-auditoria', 'exportar-auditoria'];

export function rutasSesion(sistema: Sistema): Router {
  const r = Router();
  const { usuarios, sesiones, roles } = sistema;

  r.get('/estado', (_req, res) => {
    res.json({
      hayAdministrador: usuarios.hayAdministrador(),
      umbralFacial: sistema.config.obtener('biometriaUmbralMinimo'),
      smsSimulado: sistema.smsSimulado,
      factoresRequeridos: FACTORES_REQUERIDOS,
      tiposDocumento: ['CC', 'CE', 'PA', 'TI'].map((codigo) => ({ codigo, nombre: obtenerTipoDocumento(codigo).nombre })),
      catalogoDePermisos,
    });
  });

  // --- Registro: el primero queda como administrador; los demás, como ciudadanos ---
  r.post('/registro/administrador', (req, res) => {
    const usuario = usuarios.registrar(req.body, true);
    res.status(201).json({ nombreCompleto: usuario.nombreCompleto, rol: usuario.rol });
  });

  r.post('/registro', (req, res) => {
    const usuario = usuarios.registrar(req.body, false);
    res.status(201).json({ nombreCompleto: usuario.nombreCompleto, rol: usuario.rol });
  });

  // --- Inicio de sesión: un "intento" con los factores en cualquier orden ---
  r.post('/sesion/iniciar', (req, res) => res.json(sesiones.iniciar(req.body.tipoDocumento, req.body.numeroDocumento)));
  r.post('/sesion/:id/contrasena', (req, res) => res.json(sesiones.verificarContrasena(req.params.id, req.body.valor)));
  r.post('/sesion/:id/sms', (req, res) => res.json(sesiones.enviarCodigo(req.params.id)));
  r.post('/sesion/:id/codigo', (req, res) => res.json(sesiones.verificarCodigo(req.params.id, req.body.valor)));
  r.post('/sesion/:id/rostro', (req, res) => res.json(sesiones.verificarRostro(req.params.id, req.body.descriptor)));
  r.post('/sesion/:id/completar', (req, res) => res.json(sesiones.completar(req.params.id)));

  r.get('/sesion/:id/sms/bandeja', (req, res) => {
    if (!sistema.smsSimulado) throw new ErrorDeNegocio('El teléfono simulado no existe en producción.', 404);
    res.json({ mensajes: sesiones.bandeja(req.params.id) });
  });

  // --- "Iniciar sesión con SGID": la persona llega desde un servicio del Estado ---
  r.get('/autorizacion', (req, res) => {
    const servicio = sistema.integracion.servicioPara(String(req.query.client_id), String(req.query.redirect_uri));
    res.json({ servicio: servicio.nombre });
  });

  r.post('/autorizar', requiereToken(sistema), requiereUsuario(sistema), (req, res) => {
    const { client_id, redirect_uri, state } = req.body;
    const url = sistema.integracion.autorizar(client_id, redirect_uri, state, res.locals.usuario, res.locals.credencial.factoresSuperados);
    res.json({ url });
  });

  // --- Con sesión iniciada ---
  r.post('/sesion/cerrar', requiereToken(sistema), (_req, res) => {
    sesiones.cerrarSesion(res.locals.token, res.locals.credencial);
    res.json({ ok: true });
  });

  /** Un solo caso de uso que reúne varios patrones: credencial (Builder), Proxy, Flyweight y Composite. */
  r.get('/perfil', requiereToken(sistema), requiereUsuario(sistema), (_req, res) => {
    const { credencial, usuario, rolActual } = res.locals;

    let identidad;
    try {
      identidad = new RepositorioIdentidadProxy(sistema.repositorioUsuarios, credencial).obtener(usuario.usuarioId);
    } catch (error) {
      identidad = { error: (error as Error).message };
    }
    const tipo = obtenerTipoDocumento(usuario.tipoDocumento);

    res.json({
      credencial,
      identidad,
      documento: { nombreTipo: tipo.nombre, valido: new DocumentoIdentidad(tipo, usuario.numeroDocumento, usuario.nombreCompleto).esValido() },
      telefono: enmascarar(usuario.telefono, 3),
      rol: { ...roles.buscar(rolActual), permisos: roles.permisosDe(rolActual) },
      panel: PERMISOS_DEL_PANEL.filter((p) => credencial.permisos.includes(p) && roles.tienePermiso(rolActual, p)),
    });
  });

  return r;
}
