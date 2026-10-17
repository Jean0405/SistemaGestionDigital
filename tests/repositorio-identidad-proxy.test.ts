/** Pruebas del Proxy: controla el acceso al repositorio real según el permiso de la credencial. */
import { RepositorioIdentidad } from '../src/domain/identidad/repositorio-identidad';
import { CredencialDigital } from '../src/domain/credencial/credencial-digital';
import { RepositorioIdentidadMemoria } from '../src/infrastructure/identidad/repositorio-identidad-memoria';
import { RepositorioIdentidadProxy } from '../src/application/identidad/repositorio-identidad-proxy';

function credencialCon(permisos: string[]): CredencialDigital {
  return {
    usuarioId: 'u1',
    nombreCompleto: 'Ana',
    rol: 'ciudadano',
    permisos,
    factoresSuperados: ['contraseña'],
    emitidaEn: Date.now(),
    expiraEn: Date.now() + 60_000,
  };
}

// Valida que el proxy deja pasar la consulta cuando la credencial tiene el permiso requerido.
test('permite el acceso cuando la credencial tiene el permiso', () => {
  const proxy = new RepositorioIdentidadProxy(new RepositorioIdentidadMemoria(), credencialCon(['consultar-identidad']));

  expect(proxy.obtener('ciudadano-001').nombreCompleto).toBe('Ana Pérez');
});

// Valida que el proxy bloquea el acceso sin llegar a tocar el repositorio real.
test('bloquea el acceso cuando falta el permiso, sin consultar al repositorio real', () => {
  let llamadasAlReal = 0;
  const real: RepositorioIdentidad = {
    obtener: (usuarioId) => {
      llamadasAlReal += 1;
      return { usuarioId, nombreCompleto: '', documento: '' };
    },
  };
  const proxy = new RepositorioIdentidadProxy(real, credencialCon([]));

  expect(() => proxy.obtener('ciudadano-001')).toThrow(/permiso/i);
  expect(llamadasAlReal).toBe(0);
});

// Valida que el proxy se puede usar donde se espera cualquier RepositorioIdentidad.
test('el proxy cumple la misma interfaz que el repositorio real', () => {
  const consultar = (repo: RepositorioIdentidad, id: string) => repo.obtener(id);
  const proxy = new RepositorioIdentidadProxy(new RepositorioIdentidadMemoria(), credencialCon(['consultar-identidad']));

  expect(consultar(proxy, 'ciudadano-001').usuarioId).toBe('ciudadano-001');
});
