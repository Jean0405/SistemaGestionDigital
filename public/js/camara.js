// Cámara + face-api.js: en el navegador se calcula el "descriptor" del rostro
// (128 números). Es lo único que se envía al servidor; nunca una foto.

const MODELOS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
let modelos = null;

function cargarModelos() {
  if (!window.faceapi) return Promise.reject(new Error('No se pudo cargar face-api.js (¿hay internet?).'));
  modelos ??= Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODELOS_URL),
  ]).catch((error) => {
    modelos = null;
    throw error;
  });
  return modelos;
}

/** Controla un <video> concreto: activar, capturar el descriptor y apagar. */
export function crearCamara(video) {
  return {
    async activar() {
      await cargarModelos();
      if (!video.srcObject) video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
    },

    async capturar() {
      const deteccion = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!deteccion) throw new Error('No se detectó un rostro. Mira a la cámara, con buena luz.');
      return Array.from(deteccion.descriptor);
    },

    apagar() {
      if (!video.srcObject) return;
      video.srcObject.getTracks().forEach((pista) => pista.stop());
      video.srcObject = null;
    },
  };
}
