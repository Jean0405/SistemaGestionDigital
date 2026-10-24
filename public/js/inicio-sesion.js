// Inicio de sesión con los tres factores, en el orden que la persona quiera.

import { api, datosFormulario, estado, fecha, guardarSesion, h, mostrarEstado, pintar } from './util.js';
import { crearCamara } from './camara.js';

const paso1 = document.getElementById('inicio-paso-1');
const paso2 = document.getElementById('inicio-paso-2');
const formInicio = document.getElementById('form-inicio');
const tarjetaRostro = document.querySelector('[data-tarjeta-factor="rostro"]');
const camara = crearCamara(tarjetaRostro.querySelector('video'));
const botonCompletar = document.getElementById('btn-completar');

let intento = null;
let superados = [];

export function prellenarDocumento({ tipoDocumento, numeroDocumento }) {
  formInicio.tipoDocumento.value = tipoDocumento;
  formInicio.numeroDocumento.value = numeroDocumento;
}

export function reiniciarInicioSesion() {
  intento = null;
  superados = [];
  camara.apagar();
  paso1.hidden = false;
  paso2.hidden = true;
  document.getElementById('btn-verificar-rostro').disabled = true;
  paso2.querySelectorAll('form').forEach((f) => f.reset());
  paso2.querySelectorAll('[data-estado]').forEach((e) => mostrarEstado(e, ''));
  ['bitacora-contrasena', 'envios-sms', 'telefono-mensajes', 'medidor-rostro'].forEach((id) => pintar(document.getElementById(id), ''));
  document.getElementById('telefono-simulado').hidden = true;
  pintarProgreso();
}

function pintarProgreso() {
  document.querySelectorAll('#progreso-factores li').forEach((li) => li.classList.toggle('hecho', superados.includes(li.dataset.factor)));
  document.querySelectorAll('[data-tarjeta-factor]').forEach((t) => t.classList.toggle('tarjeta--superada', superados.includes(t.dataset.tarjetaFactor)));
  botonCompletar.disabled = superados.length < estado.config.factoresRequeridos.length;
}

function registrarResultado(factor, tarjeta, respuesta) {
  const salida = tarjeta.querySelector('[data-estado]');
  if (!respuesta.ok) return mostrarEstado(salida, respuesta.datos.error, false);
  mostrarEstado(salida, respuesta.datos.motivo, respuesta.datos.autenticado);
  if (respuesta.datos.autenticado && !superados.includes(factor)) superados.push(factor);
  pintarProgreso();
}

async function verBandeja() {
  if (!estado.config.smsSimulado) return;
  const { ok, datos } = await api('GET', `/api/sesion/${intento.intentoId}/sms/bandeja`);
  if (!ok) return;
  document.getElementById('telefono-simulado').hidden = false;
  pintar(
    document.getElementById('telefono-mensajes'),
    datos.mensajes.map((m) => h`<div class="sms"><span>${m.texto}</span><time>${fecha(m.recibidoEn)}</time></div>`),
  );
}

export function iniciarInicioSesion({ alEntrar }) {
  formInicio.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const salida = formInicio.querySelector('[data-estado]');
    const { ok, datos } = await api('POST', '/api/sesion/iniciar', datosFormulario(formInicio));
    if (!ok) return mostrarEstado(salida, datos.error, false);

    reiniciarInicioSesion();
    intento = datos;
    document.getElementById('inicio-saludo').textContent = `Hola, ${datos.nombre}`;
    document.getElementById('telefono-numero').textContent = datos.telefono;
    paso1.hidden = true;
    paso2.hidden = false;
  });

  document.getElementById('btn-otra-persona').addEventListener('click', reiniciarInicioSesion);

  // --- Contraseña ---
  document.getElementById('form-contrasena').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const tarjeta = evento.target.closest('.tarjeta');
    const respuesta = await api('POST', `/api/sesion/${intento.intentoId}/contrasena`, { valor: evento.target.valor.value });
    registrarResultado('contraseña', tarjeta, respuesta);
    pintar(
      document.getElementById('bitacora-contrasena'),
      (respuesta.datos.bitacora ?? []).map((linea) => h`<li>${linea}</li>`),
    );
    evento.target.reset();
  });

  // --- Código al teléfono ---
  document.getElementById('btn-enviar-codigo').addEventListener('click', async () => {
    const tarjeta = document.querySelector('[data-tarjeta-factor="token-telefono"]');
    const { ok, datos } = await api('POST', `/api/sesion/${intento.intentoId}/sms`);
    if (!ok) return mostrarEstado(tarjeta.querySelector('[data-estado]'), datos.error, false);

    pintar(
      document.getElementById('envios-sms'),
      datos.envios.map((e) => h`<span class="chip ${e.enviado ? 'chip--ok' : 'chip--error'}">${e.proveedor}: ${e.enviado ? 'enviado' : 'falló'}</span>`),
    );
    mostrarEstado(tarjeta.querySelector('[data-estado]'), `Código enviado a ${datos.telefono}.`, true);
    await verBandeja();
  });

  document.getElementById('form-codigo').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const tarjeta = evento.target.closest('.tarjeta');
    registrarResultado('token-telefono', tarjeta, await api('POST', `/api/sesion/${intento.intentoId}/codigo`, { valor: evento.target.valor.value }));
  });

  // --- Rostro ---
  tarjetaRostro.querySelector('[data-activar-camara]').addEventListener('click', async () => {
    const salida = tarjetaRostro.querySelector('[data-estado]');
    try {
      mostrarEstado(salida, 'Cargando el modelo de reconocimiento facial…');
      await camara.activar();
      document.getElementById('btn-verificar-rostro').disabled = false;
      mostrarEstado(salida, 'Cámara activa.', true);
    } catch (error) {
      mostrarEstado(salida, 'No se pudo activar la cámara: ' + error.message, false);
    }
  });

  document.getElementById('btn-verificar-rostro').addEventListener('click', async () => {
    const salida = tarjetaRostro.querySelector('[data-estado]');
    let descriptor;
    try {
      descriptor = await camara.capturar();
    } catch (error) {
      return mostrarEstado(salida, error.message, false);
    }
    const respuesta = await api('POST', `/api/sesion/${intento.intentoId}/rostro`, { descriptor });
    registrarResultado('rostro', tarjetaRostro, respuesta);

    if (respuesta.datos.puntaje !== undefined) {
      const { puntaje, distancia } = respuesta.datos;
      const umbral = estado.config.umbralFacial;
      pintar(
        document.getElementById('medidor-rostro'),
        h`<div class="medidor">
          <div class="medidor__barra"><div class="medidor__valor ${puntaje >= umbral ? 'medidor__valor--ok' : ''}" style="width:${Math.round(puntaje * 100)}%"></div>
            <div class="medidor__umbral" style="left:${Math.round(umbral * 100)}%" title="umbral"></div></div>
          <small>Parecido ${puntaje.toFixed(3)} · umbral ${umbral} · distancia ${distancia.toFixed(3)} (0 = idéntico)</small>
        </div>`,
      );
      if (puntaje < umbral && puntaje > 0.3) {
        mostrarEstado(salida, `${respuesta.datos.motivo} Con cámara real, un umbral de 0.5 suele funcionar (BIOMETRIA_UMBRAL en .env).`, false);
      }
    }
  });

  // --- Entrar ---
  botonCompletar.addEventListener('click', async () => {
    const salida = botonCompletar.parentElement.querySelector('[data-estado]');
    const { ok, datos } = await api('POST', `/api/sesion/${intento.intentoId}/completar`);
    if (!ok) return mostrarEstado(salida, datos.error, false);

    guardarSesion(datos.token, datos.avisos);
    reiniciarInicioSesion();
    formInicio.reset();
    alEntrar();
  });
}
