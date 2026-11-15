/**
 * Ошибки модуля подложек. Все ошибки содержат машиночитаемый `code`, чтобы UI
 * и приложение могли отреагировать без разбора текста.
 */
export class BasemapError extends Error {
  /**
   * @param {string} message
   * @param {{code?: string, providerId?: string, cause?: Error, details?: object}} [options]
   */
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'BasemapError';
    this.code = options.code || 'basemap-error';
    this.providerId = options.providerId || null;
    this.details = options.details || null;
  }
}

/** Провайдер требует ключ, но он не передан. */
export class BasemapKeyError extends BasemapError {
  /**
   * @param {string} providerId
   * @param {{termsUrl?: string, keyParam?: string}} [options]
   */
  constructor(providerId, options = {}) {
    const terms = options.termsUrl ? ` Terms: ${options.termsUrl}` : '';
    super(
      `Basemap provider "${providerId}" requires an API key. ` +
        `Pass { key: '...' }, set options.keys.${providerId}, options.keys.global, ` +
        `or the matching environment variable.${terms}`,
      {
        code: 'missing-key',
        providerId,
        details: { termsUrl: options.termsUrl || null, keyParam: options.keyParam || null },
      },
    );
    this.name = 'BasemapKeyError';
  }
}

/**
 * Маскирует ключ для логов и событий. Короткие ключи скрываются целиком.
 * @param {string|null|undefined} key
 * @returns {string}
 */
export function maskKey(key) {
  if (!key) return '';
  const value = String(key);
  if (value.length <= 8) return '***';
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

/**
 * Убирает ключ из URL, чтобы он не попадал в журналы и `basemaperror`.
 * @param {string} url
 * @param {string|null} [key]
 * @returns {string}
 */
export function maskUrl(url, key) {
  if (!url) return url;
  let result = String(url);
  if (key) result = result.split(encodeURIComponent(key)).join(maskKey(key));
  result = result.replace(
    /([?&](?:key|api_key|apikey|apiKey|access_token|access-token|token)=)[^&]+/g,
    '$1***',
  );
  return result;
}
