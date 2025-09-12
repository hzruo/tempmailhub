import type { IMailProvider, IProviderManager } from '../interfaces/mail-provider.js';
import type { ChannelConfiguration, ChannelHealth, ChannelStats, ChannelCapabilities } from '../types/channel.js';
import { configManager } from '../config/index.js';
import { MinMailProvider } from './minmail.js';
import { TempMailPlusProvider } from './tempmail-plus.js';
import { MailTmProvider } from './mail-tm.js';
import { EtempMailProvider } from './etempmail.js';
import { VanishPostProvider } from './vanishpost.js';
import { ChatTempMailProvider } from './chat-tempmail.js';

/**
 * 提供者管理器实现
 */
export class ProviderManager implements IProviderManager {
  private providers = new Map<string, IMailProvider>();

  registerProvider(provider: IMailProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): IMailProvider | undefined {
    return this.providers.get(name);
  }

  getEnabledProviders(): IMailProvider[] {
    const enabledChannels = configManager.getEnabledChannels();
    return enabledChannels
      .map(name => this.providers.get(name))
      .filter((provider): provider is IMailProvider => provider !== undefined);
  }

  getBestProvider(capabilities?: Partial<ChannelCapabilities>): IMailProvider | undefined {
    const enabledProviders = this.getEnabledProviders();
    
    // 根据能力筛选
    const compatibleProviders = capabilities ? 
      enabledProviders.filter(provider => {
        const providerCaps = provider.capabilities;
        return Object.entries(capabilities).every(([key, required]) => {
          if (!required) return true;
          return providerCaps[key as keyof ChannelCapabilities];
        });
      }) : enabledProviders;

    // 按性能优先级排序（优先选择快速的provider）
    const performanceOrder = ['chattempmail', 'tempmailplus', 'minmail', 'vanishpost', 'mailtm', 'etempmail'];
    
    const sortedProviders = compatibleProviders.sort((a, b) => {
      const aIndex = performanceOrder.indexOf(a.name);
      const bIndex = performanceOrder.indexOf(b.name);
      
      // 如果都在性能列表中，按顺序排序
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // 如果只有一个在列表中，优先选择在列表中的
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // 都不在列表中，保持原顺序
      return 0;
    });

    return sortedProviders[0];
  }

  async getAllHealth(): Promise<Record<string, ChannelHealth>> {
    const result: Record<string, ChannelHealth> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        result[name] = await provider.getHealth();
      } catch (error) {
        result[name] = {
          status: 'error' as any,
          lastChecked: new Date(),
          errorCount: 1,
          successRate: 0,
          lastError: error instanceof Error ? error.message : String(error),
          uptime: 0
        };
      }
    }

    return result;
  }

  getAllStats(): Record<string, ChannelStats> {
    const result: Record<string, ChannelStats> = {};
    
    for (const [name, provider] of this.providers) {
      result[name] = provider.getStats();
    }

    return result;
  }

  async reloadConfig(): Promise<void> {
    await configManager.reloadConfig();
    
    // 重新初始化所有提供者
    for (const [name, provider] of this.providers) {
      const config = configManager.getChannelConfig(name);
      if (config) {
        try {
          await provider.initialize({
            name,
            enabled: config.enabled,
            priority: config.priority,
            baseUrl: '',
            timeout: config.timeout || 10000,
            retries: config.retries || 2,
            rateLimit: config.rateLimit || { requests: 30, window: 60 },
            capabilities: provider.capabilities,
            domains: []
          });
        } catch (error) {
          console.warn(`Failed to reinitialize provider ${name}:`, error);
        }
      }
    }
  }
}

// 导出单例实例
export const providerManager = new ProviderManager();

// 初始化所有提供者
async function initializeProviders() {
  const channelConfigs = {
    minmail: configManager.getChannelConfig('minmail'),
    tempmailplus: configManager.getChannelConfig('tempmailplus'),
    mailtm: configManager.getChannelConfig('mailtm'),
    etempmail: configManager.getChannelConfig('etempmail'),
    vanishpost: configManager.getChannelConfig('vanishpost'),
    chattempmail: configManager.getChannelConfig('chattempmail')
  };

  // 注册所有提供者
  const providers = [
    { name: 'minmail', Provider: MinMailProvider },
    { name: 'tempmailplus', Provider: TempMailPlusProvider },
    { name: 'mailtm', Provider: MailTmProvider },
    { name: 'etempmail', Provider: EtempMailProvider },
    { name: 'vanishpost', Provider: VanishPostProvider },
    { name: 'chattempmail', Provider: ChatTempMailProvider }
  ];

  for (const { name, Provider } of providers) {
    const config = channelConfigs[name as keyof typeof channelConfigs];
    if (config) {
      const channelConfig: ChannelConfiguration = {
        name,
        enabled: config.enabled,
        priority: config.priority,
        baseUrl: '',
        timeout: config.timeout || 10000,
        retries: config.retries || 2,
        rateLimit: config.rateLimit || { requests: 30, window: 60 },
        capabilities: {} as ChannelCapabilities, // 会被provider自己的覆盖
        domains: []
      };

      try {
        const provider = new Provider(channelConfig);
        await provider.initialize(channelConfig);
        providerManager.registerProvider(provider);
        console.log(`Initialized provider: ${name}`);
      } catch (error) {
        console.warn(`Failed to initialize provider ${name}:`, error);
      }
    }
  }
}

// 导出初始化函数
export { initializeProviders }; 