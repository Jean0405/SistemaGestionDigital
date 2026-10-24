import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { CredencialDigital } from '../../domain/credencial/credencial-digital';

export type CredencialFirmada = CredencialDigital & { jti: string };

function aBase64(datos: object): string {
  return Buffer.from(JSON.stringify(datos)).toString('base64url');
}

/**
 * Convierte la credencial que arma el Builder en un JWT firmado con
 * HMAC-SHA256 (HS256) y el JWT_SECRET del Singleton. Si alguien cambia
 * un solo carácter del token, la firma deja de cuadrar.
 */
export class TokensJwt {
  private readonly revocados = new Set<string>();

  constructor(private readonly secreto: string) {}

  emitir(credencial: CredencialDigital): string {
    const cabecera = aBase64({ alg: 'HS256', typ: 'JWT' });
    const contenido = aBase64({ ...credencial, jti: randomUUID() });
    return `${cabecera}.${contenido}.${this.firmar(`${cabecera}.${contenido}`)}`;
  }

  /** Devuelve la credencial si la firma es correcta, no expiró y no fue revocada. */
  verificar(token: string): CredencialFirmada {
    const [cabecera, contenido, firma = ''] = String(token).split('.');
    const esperada = this.firmar(`${cabecera}.${contenido}`);
    if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
      throw new Error('La firma del token no es válida.');
    }

    const credencial: CredencialFirmada = JSON.parse(Buffer.from(contenido, 'base64url').toString('utf8'));
    if (credencial.expiraEn <= Date.now()) throw new Error('El token expiró.');
    if (this.revocados.has(credencial.jti)) throw new Error('El token fue revocado.');
    return credencial;
  }

  revocar(token: string): void {
    this.revocados.add(this.verificar(token).jti);
  }

  private firmar(texto: string): string {
    return createHmac('sha256', this.secreto).update(texto).digest('base64url');
  }
}
