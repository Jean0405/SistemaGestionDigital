/**
 * Template Method. Exportar la auditoría siempre sigue los mismos pasos:
 * dejar constancia de la descarga, verificar la cadena de hashes y armar el
 * archivo con encabezado, filas y pie. Ese orden vive en `exportar()` y no
 * se cambia; cada formato (JSON, CSV) solo redefine cómo se escribe cada parte.
 */
import { BitacoraAuditoria, RegistroAuditoria } from '../../infrastructure/auditoria/bitacora-auditoria';

type Integridad = ReturnType<BitacoraAuditoria['verificar']>;

export interface ArchivoExportado {
  nombre: string;
  tipo: string;
  contenido: string;
}

export abstract class ExportadorAuditoria {
  protected abstract readonly extension: string;
  protected abstract readonly tipo: string;

  /** El método plantilla: los pasos y su orden son iguales para todos los formatos. */
  exportar(bitacora: BitacoraAuditoria, actor: string): ArchivoExportado {
    bitacora.registrar({ actor, accion: 'auditoria.exportar', resultado: 'exito', detalle: `Descarga completa en ${this.extension.toUpperCase()}` });
    const integridad = bitacora.verificar();
    const registros = bitacora.listar();

    const contenido = this.encabezado(integridad) + registros.map((r) => this.fila(r)).join(this.separador()) + this.pie(registros.length);
    const fecha = new Date().toISOString().slice(0, 10);
    return { nombre: `auditoria-sgid-${fecha}.${this.extension}`, tipo: this.tipo, contenido };
  }

  // Pasos que cada formato debe escribir.
  protected abstract encabezado(integridad: Integridad): string;
  protected abstract fila(registro: RegistroAuditoria): string;

  // Ganchos (hooks): tienen un valor por defecto y un formato puede cambiarlos si lo necesita.
  protected separador(): string {
    return '\n';
  }

  protected pie(_total: number): string {
    return '\n';
  }
}

/** JSON con la integridad y la lista de registros, como lo descargaba el panel. */
export class ExportadorJson extends ExportadorAuditoria {
  protected readonly extension = 'json';
  protected readonly tipo = 'application/json';

  protected encabezado(integridad: Integridad): string {
    return `{\n  "integridad": ${JSON.stringify(integridad)},\n  "registros": [\n`;
  }

  protected fila(registro: RegistroAuditoria): string {
    return '    ' + JSON.stringify(registro);
  }

  protected separador(): string {
    return ',\n';
  }

  protected pie(): string {
    return '\n  ]\n}\n';
  }
}

/** CSV para abrir en Excel u hojas de cálculo: una columna por campo. */
export class ExportadorCsv extends ExportadorAuditoria {
  protected readonly extension = 'csv';
  protected readonly tipo = 'text/csv';
  private readonly columnas: (keyof RegistroAuditoria)[] = ['numero', 'fecha', 'actor', 'accion', 'resultado', 'detalle', 'hashAnterior', 'hash'];

  protected encabezado(): string {
    return this.columnas.join(',') + '\n';
  }

  protected fila(registro: RegistroAuditoria): string {
    return this.columnas.map((columna) => celda(registro[columna])).join(',');
  }
}

/** Entre comillas y sin dejar que Excel lo tome como fórmula (=, +, -, @). */
function celda(valor: unknown): string {
  let texto = String(valor);
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  return `"${texto.replace(/"/g, '""')}"`;
}
