// Simulador de una entidad externa que consume la API de integración.
// Muestra la petición y la respuesta tal como viajan, para explicar el flujo.

import { api, datosFormulario, intercambioHttp, pintar } from './util.js';

const formToken = document.getElementById('form-gov-token');
const formValidar = document.getElementById('form-gov-validar');

/** Llena el paso 1 con las credenciales recién creadas en el panel. */
export function prellenarEntidad({ clienteId, secreto }) {
  formToken.client_id.value = clienteId;
  formToken.client_secret.value = secreto;
}

export function iniciarGobierno() {
  formToken.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const { client_id, client_secret } = datosFormulario(formToken);
    const cuerpo = { grant_type: 'client_credentials', client_id, client_secret };
    const respuesta = await api('POST', '/api/gov/v1/oauth/token', cuerpo, null);

    const peticion = `POST /api/gov/v1/oauth/token\nContent-Type: application/json\n\n${JSON.stringify(
      { ...cuerpo, client_secret: '••••••••' },
      null,
      2,
    )}`;
    pintar(document.getElementById('gov-token-resultado'), intercambioHttp(peticion, respuesta));
    if (respuesta.ok) formValidar.token.value = respuesta.datos.access_token;
  });

  formValidar.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const { token, tipoDocumento, numeroDocumento, nombreCompleto } = datosFormulario(formValidar);
    const cuerpo = { tipoDocumento, numeroDocumento, ...(nombreCompleto ? { nombreCompleto } : {}) };
    const respuesta = await api('POST', '/api/gov/v1/identidades/validar', cuerpo, token);

    const peticion = `POST /api/gov/v1/identidades/validar\nAuthorization: Bearer ${token.slice(0, 24)}…\nContent-Type: application/json\n\n${JSON.stringify(cuerpo, null, 2)}`;
    pintar(document.getElementById('gov-validar-resultado'), intercambioHttp(peticion, respuesta));
  });
}
