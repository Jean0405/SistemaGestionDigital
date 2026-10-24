/** Middlewares de seguridad: encabezados HTTP, token, permisos y manejo de errores. */
import { NextFunction, Request, Response } from 'express';
import { ErrorDeNegocio } from '../application/comun';
import { Sistema } from './app';

export function encabezadosSeguridad(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // face-api.js y sus modelos vienen de jsDelivr; tfjs necesita 'unsafe-eval'.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval'; connect-src 'self' https://cdn.jsdelivr.net; " +
      "img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'",
  );
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * Exige `Authorization: Bearer <token>` válido y deja la credencial en `res.locals.credencial`.
 * Un token entregado a un servicio conectado (con `aud`) solo sirve en la API de servicios,
 * y uno de sesión de SGID solo sirve dentro de SGID.
 */
export function requiereToken(sistema: Sistema, paraServicio = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    if (esquema !== 'Bearer' || !token) throw new ErrorDeNegocio('Falta el token de acceso.', 401, 'invalid_token');
    try {
      res.locals.credencial = sistema.tokens.verificar(token);
      res.locals.token = token;
    } catch (error) {
      throw new ErrorDeNegocio((error as Error).message, 401, 'invalid_token');
    }
    if (Boolean(res.locals.credencial.aud) !== paraServicio) {
      throw new ErrorDeNegocio('Este token no sirve para esta ruta.', 401, 'invalid_token');
    }
    next();
  };
}

/** El token debe ser de una persona registrada. Su rol actual queda en `res.locals.rolActual`. */
export function requiereUsuario(sistema: Sistema) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const usuario = sistema.usuarios.buscarPorId(res.locals.credencial.usuarioId);
    if (!usuario) throw new ErrorDeNegocio('El token no es de una persona registrada.', 401, 'invalid_token');
    res.locals.usuario = usuario;
    res.locals.rolActual = usuario.rol;
    next();
  };
}

/**
 * Exige un permiso en el token *y* en el rol que la cuenta tiene ahora mismo
 * (Composite). Así, quitar un permiso o bajar un rol corta el acceso de
 * inmediato, aunque el token siga vigente.
 */
export function requierePermiso(sistema: Sistema, permiso: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const enToken = res.locals.credencial.permisos.includes(permiso);
    if (!enToken || !sistema.roles.tienePermiso(res.locals.rolActual, permiso)) {
      throw new ErrorDeNegocio(`Acceso denegado: falta el permiso "${permiso}".`, 403, 'insufficient_scope');
    }
    next();
  };
}

/** Traduce los errores a JSON. Los inesperados responden 500 sin dar detalles internos. */
export function manejarErrores(error: Error, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ErrorDeNegocio) {
    // La API de servicios usa la forma de error de OAuth2, que es la que esperan otros sistemas.
    const cuerpo = req.path.startsWith('/api/gov/')
      ? { error: error.codigo, error_description: error.message }
      : { error: error.message };
    res.status(error.estado).json(cuerpo);
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
