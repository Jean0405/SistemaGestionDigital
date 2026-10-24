/**
 * Punto de entrada de la interfaz web: `npm run web`.
 * Los datos (usuarios, roles, entidades y auditoría) quedan en la carpeta
 * `data/`, así que sobreviven a un reinicio.
 */
import fs from 'fs';
import { crearApp } from './app';

// Lee `.env` si existe, antes de que el Singleton cargue la configuración.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const { app, sistema } = crearApp();
const puerto = sistema.config.obtener('puertoApi');

app.listen(puerto, () => {
  console.log(`SGID escuchando en http://localhost:${puerto}`);
  console.log(`Datos guardados en ${sistema.carpeta}`);
  if (!sistema.usuarios.hayAdministrador()) console.log('Primer arranque: abre la página y registra al administrador.');
});
