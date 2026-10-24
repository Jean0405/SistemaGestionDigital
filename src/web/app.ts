/**
 * Arma el sistema (crea cada pieza y la conecta con las demás) y la
 * aplicación web Express que lo expone. Las rutas solo traducen HTTP a
 * llamadas de los servicios; la lógica vive en application/.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { ConfigManager } from '../infrastructure/config/config-manager';
import { ServicioConectado } from '../domain/usuarios/usuario';
import { BitacoraAuditoria } from '../infrastructure/auditoria/bitacora-auditoria';
import { ColeccionJson } from '../infrastructure/persistencia/coleccion-json';
import { RepositorioUsuariosArchivo } from '../infrastructure/persistencia/repositorio-usuarios-archivo';
import { Cifrador } from '../infrastructure/seguridad/criptografia';
import { TokensJwt } from '../infrastructure/seguridad/tokens-jwt';
import { GestorRoles } from '../application/permisos/gestor-roles';
import { ServicioUsuarios } from '../application/usuarios/servicio-usuarios';
import { ServicioInicioSesion } from '../application/auth/servicio-inicio-sesion';
import { ServicioIntegracion } from '../application/integracion/servicio-integracion';
import { encabezadosSeguridad, manejarErrores } from './seguridad-http';
import { rutasSesion } from './rutas/rutas-sesion';
import { rutasAdmin } from './rutas/rutas-admin';
import { rutasGobierno } from './rutas/rutas-gobierno';

/** Crea todas las piezas. Los datos quedan en `directorio` (por defecto, la carpeta `data/`). */
export function crearSistema(directorio?: string) {
  const config = ConfigManager.getInstance();
  const carpeta = path.resolve(directorio ?? config.obtener('datosDirectorio'));
  fs.mkdirSync(carpeta, { recursive: true });

  const cifrador = new Cifrador(config.obtener('cifradoClave'));
  const tokens = new TokensJwt(config.obtener('jwtSecret'));
  const auditoria = new BitacoraAuditoria(path.join(carpeta, 'auditoria.jsonl'));

  const repositorioUsuarios = new RepositorioUsuariosArchivo(new ColeccionJson(path.join(carpeta, 'usuarios.json'), 'usuarioId'), cifrador);
  const roles = new GestorRoles(new ColeccionJson(path.join(carpeta, 'roles.json'), 'nombre'), auditoria);
  const usuarios = new ServicioUsuarios(repositorioUsuarios, roles, cifrador, auditoria);
  const sesiones = new ServicioInicioSesion(usuarios, roles, tokens, auditoria);
  const servicios = new ColeccionJson<ServicioConectado>(path.join(carpeta, 'servicios.json'), 'clienteId');
  const integracion = new ServicioIntegracion(servicios, repositorioUsuarios, usuarios, tokens, auditoria);

  return {
    config,
    carpeta,
    auditoria,
    tokens,
    roles,
    repositorioUsuarios,
    usuarios,
    sesiones,
    integracion,
    /** El teléfono simulado (ver el SMS en pantalla) solo existe fuera de producción. */
    smsSimulado: config.obtener('entorno') !== 'production',
  };
}

export type Sistema = ReturnType<typeof crearSistema>;

export function crearApp(directorio?: string) {
  const sistema = crearSistema(directorio);
  const app = express();

  app.disable('x-powered-by');
  app.use(encabezadosSeguridad);
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false })); // OAuth2 suele mandar el token como formulario

  app.use('/api/gov/v1', rutasGobierno(sistema));
  app.use('/api/admin', rutasAdmin(sistema));
  app.use('/api', rutasSesion(sistema));

  // Aquí llegan las personas que vienen desde un servicio del Estado ("Iniciar sesión con SGID").
  const publico = path.join(__dirname, '../../public');
  app.get('/autorizar', (_req, res) => res.sendFile(path.join(publico, 'index.html')));
  app.use(express.static(publico));
  app.use(manejarErrores);

  return { app, sistema };
}
