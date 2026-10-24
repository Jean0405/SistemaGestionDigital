/** Herramientas criptográficas del sistema, todas con el módulo `crypto` nativo de Node. */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/** Hash de una contraseña o secreto con scrypt y una sal aleatoria. Se guarda como "sal:hash". */
export function hashear(secreto: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(secreto, sal, 32);
  return `${sal.toString('base64')}:${hash.toString('base64')}`;
}

/** Compara en tiempo constante, para no dar pistas por lo que tarda la respuesta. */
export function verificarHash(secreto: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(':');
  if (!sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = scryptSync(secreto, Buffer.from(sal, 'base64'), esperado.length);
  return timingSafeEqual(calculado, esperado);
}

/**
 * Cifra los datos sensibles con AES-256-GCM, que además de ocultarlos
 * detecta si alguien los modificó. Se guarda como "iv:etiqueta:datos".
 */
export class Cifrador {
  private readonly clave: Buffer;

  constructor(claveSecreta: string) {
    this.clave = scryptSync(claveSecreta, 'sgid', 32);
  }

  cifrar(texto: string): string {
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.clave, iv);
    const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    return [iv, cifrador.getAuthTag(), datos].map((parte) => parte.toString('base64')).join(':');
  }

  descifrar(guardado: string): string {
    const [iv, etiqueta, datos] = guardado.split(':').map((parte) => Buffer.from(parte, 'base64'));
    const descifrador = createDecipheriv('aes-256-gcm', this.clave, iv);
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
  }

  /** Huella fija de un dato: permite buscar a alguien por su documento sin guardar el documento en claro. */
  huella(texto: string): string {
    return createHmac('sha256', this.clave).update(texto).digest('hex');
  }
}
