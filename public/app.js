// Página de la demo: solo pide datos y pinta resultados. La lógica de los
// patrones vive en el servidor (src/web/server.ts); lo único que pasa aquí
// en el navegador es capturar el rostro con la cámara, porque eso solo se
// puede hacer del lado del cliente.

async function pedir(url, opciones) {
  const respuesta = await fetch(url, opciones);
  return respuesta.json();
}

function pintarEstado(elemento, resultado) {
  elemento.textContent = resultado.error ?? resultado.motivo;
  elemento.className = 'estado ' + (resultado.autenticado ? 'estado--ok' : 'estado--error');
}

function pintarJson(elemento, datos) {
  elemento.innerHTML = `<pre>${JSON.stringify(datos, null, 2)}</pre>`;
}

// --- Selector: elegir qué factor probar (una fábrica del Factory Method a la vez) ---

const factoresListos = new Set();

function mostrarFactor(nombre) {
  document.querySelectorAll('[data-factor]').forEach((seccion) => {
    seccion.hidden = seccion.dataset.factor !== nombre;
  });
}

function actualizarProgreso() {
  const progreso = document.getElementById('progreso-factores');
  progreso.textContent =
    factoresListos.size === 0
      ? 'Factores superados: ninguno todavía.'
      : `Factores superados: ${[...factoresListos].join(', ')} (${factoresListos.size}/3).`;
  progreso.className = 'estado' + (factoresListos.size === 3 ? ' estado--ok' : '');
}

document.getElementById('selector-factor').addEventListener('change', (evento) => {
  mostrarFactor(evento.target.value);
});

mostrarFactor('contrasena');

// --- Contraseña: registrar y luego iniciar sesión ---

document.getElementById('btn-contrasena-registrar').addEventListener('click', async () => {
  const valor = document.getElementById('in-contrasena-registro').value;
  const datos = await pedir('/api/auth/contrasena/registrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor }),
  });
  const estado = document.getElementById('estado-registro-contrasena');
  estado.textContent = datos.error ?? 'Contraseña registrada. Ya puedes iniciar sesión con ella.';
  estado.className = 'estado ' + (datos.error ? 'estado--error' : 'estado--ok');
});

document.getElementById('btn-contrasena').addEventListener('click', async () => {
  const valor = document.getElementById('in-contrasena').value;
  const resultado = await pedir('/api/auth/contrasena/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor }),
  });
  pintarEstado(document.getElementById('estado-contrasena'), resultado);
  document.getElementById('bitacora').innerHTML = (resultado.bitacora || []).map((linea) => `<li>${linea}</li>`).join('');
  if (resultado.autenticado) {
    factoresListos.add('contraseña');
    actualizarProgreso();
  }
});

// --- Token por teléfono ---

document.getElementById('btn-enviar-sms').addEventListener('click', async () => {
  const datos = await pedir('/api/sms/enviar', { method: 'POST' });
  pintarJson(document.getElementById('resultado-sms'), datos);
  document.getElementById('bandeja-sms').textContent = '';
});

document.getElementById('btn-ver-sms').addEventListener('click', async () => {
  const datos = await pedir('/api/sms/bandeja');
  const bandeja = document.getElementById('bandeja-sms');
  bandeja.textContent = datos.error ? datos.error : `📩 Mensaje nuevo: "Tu código es ${datos.codigo}"`;
  bandeja.className = 'estado ' + (datos.error ? 'estado--error' : '');
});

document.getElementById('btn-token').addEventListener('click', async () => {
  const valor = document.getElementById('in-token').value;
  const resultado = await pedir('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor }),
  });
  pintarEstado(document.getElementById('estado-token'), resultado);
  if (resultado.autenticado) {
    factoresListos.add('token-teléfono');
    actualizarProgreso();
  }
});

// Muestra el umbral real configurado, para que el número de abajo tenga contra qué compararse.
let umbralFacial = null;
pedir('/api/config').then((config) => {
  umbralFacial = config.umbralFacial;
  document.getElementById('umbral-facial').textContent = umbralFacial;
});

// --- Rostro: cámara real + face-api.js ---

const MODELOS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
let modelosListos = false;

async function asegurarModelos() {
  if (modelosListos) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODELOS_URL),
  ]);
  modelosListos = true;
}

async function capturarDescriptor() {
  const video = document.getElementById('video');
  const deteccion = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteccion) throw new Error('No se detectó un rostro. Acércate a la cámara, con buena luz.');
  return Array.from(deteccion.descriptor);
}

document.getElementById('btn-camara').addEventListener('click', async () => {
  const estado = document.getElementById('estado-rostro');
  try {
    estado.textContent = 'Cargando el modelo de reconocimiento facial...';
    estado.className = 'estado';
    await asegurarModelos();

    const video = document.getElementById('video');
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });

    document.getElementById('btn-rostro-registrar').disabled = false;
    document.getElementById('btn-rostro').disabled = false;
    estado.textContent = 'Cámara activa. Ya puedes registrar tu rostro.';
    estado.className = 'estado estado--ok';
  } catch (error) {
    estado.textContent = 'No se pudo activar la cámara: ' + error.message;
    estado.className = 'estado estado--error';
  }
});

document.getElementById('btn-rostro-registrar').addEventListener('click', async () => {
  const estado = document.getElementById('estado-rostro');
  try {
    const descriptor = await capturarDescriptor();
    const datos = await pedir('/api/auth/rostro/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor }),
    });
    estado.textContent = datos.error ?? 'Rostro registrado. Ahora puedes verificarlo.';
    estado.className = 'estado ' + (datos.error ? 'estado--error' : 'estado--ok');
  } catch (error) {
    estado.textContent = error.message;
    estado.className = 'estado estado--error';
  }
});

document.getElementById('btn-rostro').addEventListener('click', async () => {
  const estado = document.getElementById('estado-rostro');
  const detalle = document.getElementById('detalle-rostro');
  try {
    const descriptor = await capturarDescriptor();
    const resultado = await pedir('/api/auth/rostro/verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor }),
    });
    pintarEstado(estado, resultado);
    if (resultado.distancia !== undefined) {
      detalle.innerHTML = `<pre>distancia entre rostros: ${resultado.distancia.toFixed(3)} (0 = idéntico)
puntaje enviado al FlujoRostro: ${resultado.puntaje.toFixed(3)}
umbral mínimo configurado: ${umbralFacial}</pre>`;
    }
    if (resultado.autenticado) {
      factoresListos.add('rostro');
      actualizarProgreso();
    }
  } catch (error) {
    estado.textContent = error.message;
    estado.className = 'estado estado--error';
  }
});

// --- Iniciar sesión: arma el perfil completo de una sola vez ---
// (Builder + Bridge + Proxy + Composite + Flyweight, combinados en una sola respuesta)

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
  const identidadHtml = datos.identidad.error
    ? `<p class="estado estado--error">Identidad: ${datos.identidad.error}</p>`
    : `<p><strong>Identidad verificada:</strong> ${datos.identidad.nombreCompleto} · documento ${datos.identidad.documento}
        ${datos.documento ? `(${datos.documento.valido ? 'válido ✅' : 'inválido ❌'})` : ''}</p>`;

  destino.innerHTML = `
    <div class="credencial">
      <h3>🪪 Credencial digital — ${c.rol}</h3>
      <dl>
        <dt>Titular</dt><dd>${c.nombreCompleto} (${c.usuarioId})</dd>
        <dt>Factores</dt><dd>${c.factoresSuperados.join(', ')}</dd>
        <dt>Expira</dt><dd>${new Date(c.expiraEn).toLocaleTimeString()}</dd>
      </dl>
      ${identidadHtml}
      <p><strong>Accesos de tu rol:</strong> ${datos.accesos.join(', ')}</p>
    </div>
    <pre>Aviso SMS: ${JSON.stringify(datos.avisos.sms)}\nAviso correo: ${JSON.stringify(datos.avisos.correo)}</pre>
  `;
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
  document.getElementById('bandeja-sms').textContent = '';
  document.querySelectorAll('input').forEach((el) => (el.value = ''));

  const video = document.getElementById('video');
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((pista) => pista.stop());
    video.srcObject = null;
  }
  document.getElementById('btn-rostro-registrar').disabled = true;
  document.getElementById('btn-rostro').disabled = true;

  factoresListos.clear();
  actualizarProgreso();
  document.getElementById('selector-factor').value = 'contrasena';
  mostrarFactor('contrasena');
});
