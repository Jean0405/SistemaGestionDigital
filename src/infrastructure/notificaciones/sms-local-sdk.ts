/** SDK de otro proveedor de SMS, con una forma distinta a la del primero. */
export class SmsLocalSDK {
  enviarTexto(opciones: { numero: string; texto: string }): string {
    if (!opciones.numero.trim() || !opciones.texto.trim()) {
      throw new Error('Número o texto vacío.');
    }
    return `local-${opciones.numero}-${Date.now()}`;
  }
}
