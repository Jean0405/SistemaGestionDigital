// Registro de personas. En el primer arranque, el mismo formulario registra al administrador.

import { api, datosFormulario, estado, mostrarEstado, notificar } from './util.js';
import { crearCamara } from './camara.js';

const formulario = document.getElementById('form-registro');
const estadoCaptura = document.getElementById('estado-captura');
const botonCapturar = document.getElementById('btn-capturar-rostro');
const camara = crearCamara(formulario.querySelector('video'));
let descriptor = null;

/** Cambia títulos y destino del formulario según si ya existe un administrador. */
export function actualizarModoRegistro() {
  const inicial = !estado.config.hayAdministrador;
  document.getElementById('registro-titulo').textContent = inicial ? 'Configuración inicial: registro del administrador' : 'Registro de ciudadano';
  document.getElementById('registro-ayuda').innerHTML = inicial
    ? 'Esta persona quedará guardada con el rol <strong>administrador</strong> y podrá gestionar roles, permisos, usuarios y entidades.'
    : 'Los nuevos registros entran con el rol <strong>ciudadano</strong>. Solo un administrador puede cambiarlo.';
}

export function iniciarRegistro({ alRegistrar }) {
  formulario.querySelector('[data-activar-camara]').addEventListener('click', async () => {
    try {
      mostrarEstado(estadoCaptura, 'Cargando el modelo de reconocimiento facial…');
      await camara.activar();
      botonCapturar.disabled = false;
      mostrarEstado(estadoCaptura, 'Cámara activa. Mira de frente y presiona "Capturar rostro".', true);
    } catch (error) {
      mostrarEstado(estadoCaptura, 'No se pudo activar la cámara: ' + error.message, false);
    }
  });

  botonCapturar.addEventListener('click', async () => {
    try {
      descriptor = await camara.capturar();
      mostrarEstado(estadoCaptura, '✅ Rostro capturado (128 valores). Se enviará cifrado al registrarte.', true);
    } catch (error) {
      mostrarEstado(estadoCaptura, error.message, false);
    }
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const salida = formulario.querySelector('[data-estado]');
    const datos = datosFormulario(formulario);

    if (datos.contrasena !== datos.confirmacion) return mostrarEstado(salida, 'Las contraseñas no coinciden.', false);
    if (!descriptor) return mostrarEstado(salida, 'Falta capturar el rostro.', false);

    const ruta = estado.config.hayAdministrador ? '/api/registro' : '/api/registro/administrador';
    const { ok, datos: respuesta } = await api('POST', ruta, {
      nombreCompleto: datos.nombreCompleto,
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento,
      telefono: datos.telefono,
      correo: datos.correo || undefined,
      contrasena: datos.contrasena,
      descriptorRostro: descriptor,
    });
    if (!ok) return mostrarEstado(salida, respuesta.error, false);

    notificar(`${respuesta.nombreCompleto} quedó registrado como ${respuesta.rol}.`);
    const documento = { tipoDocumento: datos.tipoDocumento, numeroDocumento: datos.numeroDocumento };
    formulario.reset();
    descriptor = null;
    botonCapturar.disabled = true;
    camara.apagar();
    mostrarEstado(salida, '');
    mostrarEstado(estadoCaptura, '');
    alRegistrar(documento);
  });
}
