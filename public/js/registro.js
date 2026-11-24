// Registro de personas. En el primer arranque, el mismo formulario registra al administrador.

import { api, datosFormulario, estado, mostrarEstado, notificar } from './util.js';
import { crearCamara } from './camara.js';

const formulario = document.getElementById('form-registro');
const marco = document.getElementById('marco-camara-registro');
const avisoCamara = marco.querySelector('.marco-camara__aviso');
const estadoCaptura = document.getElementById('estado-captura');
const botonActivar = formulario.querySelector('[data-activar-camara]');
const botonCapturar = document.getElementById('btn-capturar-rostro');
const camara = crearCamara(marco.querySelector('video'));
let descriptor = null;

/** Cambia el título y la regla de la contraseña según si ya existe un administrador. */
export function actualizarModoRegistro() {
  const inicial = !estado.config.hayAdministrador;
  document.getElementById('registro-titulo').textContent = inicial ? 'Crear la cuenta del administrador' : 'Crear cuenta';
  // La regla cambia según quién se registra (Strategy en el servidor).
  document.getElementById('regla-contrasena').textContent = `Debe tener ${estado.config.reglaContrasena}.`;
}

function reiniciarRostro() {
  descriptor = null;
  camara.apagar();
  marco.classList.remove('listo');
  avisoCamara.textContent = 'Cámara apagada';
  botonActivar.hidden = false;
  botonCapturar.disabled = true;
  mostrarEstado(estadoCaptura, '');
}

export function iniciarRegistro({ alRegistrar }) {
  botonActivar.addEventListener('click', async () => {
    try {
      avisoCamara.textContent = 'Encendiendo la cámara…';
      await camara.activar();
      avisoCamara.textContent = '';
      marco.classList.add('listo');
      botonCapturar.disabled = false;
      botonActivar.hidden = true;
      mostrarEstado(estadoCaptura, 'Mira de frente y presiona "Capturar rostro".');
    } catch (error) {
      avisoCamara.textContent = 'Cámara no disponible';
      mostrarEstado(estadoCaptura, 'No se pudo activar la cámara: ' + error.message, false);
    }
  });

  botonCapturar.addEventListener('click', async () => {
    try {
      mostrarEstado(estadoCaptura, 'Analizando…');
      descriptor = await camara.capturar();
      camara.apagar();
      avisoCamara.textContent = '✓ Rostro registrado';
      botonCapturar.disabled = true;
      botonActivar.hidden = false;
      mostrarEstado(estadoCaptura, 'Rostro capturado. Si quieres repetirlo, activa la cámara de nuevo.', true);
    } catch (error) {
      mostrarEstado(estadoCaptura, error.message, false);
    }
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const salida = formulario.querySelector(':scope > [data-estado]');
    const datos = datosFormulario(formulario);

    if (datos.contrasena !== datos.confirmacion) return mostrarEstado(salida, 'Las contraseñas no coinciden.', false);
    if (!descriptor) return mostrarEstado(salida, 'Falta registrar tu rostro (paso 4).', false);

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

    notificar(`Cuenta creada. Ahora inicia sesión, ${respuesta.nombreCompleto.split(' ')[0]}.`);
    const documento = { tipoDocumento: datos.tipoDocumento, numeroDocumento: datos.numeroDocumento };
    formulario.reset();
    reiniciarRostro();
    mostrarEstado(salida, '');
    alRegistrar(documento);
  });
}
