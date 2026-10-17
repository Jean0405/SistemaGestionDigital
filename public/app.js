// Página de la demo: solo pide datos y pinta resultados. Toda la lógica de los
// patrones vive en el servidor (src/web/server.ts), que a su vez reutiliza las
// mismas clases de las demás demos.

async function pedir(url, opciones) {
  const respuesta = await fetch(url, opciones);
  return respuesta.json();
}

function pintarEstado(elemento, resultado) {
  elemento.textContent = resultado.motivo;
  elemento.className = 'estado ' + (resultado.autenticado ? 'estado--ok' : 'estado--error');
}

function pintarJson(elemento, datos) {
  elemento.innerHTML = `<pre>${JSON.stringify(datos, null, 2)}</pre>`;
}

// --- Paso 1: Adapter ---
document.getElementById('btn-enviar-sms').addEventListener('click', async () => {
  const datos = await pedir('/api/sms/enviar', { method: 'POST' });
  pintarJson(document.getElementById('resultado-sms'), datos);
});

// --- Paso 2: Factory Method + Decorator ---
async function verificarFactor(idInput, idEstado, ruta) {
  const valor = document.getElementById(idInput).value;
  const resultado = await pedir(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor }),
  });
  pintarEstado(document.getElementById(idEstado), resultado);
  return resultado;
}

document.getElementById('btn-contrasena').addEventListener('click', async () => {
  const resultado = await verificarFactor('in-contrasena', 'estado-contrasena', '/api/auth/contrasena');
  const lista = document.getElementById('bitacora');
  lista.innerHTML = (resultado.bitacora || []).map((linea) => `<li>${linea}</li>`).join('');
});

document.getElementById('btn-token').addEventListener('click', () => {
  verificarFactor('in-token', 'estado-token', '/api/auth/token');
});

document.getElementById('btn-rostro').addEventListener('click', () => {
  verificarFactor('in-rostro', 'estado-rostro', '/api/auth/rostro');
});

// --- Paso 3: Builder + Bridge ---
document.getElementById('btn-emitir').addEventListener('click', async () => {
  const rol = document.getElementById('in-rol').value;
  const datos = await pedir('/api/credencial/emitir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol }),
  });

  const destino = document.getElementById('resultado-credencial');
  if (datos.error) {
    destino.innerHTML = `<div class="estado estado--error">${datos.error}</div>`;
    return;
  }

  const c = datos.credencial;
  destino.innerHTML = `
    <div class="credencial">
      <h3>🪪 Credencial digital — ${c.rol}</h3>
      <dl>
        <dt>Titular</dt><dd>${c.nombreCompleto} (${c.usuarioId})</dd>
        <dt>Permisos</dt><dd>${c.permisos.join(', ')}</dd>
        <dt>Factores</dt><dd>${c.factoresSuperados.join(', ')}</dd>
        <dt>Expira</dt><dd>${new Date(c.expiraEn).toLocaleTimeString()}</dd>
      </dl>
    </div>
    <pre>Aviso SMS: ${JSON.stringify(datos.avisos.sms)}\nAviso correo: ${JSON.stringify(datos.avisos.correo)}</pre>
  `;
});

// --- Paso 4: Proxy ---
document.getElementById('btn-identidad').addEventListener('click', async () => {
  const datos = await pedir('/api/identidad');
  pintarJson(document.getElementById('resultado-identidad'), datos);
});

// --- Paso 5: Composite ---
document.getElementById('btn-permiso').addEventListener('click', async () => {
  const rol = document.getElementById('in-rol-permiso').value;
  const permiso = document.getElementById('in-permiso').value;
  const datos = await pedir(`/api/permisos?rol=${encodeURIComponent(rol)}&permiso=${encodeURIComponent(permiso)}`);
  pintarJson(document.getElementById('resultado-permiso'), datos);
});

// --- Paso 6: Flyweight ---
document.getElementById('btn-documento').addEventListener('click', async () => {
  const numero = document.getElementById('in-documento').value;
  const datos = await pedir(`/api/documento/${encodeURIComponent(numero)}`);
  pintarJson(document.getElementById('resultado-documento'), datos);
});

// --- Reiniciar ---
document.getElementById('btn-reset').addEventListener('click', async () => {
  await pedir('/api/reset', { method: 'POST' });
  document.querySelectorAll('.resultado').forEach((el) => (el.innerHTML = ''));
  document.querySelectorAll('.estado').forEach((el) => {
    el.textContent = '';
    el.className = 'estado';
  });
  document.getElementById('bitacora').innerHTML = '';
  document.querySelectorAll('input').forEach((el) => (el.value = ''));
});
