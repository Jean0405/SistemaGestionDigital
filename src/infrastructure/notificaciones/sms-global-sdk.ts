/** SDK de un proveedor externo de SMS. Su forma es la que el proveedor decidió, no nosotros. */
export class SmsGlobalSDK {
  sendMessage(to: string, body: string): { status: 'SENT' | 'FAILED'; id: string } {
    if (!to.trim() || !body.trim()) {
      return { status: 'FAILED', id: '' };
    }
    return { status: 'SENT', id: `sg-${Date.now()}` };
  }
}
