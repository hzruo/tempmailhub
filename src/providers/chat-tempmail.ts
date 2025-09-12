import type { IMailProvider } from '../interfaces/mail-provider.js';
import type {
  EmailAddress,
  EmailMessage,
  CreateEmailRequest,
  CreateEmailResponse,
  EmailListQuery,
  EmailContact
} from '../types/email.js';
import type {
  ChannelConfiguration,
  ChannelHealth,
  ChannelStats,
  ChannelResponse,
  ChannelCapabilities,
  ChannelError
} from '../types/channel.js';
import { ChannelStatus, ChannelErrorType } from '../types/channel.js';
import { httpClient } from '../utils/http-client.js';
import { generateId, generateEmailPrefix, parseDate } from '../utils/helpers.js';

/**
 * ChatTempMail API 响应类型
 */
interface ChatTempMailDomain {
  domains: string[];
}

interface ChatTempMailCreateResponse {
  id: string;
  email: string;
}

interface ChatTempMailEmail {
  id: string;
  address: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface ChatTempMailEmailListResponse {
  emails: ChatTempMailEmail[];
  nextCursor?: string;
  total: number;
}

interface ChatTempMailMessage {
  id: string;
  from_address: string;
  subject: string;
  received_at: number;
}

interface ChatTempMailMessageListResponse {
  messages: ChatTempMailMessage[];
  nextCursor?: string;
  total: number;
}

interface ChatTempMailMessageDetail {
  id: string;
  from_address: string;
  subject: string;
  content: string;
  html: string;
  received_at: number;
}

interface ChatTempMailMessageDetailResponse {
  message: ChatTempMailMessageDetail;
}

/**
 * ChatTempMail 提供者实现
 */
export class ChatTempMailProvider implements IMailProvider {
  readonly name = 'chattempmail';
  
  readonly capabilities: ChannelCapabilities = {
    createEmail: true,
    listEmails: true,
    getEmailContent: true,
    customDomains: true,
    customPrefix: true,
    emailExpiration: true,
    realTimeUpdates: true, // 支持webhook
    attachmentSupport: false
  };

  private stats: ChannelStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errorsToday: 0,
    requestsToday: 0
  };

  private baseUrl = 'https://chat-tempmail.com/api';
  private availableDomains: string[] = [];
  private emailIds = new Map<string, string>(); // email -> emailId
  private connectionTested = false;
  private connectionTestResult: { success: boolean; error?: string; testedAt: Date } | null = null;

  constructor(public readonly config: ChannelConfiguration) {}

  async initialize(config: ChannelConfiguration): Promise<void> {
    console.log('ChatTempMail provider initialized (domains and connection will be loaded on first use)');
  }

  /**
   * 懒加载连接测试和域名获取 - 只在第一次使用时执行，结果会被缓存
   */
  private async ensureConnectionTested(): Promise<void> {
    if (this.connectionTested) {
      return;
    }

    try {
      console.log('Testing ChatTempMail connection and loading domains...');
      
      // 获取可用域名
      await this.fetchAvailableDomains();
      
      // 测试连接
      const healthCheck = await this.testConnection();
      this.connectionTestResult = {
        success: healthCheck.success,
        error: healthCheck.error?.message,
        testedAt: new Date()
      };
      
      if (!healthCheck.success) {
        console.warn(`ChatTempMail connection test failed: ${healthCheck.error?.message}`);
      } else {
        console.log(`ChatTempMail connection test passed, loaded ${this.availableDomains.length} domains`);
      }
    } catch (error) {
      this.connectionTestResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        testedAt: new Date()
      };
      console.warn(`ChatTempMail connection test error: ${this.connectionTestResult.error}`);
    } finally {
      this.connectionTested = true;
    }
  }

  async createEmail(request: CreateEmailRequest): Promise<ChannelResponse<CreateEmailResponse>> {
    const startTime = Date.now();
    
    try {
      this.updateStats('request');

      // 确保连接已测试
      await this.ensureConnectionTested();

      const prefix = request.prefix || generateEmailPrefix(10);
      const domain = request.domain || this.getRandomDomain();
      
      if (!domain) {
        throw this.createError(
          ChannelErrorType.API_ERROR,
          'No available domains found'
        );
      }

      // 设置过期时间（毫秒）
      const expiryTime = request.expirationMinutes 
        ? request.expirationMinutes * 60 * 1000 
        : 3600000; // 默认1小时

      const createResponse = await httpClient.post<ChatTempMailCreateResponse>(
        `${this.baseUrl}/emails/generate`,
        {
          name: prefix,
          expiryTime,
          domain
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey || ''
          },
          timeout: this.config.timeout,
          retries: this.config.retries
        }
      );

      if (!createResponse.ok) {
        throw this.createError(
          ChannelErrorType.API_ERROR,
          `Failed to create email: ${createResponse.status}`,
          createResponse.status
        );
      }

      // 保存emailId映射
      this.emailIds.set(createResponse.data.email, createResponse.data.id);

      const result: CreateEmailResponse = {
        address: createResponse.data.email,
        domain,
        username: prefix,
        provider: this.name,
        expiresAt: new Date(Date.now() + expiryTime)
      };

      this.updateStats('success', Date.now() - startTime);

      return {
        success: true,
        data: result,
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };

    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      
      return {
        success: false,
        error: error instanceof Error ? error as ChannelError : this.createError(
          ChannelErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        ),
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };
    }
  }

  async getEmails(query: EmailListQuery): Promise<ChannelResponse<EmailMessage[]>> {
    const startTime = Date.now();
    
    try {
      this.updateStats('request');

      // 确保连接已测试
      await this.ensureConnectionTested();

      // 获取emailId
      const emailId = this.emailIds.get(query.address);
      if (!emailId) {
        throw this.createError(
          ChannelErrorType.AUTHENTICATION_ERROR,
          'Email address not found. Please ensure email was created through this service.'
        );
      }

      const response = await httpClient.get<ChatTempMailMessageListResponse>(
        `${this.baseUrl}/emails/${emailId}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey || ''
          },
          timeout: this.config.timeout,
          retries: this.config.retries
        }
      );

      if (!response.ok) {
        throw this.createError(
          ChannelErrorType.API_ERROR,
          `ChatTempMail API returned ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const messages = response.data.messages || [];
      const emails: EmailMessage[] = messages.map(msg => this.mapToEmailMessage(msg, query.address));

      // 应用过滤器
      let filteredEmails = emails;
      if (query.unreadOnly) {
        filteredEmails = filteredEmails.filter(email => !email.isRead);
      }
      if (query.since) {
        filteredEmails = filteredEmails.filter(email => email.receivedAt >= query.since!);
      }

      // 应用分页
      const limit = query.limit || 20;
      const offset = query.offset || 0;
      const paginatedEmails = filteredEmails.slice(offset, offset + limit);

      this.updateStats('success', Date.now() - startTime);

      return {
        success: true,
        data: paginatedEmails,
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };

    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      
      return {
        success: false,
        error: error instanceof Error ? error as ChannelError : this.createError(
          ChannelErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        ),
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };
    }
  }

  async getEmailContent(emailAddress: string, emailId: string, accessToken?: string): Promise<ChannelResponse<EmailMessage>> {
    const startTime = Date.now();
    
    try {
      this.updateStats('request');

      // 确保连接已测试
      await this.ensureConnectionTested();

      // 获取emailId
      const chatEmailId = this.emailIds.get(emailAddress);
      if (!chatEmailId) {
        throw this.createError(
          ChannelErrorType.AUTHENTICATION_ERROR,
          'Email address not found. Please ensure email was created through this service.'
        );
      }

      const response = await httpClient.get<ChatTempMailMessageDetailResponse>(
        `${this.baseUrl}/emails/${chatEmailId}/${emailId}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey || ''
          },
          timeout: this.config.timeout,
          retries: this.config.retries
        }
      );

      if (!response.ok) {
        throw this.createError(
          ChannelErrorType.API_ERROR,
          `ChatTempMail API returned ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const email = this.mapDetailToEmailMessage(response.data.message, emailAddress);

      this.updateStats('success', Date.now() - startTime);

      return {
        success: true,
        data: email,
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };

    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      
      return {
        success: false,
        error: error instanceof Error ? error as ChannelError : this.createError(
          ChannelErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        ),
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };
    }
  }

  async deleteEmail(emailAddress: string): Promise<ChannelResponse<boolean>> {
    const emailId = this.emailIds.get(emailAddress);
    
    if (!emailId) {
      return {
        success: false,
        error: this.createError(
          ChannelErrorType.AUTHENTICATION_ERROR,
          'Email address not found'
        ),
        metadata: {
          provider: this.name,
          responseTime: 0,
          requestId: generateId()
        }
      };
    }

    try {
      const response = await httpClient.delete(
        `${this.baseUrl}/emails/${emailId}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey || ''
          },
          timeout: this.config.timeout,
          retries: this.config.retries
        }
      );

      if (response.ok) {
        this.emailIds.delete(emailAddress);
      }

      return {
        success: response.ok,
        data: response.ok,
        metadata: {
          provider: this.name,
          responseTime: 0,
          requestId: generateId()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.createError(
          ChannelErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error.message : String(error)
        ),
        metadata: {
          provider: this.name,
          responseTime: 0,
          requestId: generateId()
        }
      };
    }
  }

  async getHealth(): Promise<ChannelHealth> {
    // 如果还没有测试过连接，现在测试一次
    if (!this.connectionTested) {
      await this.ensureConnectionTested();
    }
    
    const testResult = this.connectionTestResult || { success: false, error: 'Not tested yet', testedAt: new Date() };
    
    return {
      status: testResult.success ? ChannelStatus.ACTIVE : ChannelStatus.ERROR,
      lastChecked: testResult.testedAt,
      responseTime: 0, // 使用缓存结果，没有实时响应时间
      errorCount: this.stats.failedRequests,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 0,
      lastError: testResult.error,
      uptime: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100
    };
  }

  getStats(): ChannelStats {
    return { ...this.stats };
  }

  async testConnection(): Promise<ChannelResponse<boolean>> {
    const startTime = Date.now();
    
    try {
      const response = await httpClient.get(`${this.baseUrl}/email/domains`, {
        headers: {
          'X-API-Key': this.config.apiKey || ''
        },
        timeout: this.config.timeout
      });

      return {
        success: response.ok,
        data: response.ok,
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.createError(
          ChannelErrorType.NETWORK_ERROR,
          error instanceof Error ? error.message : String(error)
        ),
        metadata: {
          provider: this.name,
          responseTime: Date.now() - startTime,
          requestId: generateId()
        }
      };
    }
  }

  private async fetchAvailableDomains(): Promise<void> {
    try {
      const response = await httpClient.get<ChatTempMailDomain>(`${this.baseUrl}/email/domains`, {
        headers: {
          'X-API-Key': this.config.apiKey || ''
        }
      });
      
      if (response.ok) {
        this.availableDomains = response.data.domains || [];
      }
    } catch (error) {
      // 使用默认域名
      this.availableDomains = ['chat-tempmail.com'];
    }
  }

  private getRandomDomain(): string {
    if (this.availableDomains.length === 0) {
      return 'chat-tempmail.com';
    }
    return this.availableDomains[Math.floor(Math.random() * this.availableDomains.length)];
  }

  private mapToEmailMessage(msg: ChatTempMailMessage, emailAddress: string): EmailMessage {
    return {
      id: msg.id,
      from: {
        email: msg.from_address,
        name: undefined
      },
      to: [{
        email: emailAddress,
        name: undefined
      }],
      subject: msg.subject,
      textContent: undefined, // 需要调用详情接口获取完整内容
      receivedAt: new Date(msg.received_at),
      isRead: false, // ChatTempMail API没有提供已读状态
      provider: this.name,
      // 添加元数据标识
      headers: {
        'X-Content-Type': 'preview', // 标识这是预览内容
        'X-Has-Full-Content': 'true' // 标识可以获取完整内容
      }
    };
  }

  private mapDetailToEmailMessage(detail: ChatTempMailMessageDetail, emailAddress: string): EmailMessage {
    return {
      id: detail.id,
      from: {
        email: detail.from_address,
        name: undefined
      },
      to: [{
        email: emailAddress,
        name: undefined
      }],
      subject: detail.subject,
      textContent: detail.content,
      htmlContent: detail.html || undefined,
      receivedAt: new Date(detail.received_at),
      isRead: false, // ChatTempMail API没有提供已读状态
      provider: this.name,
      // 添加元数据标识
      headers: {
        'X-Content-Type': 'full', // 标识这是完整内容
        'X-Has-Full-Content': 'true'
      }
    };
  }

  private createError(type: ChannelErrorType, message: string, statusCode?: number): ChannelError {
    const error = new Error(message) as ChannelError;
    error.type = type;
    error.channelName = this.name;
    error.statusCode = statusCode;
    error.retryable = type !== ChannelErrorType.AUTHENTICATION_ERROR && type !== ChannelErrorType.CONFIGURATION_ERROR;
    error.timestamp = new Date();
    return error;
  }

  private updateStats(type: 'request' | 'success' | 'error', responseTime?: number): void {
    this.stats.totalRequests++;
    this.stats.requestsToday++;
    this.stats.lastRequestTime = new Date();

    if (type === 'success') {
      this.stats.successfulRequests++;
      if (responseTime) {
        this.stats.averageResponseTime = 
          (this.stats.averageResponseTime + responseTime) / 2;
      }
    } else if (type === 'error') {
      this.stats.failedRequests++;
      this.stats.errorsToday++;
    }
  }
}
