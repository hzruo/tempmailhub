import type { Config, ChannelConfig } from '../types/index.js';

/**
 * 默认配置
 */
export const defaultConfig: Config = {
  channels: {
    minmail: {
      enabled: true,
      priority: 1,
      timeout: 10000,
      retries: 2,
      rateLimit: {
        requests: 30,
        window: 60
      }
    },
    tempmailplus: {
      enabled: true,
      priority: 2,
      timeout: 8000,
      retries: 3,
      rateLimit: {
        requests: 50,
        window: 60
      }
    },
    mailtm: {
      enabled: true,
      priority: 3,
      timeout: 12000,
      retries: 2,
      rateLimit: {
        requests: 20,
        window: 60
      }
    },
    etempmail: {
      enabled: true,
      priority: 4,
      timeout: 15000,
      retries: 2,
      rateLimit: {
        requests: 25,
        window: 60
      }
    },
    vanishpost: {
      enabled: true,
      priority: 5,
      timeout: 10000,
      retries: 1,
      rateLimit: {
        requests: 4, // 15分钟只能创建一个
        window: 900
      }
    },
    chattempmail: {
      enabled: true,
      priority: 6, 
      timeout: 10000,
      retries: 2,
      rateLimit: {
        requests: 30,
        window: 60
      }
    }
  },
  server: {
    port: 8080,
    host: '0.0.0.0',
    cors: {
      origin: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
  },
  security: {
    rateLimit: {
      enabled: true,
      requests: 100,
      window: 60
    }
  }
};

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: Config;
  private readonly configSources: Map<string, () => Partial<Config>> = new Map();

  constructor(initialConfig: Config = defaultConfig) {
    this.config = { ...initialConfig };
  }

  /**
   * 获取配置
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * 获取渠道配置
   */
  getChannelConfig(channelName: string) {
    return this.config.channels[channelName];
  }

  /**
   * 获取所有启用的渠道
   */
  getEnabledChannels(): string[] {
    return Object.entries(this.config.channels)
      .filter(([_, config]) => config.enabled)
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([name]) => name);
  }

  /**
   * 更新渠道配置
   */
  updateChannelConfig(channelName: string, config: Partial<ChannelConfig[string]>) {
    if (this.config.channels[channelName]) {
      this.config.channels[channelName] = {
        ...this.config.channels[channelName],
        ...config
      };
    }
  }

  /**
   * 启用渠道
   */
  enableChannel(channelName: string) {
    this.updateChannelConfig(channelName, { enabled: true });
  }

  /**
   * 禁用渠道
   */
  disableChannel(channelName: string) {
    this.updateChannelConfig(channelName, { enabled: false });
  }

  /**
   * 设置渠道优先级
   */
  setChannelPriority(channelName: string, priority: number) {
    this.updateChannelConfig(channelName, { priority });
  }

  /**
   * 添加配置源
   */
  addConfigSource(name: string, source: () => Partial<Config>) {
    this.configSources.set(name, source);
  }

  /**
   * 重新加载配置
   */
  async reloadConfig() {
    let newConfig = { ...defaultConfig };

    // 合并所有配置源
    for (const [name, source] of this.configSources) {
      try {
        const sourceConfig = source();
        newConfig = this.mergeConfig(newConfig, sourceConfig);
      } catch (error) {
        console.warn(`Failed to load config from source ${name}:`, error);
      }
    }

    this.config = newConfig;
  }

  /**
   * 从环境变量加载配置
   */
  loadFromEnv() {
    // 检查是否存在 process 对象（Node.js 环境）
    const env = typeof globalThis !== 'undefined' && 
                (globalThis as any).process?.env || 
                (typeof globalThis !== 'undefined' && (globalThis as any).process ? (globalThis as any).process.env : {});
    
    const envConfig: Partial<Config> = {};

    // 加载服务器配置
    if (env.PORT) {
      envConfig.server = {
        ...envConfig.server,
        port: parseInt(env.PORT, 10)
      };
    }

    if (env.HOST) {
      envConfig.server = {
        ...envConfig.server,
        host: env.HOST
      };
    }

    // 加载安全配置
    if (env.API_KEY) {
      envConfig.security = {
        ...envConfig.security,
        apiKey: env.API_KEY
      };
    }

    // 加载渠道启用状态
    const channels: ChannelConfig = {};
    for (const channelName of Object.keys(defaultConfig.channels)) {
      const envKey = `CHANNEL_${channelName.toUpperCase()}_ENABLED`;
      if (env[envKey] !== undefined) {
        channels[channelName] = {
          ...defaultConfig.channels[channelName],
          enabled: env[envKey]?.toLowerCase() === 'true'
        };
      }
    }

    if (Object.keys(channels).length > 0) {
      envConfig.channels = channels;
    }

    this.config = this.mergeConfig(this.config, envConfig);
  }

  /**
   * 深度合并配置
   */
  private mergeConfig(target: Config, source: Partial<Config>): Config {
    const result = { ...target };

    if (source.channels) {
      result.channels = { ...result.channels };
      for (const [name, config] of Object.entries(source.channels)) {
        result.channels[name] = {
          ...result.channels[name],
          ...config
        };
      }
    }

    if (source.server) {
      result.server = { ...result.server, ...source.server };
    }

    if (source.security) {
      result.security = { ...result.security, ...source.security };
    }

    return result;
  }

  /**
   * 验证配置
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证渠道配置
    for (const [name, config] of Object.entries(this.config.channels)) {
      if (config.priority < 1) {
        errors.push(`Channel ${name} priority must be >= 1`);
      }
      if (config.timeout !== undefined && config.timeout < 1000) {
        errors.push(`Channel ${name} timeout must be >= 1000ms`);
      }
      if (config.retries !== undefined && config.retries < 0) {
        errors.push(`Channel ${name} retries must be >= 0`);
      }
    }

    // 验证服务器配置
    if (this.config.server.port && (this.config.server.port < 1 || this.config.server.port > 65535)) {
      errors.push('Server port must be between 1 and 65535');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出单例实例
export const configManager = new ConfigManager();

// 加载环境变量配置
configManager.loadFromEnv(); 