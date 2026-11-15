import { describe, expect, it } from 'vitest';
import { BasemapError } from '../src/errors.js';
import {
  clearProviders,
  getProvider,
  listProviders,
  providerCount,
  registerProvider,
  registerProviders,
  unregisterProvider,
} from '../src/registry.js';

describe('registry', () => {
  it('регистрирует, читает и удаляет провайдера', () => {
    clearProviders();
    const provider = registerProvider({
      id: 'corp',
      name: 'Corporate',
      url: 'https://tiles.corp/{z}/{x}/{y}.png',
      attribution: '© Corp',
    });
    expect(provider.category).toBe('custom');
    expect(getProvider('corp')).toBe(provider);
    expect(providerCount()).toBe(1);
    expect(unregisterProvider('corp')).toBe(true);
    expect(getProvider('corp')).toBeUndefined();
  });

  it('переопределяет существующий id и умеет запретить override', () => {
    clearProviders();
    registerProvider({ id: 'x', name: 'First', url: 'https://a/{z}/{x}/{y}.png' });
    registerProvider({ id: 'x', name: 'Second', url: 'https://b/{z}/{x}/{y}.png' });
    expect(getProvider('x').name).toBe('Second');
    registerProvider(
      { id: 'x', name: 'Third', url: 'https://c/{z}/{x}/{y}.png' },
      { override: false },
    );
    expect(getProvider('x').name).toBe('Second');
  });

  it('валидирует обязательные поля', () => {
    clearProviders();
    expect(() => registerProvider({ id: 'x' })).toThrow(/name/);
    expect(() => registerProvider({ id: 'x', name: 'X' })).toThrow(/url/);
    expect(() => registerProvider({ name: 'X', url: 'https://x' })).toThrow(/id/);
  });

  it('фильтрует по категории, key и поиску', () => {
    clearProviders();
    registerProviders([
      {
        id: 'a',
        name: 'Alpha Streets',
        url: 'https://a/{z}/{x}/{y}.png',
        category: 'streets',
      },
      {
        id: 'b',
        name: 'Beta Satellite',
        url: 'https://b/{z}/{x}/{y}.png',
        category: 'satellite',
        requiresKey: true,
      },
    ]);
    expect(listProviders('streets')).toHaveLength(1);
    expect(listProviders({ requiresKey: true })[0].id).toBe('b');
    expect(listProviders({ search: 'alpha' })[0].id).toBe('a');
    expect(listProviders({ ids: ['b'] })).toHaveLength(1);
  });

  it('requireProvider даёт понятную ошибку', async () => {
    const { requireProvider } = await import('../src/registry.js');
    expect(() => requireProvider('missing')).toThrow(BasemapError);
    expect(() => requireProvider('missing')).toThrow(/Unknown basemap/);
  });
});
