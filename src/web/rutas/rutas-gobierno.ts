/**
 * API para los servicios del Estado que inician sesión con SGID (OAuth2):
 *
 *   GET  /autorizar?client_id&redirect_uri&state  → la persona inicia sesión en SGID (página web)
 *   POST /api/gov/v1/oauth/token                  → el servicio canjea el código por un token
 *   GET  /api/gov/v1/usuario                      → el servicio lee la identidad verificada
 */
import { Router } from 'express';
import { Sistema } from '../app';
import { requierePermiso, requiereToken, requiereUsuario } from '../seguridad-http';
import { ErrorDeNegocio } from '../../application/comun';

export function rutasGobierno(sistema: Sistema): Router {
  const r = Router();

  r.post('/oauth/token', (req, res) => {
    const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;
    if (grant_type !== 'authorization_code') {
      throw new ErrorDeNegocio('Solo se admite grant_type=authorization_code.', 400, 'unsupported_grant_type');
    }
    res.json(sistema.integracion.canjearCodigo(code, client_id, client_secret, redirect_uri));
  });

  r.get(
    '/usuario',
    requiereToken(sistema, true),
    requiereUsuario(sistema),
    requierePermiso(sistema, 'consultar-identidad'),
    (_req, res) => res.json(sistema.integracion.datosDeUsuario(res.locals.credencial)),
  );

  return r;
}
