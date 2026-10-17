import { DatosIdentidad, RepositorioIdentidad } from '../../domain/identidad/repositorio-identidad';

/** Sujeto real: el lugar donde en verdad viven los datos de identidad. */
const datos: Record<string, DatosIdentidad> = {
  'ciudadano-001': { usuarioId: 'ciudadano-001', nombreCompleto: 'Ana Pérez', documento: '1005184201' },
};

export class RepositorioIdentidadMemoria implements RepositorioIdentidad {
  obtener(usuarioId: string): DatosIdentidad {
    const encontrado = datos[usuarioId];
    if (!encontrado) {
      throw new Error(`No existe identidad para "${usuarioId}".`);
    }
    return encontrado;
  }
}
