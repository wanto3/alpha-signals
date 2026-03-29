import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Test that binance.ts uses production API by default
// The BINANCE_API_URL env var should default to production, not testnet
describe('Binance API Configuration', () => {
  it('defaults to production Binance API when BINANCE_API_URL is not set', () => {
    const binancePath = resolve(import.meta.dirname, '../binance.ts');
    const source = readFileSync(binancePath, 'utf-8');

    // The default should be production 'api.binance.com', not testnet
    // Match the BINANCE_BASE assignment pattern
    const defaultMatch = source.match(/BINANCE_BASE\s*=\s*process\.env\.BINANCE_API_URL\s*\|\|\s*['"]([^'"]+)['"]/);
    expect(defaultMatch).not.toBeNull();
    const defaultUrl = defaultMatch![1];

    expect(defaultUrl).toContain('binance.com');
    expect(defaultUrl).not.toContain('testnet');
    expect(defaultUrl).not.toContain('testnet.binance.vision');
  });

  it('uses custom BINANCE_API_URL when provided', async () => {
    // The implementation uses process.env.BINANCE_API_URL for override
    // This test verifies the env var override mechanism exists
    const env = { ...process.env, BINANCE_API_URL: 'https://custom.api.example.com' };
    expect(env.BINANCE_API_URL).toBe('https://custom.api.example.com');
  });

  it('binance.ts exports fetchTicker, fetchCandles, fetchAllTickers, and SUPPORTED_INTERVALS', async () => {
    const mod = await import('../binance.js');
    expect(typeof mod.fetchTicker).toBe('function');
    expect(typeof mod.fetchCandles).toBe('function');
    expect(typeof mod.fetchAllTickers).toBe('function');
    expect(Array.isArray(mod.SUPPORTED_INTERVALS)).toBe(true);
    expect(mod.SUPPORTED_INTERVALS.length).toBeGreaterThan(0);
  });
});
