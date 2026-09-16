import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDefaultLiveChatConfig,
  getSavedLiveChatConfig,
  saveLiveChatConfig,
  resolveLiveChatAutoReply,
} from '@/lib/liveChatConfig';
import { detectVerticalFromStoreName } from '@/lib/verticals';

// Mock localStorage and window for vitest node environment
const storageMock: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k in storageMock) delete storageMock[k];
  },
});

vi.stubGlobal('window', {
  localStorage: {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, val: string) => {
      storageMock[key] = String(val);
    },
    removeItem: (key: string) => {
      delete storageMock[key];
    },
    clear: () => {
      for (const k in storageMock) delete storageMock[k];
    },
  },
});

describe('Live Support Chat & Multi-Vertical Intelligence Engine', () => {
  beforeEach(() => {
    storageMock && Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  });

  describe('Multi-Vertical Presets & Default Configurations', () => {
    it('generates chicken & meat specific replies and avoids seafood text', () => {
      const config = getDefaultLiveChatConfig('chicken_meat', 'Farm Fresh Meat Hub', '+91 98430 11111');
      expect(config.botName).toContain('Meat Desk');
      expect(config.welcomeMessage).toContain('chicken & tender meat');
      expect(config.freshnessReply).toContain('poultry');
      expect(config.freshnessReply).not.toContain('Kasimedu');
      expect(config.freshnessReply).not.toContain('harbour');
      expect(config.cutsReply).toContain('Curry Cut');
      expect(config.cutsReply).toContain('Biryani Cuts');
      expect(config.cutsReply).toContain('Kheema');
      expect(config.trackingReply).toContain('PIN');
      expect(config.customFaqs.length).toBeGreaterThanOrEqual(4);
    });

    it('generates grocery & supermarket specific replies', () => {
      const config = getDefaultLiveChatConfig('grocery_supermarket', 'City Super Mart');
      expect(config.botName).toContain('Mart Desk');
      expect(config.freshnessReply).toContain('farmer mandis');
      expect(config.freshnessReply).not.toContain('Kasimedu');
    });

    it('generates electronics specific replies with warranty and seals', () => {
      const config = getDefaultLiveChatConfig('electronics_appliances', 'Gadget World');
      expect(config.botName).toContain('Tech Desk');
      expect(config.guaranteeReply).toContain('warranty');
      expect(config.freshnessReply).toContain('brand-authorized');
    });
  });

  describe('AI Intent Matching & Auto-Reply Resolution', () => {
    const chickenCfg = getDefaultLiveChatConfig('chicken_meat', 'Prime Meats');

    it('resolves freshness intent to chicken freshness reply', () => {
      const reply = resolveLiveChatAutoReply('is your chicken fresh today?', chickenCfg, 'chicken_meat', 'Prime Meats');
      expect(reply).toBe(chickenCfg.freshnessReply);
      expect(reply).not.toContain('Kasimedu');
    });

    it('resolves cutting style intent to meat cuts reply', () => {
      const reply = resolveLiveChatAutoReply('can you do curry cut or biryani cut?', chickenCfg, 'chicken_meat', 'Prime Meats');
      expect(reply).toBe(chickenCfg.cutsReply);
      expect(reply).toContain('Curry Cut');
    });

    it('resolves GPS tracking and PIN verification intent', () => {
      const reply = resolveLiveChatAutoReply('where is my rider delivery tracking pin?', chickenCfg, 'chicken_meat', 'Prime Meats');
      expect(reply).toBe(chickenCfg.trackingReply);
      expect(reply).toContain('PIN');
    });

    it('resolves 1-tap custom FAQ chip matching directly', () => {
      const customChip = chickenCfg.customFaqs[0];
      const reply = resolveLiveChatAutoReply(customChip.q, chickenCfg, 'chicken_meat', 'Prime Meats');
      expect(reply).toBe(customChip.a);
    });

    it('respects admin deep customizations over default presets', () => {
      const customCfg = {
        ...chickenCfg,
        cutsReply: 'Custom butcher cut: We offer marinated tandoori cuts and diced breast pieces!',
      };
      const reply = resolveLiveChatAutoReply('what cutting styles do you offer?', customCfg, 'chicken_meat', 'Prime Meats');
      expect(reply).toBe('Custom butcher cut: We offer marinated tandoori cuts and diced breast pieces!');
    });
  });

  describe('Tenant & Store Isolation in Persistence', () => {
    it('stores and retrieves independent configurations for different tenants', () => {
      const tenantAConfig = {
        ...getDefaultLiveChatConfig('chicken_meat', 'Store A'),
        botName: 'Custom Desk Alpha',
      };
      const tenantBConfig = {
        ...getDefaultLiveChatConfig('seafood', 'Store B'),
        botName: 'Custom Desk Beta',
      };

      saveLiveChatConfig(tenantAConfig, 'tenant-a');
      saveLiveChatConfig(tenantBConfig, 'tenant-b');

      const loadedA = getSavedLiveChatConfig('chicken_meat', 'Store A', '+91 99999 00001', 'tenant-a');
      const loadedB = getSavedLiveChatConfig('seafood', 'Store B', '+91 99999 00002', 'tenant-b');

      expect(loadedA.botName).toBe('Custom Desk Alpha');
      expect(loadedB.botName).toBe('Custom Desk Beta');
    });
  });

  describe('Store Name Inference', () => {
    it('accurately infers vertical from brand names', () => {
      expect(detectVerticalFromStoreName('Fresh Farm Chicken Hub')).toBe('chicken_meat');
      expect(detectVerticalFromStoreName('Fish N Fresh Harbour Catch')).toBe('seafood');
      expect(detectVerticalFromStoreName('Coimbatore Super Market')).toBe('grocery_supermarket');
      expect(detectVerticalFromStoreName('Electro World')).toBe('electronics_appliances');
    });
  });
});
