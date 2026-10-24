/**
 * API de integración para otras entidades del Estado:
 *
 *   POST /api/gov/v1/oauth/token          → token de acceso (OAuth2 client credentials)
 *   POST /api/gov/v1/identidades/validar  → ¿este documento es de una persona registrada?
 */
import { Router } from 'express';
import { Sistema } from '../app';
import { requiereEntidad, requierePermiso, requiereToken } from '../seguridad-http';
import { ErrorDeNegocio } from '../../application/comun';
import { PERMISO_VALIDAR } from '../../application/integracion/servicio-integracion';

export function rutasGobierno(sistema: Sistema): Router {
  const r = Router();

  r.post('/oauth/token', (req, res) => {
    if (req.body.grant_type !== 'client_credentials') {
      throw new ErrorDeNegocio('Solo se admite grant_type=client_credentials.', 400, 'unsupported_grant_type');
    }
    res.json(sistema.integracion.emitirToken(req.body.client_id, req.body.client_secret));
  });

  r.post(
    '/identidades/validar',
    requiereToken(sistema),
    requiereEntidad(sistema),
    requierePermiso(sistema, PERMISO_VALIDAR),
    (req, res) => res.json(sistema.integracion.validarIdentidad(res.locals.credencial, req.body)),
  );

  return r;
}
