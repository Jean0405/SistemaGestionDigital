import fs from 'fs';
import { createHash } from 'crypto';

export interface RegistroAuditoria {
  numero: number;
  fecha: string;
  actor: string;
  accion: string;
  resultado: 'exito' | 'fallo' | 'denegado';
  detalle: string;
  hashAnterior: string;
  hash: string;
}

/** Lo que se quiere registrar: quién hizo qué y cómo terminó. */
export type EventoAuditoria = Pick<RegistroAuditoria, 'actor' | 'accion' | 'resultado' | 'detalle'>;

const HASH_INICIAL = '0'.repeat(64);

function calcularHash(r: Omit<RegistroAuditoria, 'hash'>): string {
  const contenido = [r.numero, r.fecha, r.actor, r.accion, r.resultado, r.detalle, r.hashAnterior].join('|');
  return createHash('sha256').update(contenido).digest('hex');
}

/**
 * Bitácora de auditoría: un archivo con un evento por línea, al que solo se
 * agrega. Cada registro guarda el hash del anterior, como una cadena: si
 * alguien edita o borra una línea, la verificación lo detecta.
 */
export class BitacoraAuditoria {
  constructor(private readonly ruta: string) {}

  registrar(evento: EventoAuditoria): RegistroAuditoria {
    const registros = this.listar();
    const anterior = registros[registros.length - 1];
    const sinHash = {
      numero: registros.length + 1,
      fecha: new Date().toISOString(),
      ...evento,
      hashAnterior: anterior ? anterior.hash : HASH_INICIAL,
    };
    const registro = { ...sinHash, hash: calcularHash(sinHash) };
    fs.appendFileSync(this.ruta, JSON.stringify(registro) + '\n');
    return registro;
  }

  listar(): RegistroAuditoria[] {
    if (!fs.existsSync(this.ruta)) return [];
    const lineas = fs.readFileSync(this.ruta, 'utf8').split('\n').filter((linea) => linea.trim() !== '');
    return lineas.map((linea) => JSON.parse(linea));
  }

  /** Recalcula la cadena completa. `rotaEn` es el primer registro que no cuadra. */
  verificar(): { integra: boolean; total: number; rotaEn: number | null } {
    let registros: RegistroAuditoria[];
    try {
      registros = this.listar();
    } catch {
      return { integra: false, total: 0, rotaEn: 1 }; // alguna línea ya ni siquiera es JSON
    }

    let hashAnterior = HASH_INICIAL;
    for (let i = 0; i < registros.length; i++) {
      const { hash, ...resto } = registros[i];
      if (resto.numero !== i + 1 || resto.hashAnterior !== hashAnterior || calcularHash(resto) !== hash) {
        return { integra: false, total: registros.length, rotaEn: i + 1 };
      }
      hashAnterior = hash;
    }
    return { integra: true, total: registros.length, rotaEn: null };
  }
}
