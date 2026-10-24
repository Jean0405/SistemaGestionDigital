// Servicio de prueba que usa "Iniciar sesión con SGID" (OAuth2, authorization code).
// En un servicio real, el canje del código se hace en su servidor, nunca en el navegador:
// aquí está en el navegador solo para poder mostrar el flujo sin otro servidor.

const URL_RETORNO = `${location.origin}/servicio-demo.html`;
const formulario = document.getElementById('form-configuracion');
const mensaje = document.getElementById('mensaje');

function leerCredenciales() {
  try {
    return JSON.parse(localStorage.getItem('sgid.servicioDePrueba') ?? 'null');
  } catch {
    return null;
  }
}

function guardarCredenciales(credenciales) {
  try {
    localStorage.setItem('sgid.servicioDePrueba', JSON.stringify(credenciales));
  } catch {
    // sin almacenamiento: hay que volver a escribirlas
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
  mensaje.hidden = false;
}

/** Paso 1: mandar a la persona a SGID. */
function iniciarSesionConSgid() {
  if (!formulario.reportValidity()) {
    document.getElementById('configuracion').open = true;
    return;
  }
  const credenciales = { clienteId: formulario.clienteId.value.trim(), secreto: formulario.secreto.value.trim() };
  guardarCredenciales(credenciales);

  const state = crypto.randomUUID(); // para comprobar que la respuesta es de este intento
  sessionStorage.setItem('sgid.state', state);
  const destino = new URL('/autorizar', location.origin);
  destino.searchParams.set('client_id', credenciales.clienteId);
  destino.searchParams.set('redirect_uri', URL_RETORNO);
  destino.searchParams.set('state', state);
  location.href = destino.toString();
}

/** Paso 4: SGID devolvió un código; se canjea por un token y se piden los datos de la persona. */
async function recibirCodigo(codigo, state) {
  history.replaceState(null, '', URL_RETORNO);
  if (state !== sessionStorage.getItem('sgid.state')) return mostrarMensaje('La respuesta no corresponde a este inicio de sesión.');

  const credenciales = leerCredenciales();
  const respuestaToken = await fetch('/api/gov/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: URL_RETORNO,
      client_id: credenciales?.clienteId,
      client_secret: credenciales?.secreto,
    }),
  });
  const token = await respuestaToken.json();
  if (!respuestaToken.ok) return mostrarMensaje(token.error_description ?? 'No se pudo canjear el código.');

  const respuestaUsuario = await fetch('/api/gov/v1/usuario', { headers: { Authorization: `Bearer ${token.access_token}` } });
  const persona = await respuestaUsuario.json();
  if (!respuestaUsuario.ok) return mostrarMensaje(persona.error_description ?? 'No se pudieron leer los datos.');

  document.getElementById('bienvenida').textContent = `Bienvenido, ${persona.nombreCompleto}`;
  const filas = [
    ['Documento', `${persona.tipoDocumento} ${persona.numeroDocumento}`],
    ['Verificado con', persona.factores.join(', ')],
    ['Identificador SGID', persona.sub],
  ];
  const lista = document.getElementById('datos-persona');
  filas.forEach(([nombre, valor]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = nombre;
    dd.textContent = valor;
    lista.append(dt, dd);
  });
  document.getElementById('respuesta-sgid').textContent = JSON.stringify(persona, null, 2);
  document.getElementById('vista-ingreso').hidden = true;
  document.getElementById('vista-bienvenida').hidden = false;
}

const guardadas = leerCredenciales();
if (guardadas) {
  formulario.clienteId.value = guardadas.clienteId;
  formulario.secreto.value = guardadas.secreto;
} else {
  document.getElementById('configuracion').open = true;
}

document.getElementById('btn-sgid').addEventListener('click', iniciarSesionConSgid);
document.getElementById('btn-salir').addEventListener('click', () => location.replace(URL_RETORNO));

const parametros = new URLSearchParams(location.search);
if (parametros.get('code')) recibirCodigo(parametros.get('code'), parametros.get('state'));
if (parametros.get('error') === 'access_denied') {
  history.replaceState(null, '', URL_RETORNO);
  mostrarMensaje('Cancelaste el inicio de sesión en SGID.');
}

window.lucide?.createIcons();
