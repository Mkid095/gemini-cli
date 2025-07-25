import { LocalLLMConfig } from '../types.js';
import { IntelligentAgent } from './IntelligentAgent.js';
import { AgentRequest, AgentResponse } from './agents/BaseAgent.js';

export { AgentRequest, AgentResponse };

export class AgentService {
  private intelligentAgent: IntelligentAgent;

  constructor(model: LocalLLMConfig) {
    this.intelligentAgent = new IntelligentAgent(model);
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    return await this.intelligentAgent.processRequest(request);
  }
} 