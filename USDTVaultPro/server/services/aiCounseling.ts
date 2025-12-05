import fetch from 'node-fetch';
import type { SavingsGoal } from '@shared/schema';
import { withdrawalGuidance } from '../data/withdrawalGuidance';

interface ConversationContext {
  userId: string;
  reason: string;
  goalDetails: {
    title: string;
    current: number;
    target: number;
    progress: number;
    deadline: Date | null;
    savingStreak: number;
  };
  withdrawalHistory?: Array<{
    date: Date;
    amount: number;
    reason: string;
  }>;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface CounselingResponse {
  message: string;
  suggestedActions?: string[];
  resources?: string[];
  sentiment?: 'supportive' | 'cautious' | 'celebratory' | 'concerned';
  shouldShowWarning?: boolean;
}

class AICounselingService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'anthropic/claude-3-haiku';
  private readonly maxResponseLength = 150; // Limit response length for cost optimization

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  async generateCounselingResponse(context: ConversationContext): Promise<CounselingResponse> {
    try {
      // If no API key, fall back to pre-written responses
      if (!this.apiKey) {
        return this.getFallbackResponse(context.reason, context.goalDetails.progress);
      }

      const prompt = this.buildPrompt(context);
      const response = await this.callOpenRouter(prompt, context.conversationHistory);
      
      if (!response) {
        return this.getFallbackResponse(context.reason, context.goalDetails.progress);
      }

      return this.parseAIResponse(response, context.reason);
    } catch (error) {
      console.error('AI counseling error:', error);
      // Fall back to pre-written responses on error
      return this.getFallbackResponse(context.reason, context.goalDetails.progress);
    }
  }

  private buildPrompt(context: ConversationContext): string {
    const { reason, goalDetails, withdrawalHistory } = context;
    
    // Build withdrawal pattern description
    let withdrawalPattern = '';
    if (withdrawalHistory && withdrawalHistory.length > 0) {
      const recentWithdrawals = withdrawalHistory.slice(0, 3);
      withdrawalPattern = `Recent withdrawals: ${recentWithdrawals.map(w => 
        `${w.reason} ($${w.amount.toFixed(2)})`
      ).join(', ')}.`;
    }

    // Create reason-specific prompts
    const prompts: Record<string, string> = {
      gambling: `The user wants to withdraw $${goalDetails.current.toFixed(2)} from their savings goal '${goalDetails.title}' for gambling. They've saved ${goalDetails.progress.toFixed(0)}% of their $${goalDetails.target.toFixed(2)} goal. ${withdrawalPattern} As a caring financial counselor, ask 2-3 empathetic but firm questions to help them reconsider. Focus on the progress they've made and alternatives to gambling. Keep response under ${this.maxResponseLength} words.`,
      
      emergency: `The user needs to withdraw $${goalDetails.current.toFixed(2)} from '${goalDetails.title}' savings for an emergency. They're ${goalDetails.progress.toFixed(0)}% toward their $${goalDetails.target.toFixed(2)} goal. ${withdrawalPattern} As a supportive financial advisor, acknowledge their situation while suggesting 2-3 alternatives they might consider before withdrawing. Keep response under ${this.maxResponseLength} words.`,
      
      'changed-mind': `The user wants to withdraw $${goalDetails.current.toFixed(2)} from '${goalDetails.title}' because they changed their mind about saving. Progress: ${goalDetails.progress.toFixed(0)}% of $${goalDetails.target.toFixed(2)}. ${withdrawalPattern} As an encouraging financial coach, remind them of their progress and why they started. Ask 1-2 reflective questions about their goals. Keep response under ${this.maxResponseLength} words.`,
      
      achieved: `The user has achieved their savings goal '${goalDetails.title}'! They saved $${goalDetails.current.toFixed(2)} (${goalDetails.progress.toFixed(0)}% of target). As a celebratory financial advisor, congratulate them warmly and suggest how they might use or reinvest their achievement wisely. Keep response under ${this.maxResponseLength} words.`,
      
      investment: `The user wants to withdraw $${goalDetails.current.toFixed(2)} from '${goalDetails.title}' for a different investment opportunity. Progress: ${goalDetails.progress.toFixed(0)}% of $${goalDetails.target.toFixed(2)}. ${withdrawalPattern} As a prudent financial advisor, ask about the new opportunity's risk/return profile and suggest keeping emergency funds. Keep response under ${this.maxResponseLength} words.`,
      
      other: `The user wants to withdraw $${goalDetails.current.toFixed(2)} from '${goalDetails.title}' savings. Progress: ${goalDetails.progress.toFixed(0)}% of $${goalDetails.target.toFixed(2)}. ${withdrawalPattern} As a balanced financial advisor, understand their needs while highlighting the value of their savings progress. Keep response under ${this.maxResponseLength} words.`
    };

    return prompts[reason] || prompts.other;
  }

  private async callOpenRouter(prompt: string, conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>): Promise<string | null> {
    try {
      const messages = [
        {
          role: 'system',
          content: 'You are a caring, empathetic financial counselor. Your responses should be supportive, non-judgmental, and focused on the user\'s long-term financial wellbeing. Keep responses concise (2-3 sentences) and conversational.'
        }
      ];

      // Add conversation history if exists
      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })));
      }

      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.repl.co` : 'http://localhost:5000',
          'X-Title': 'Financial Wellness App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 200,
          temperature: 0.7,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        console.error('OpenRouter API error:', response.statusText);
        return null;
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
      return null;
    }
  }

  private parseAIResponse(aiMessage: string, reason: string): CounselingResponse {
    // Determine sentiment based on reason
    const sentimentMap: Record<string, CounselingResponse['sentiment']> = {
      gambling: 'concerned',
      emergency: 'supportive',
      'changed-mind': 'supportive',
      achieved: 'celebratory',
      investment: 'cautious',
      other: 'supportive'
    };

    // Determine if warning should be shown
    const warningReasons = ['gambling', 'changed-mind'];
    
    return {
      message: aiMessage,
      sentiment: sentimentMap[reason] || 'supportive',
      shouldShowWarning: warningReasons.includes(reason),
      suggestedActions: this.getSuggestedActions(reason),
      resources: this.getResources(reason)
    };
  }

  private getFallbackResponse(reason: string, progress: number): CounselingResponse {
    const fallback = withdrawalGuidance.getFallbackResponse(reason, progress);
    
    return {
      message: fallback.message,
      suggestedActions: fallback.suggestions,
      resources: fallback.resources,
      sentiment: fallback.sentiment as CounselingResponse['sentiment'],
      shouldShowWarning: fallback.showWarning
    };
  }

  private getSuggestedActions(reason: string): string[] {
    const actions: Record<string, string[]> = {
      gambling: [
        'Set a strict entertainment budget',
        'Talk to a trusted friend or counselor',
        'Try a free hobby instead'
      ],
      emergency: [
        'Check if payment plans are available',
        'Consider a temporary side gig',
        'Review your monthly budget for cuts'
      ],
      'changed-mind': [
        'Sleep on it for 24 hours',
        'Review your original goal motivation',
        'Adjust your goal if needed'
      ],
      achieved: [
        'Set a new savings goal',
        'Consider investing a portion',
        'Celebrate responsibly!'
      ],
      investment: [
        'Research thoroughly first',
        'Keep 3-6 months emergency fund',
        'Consider diversification'
      ]
    };

    return actions[reason] || [
      'Take time to consider',
      'Review your budget',
      'Think long-term'
    ];
  }

  private getResources(reason: string): string[] {
    const resources: Record<string, string[]> = {
      gambling: [
        'National Problem Gambling Helpline: 1-800-522-4700',
        'www.ncpgambling.org',
        'Gamblers Anonymous: www.gamblersanonymous.org'
      ],
      emergency: [
        '211.org - Community resources',
        'www.usa.gov/benefits',
        'Local food banks and assistance programs'
      ],
      'changed-mind': [
        'www.mint.com - Budget tracking',
        'r/personalfinance community',
        'Financial Peace University'
      ],
      investment: [
        'www.investor.gov - SEC resources',
        'Bogleheads investment philosophy',
        'www.morningstar.com - Investment research'
      ]
    };

    return resources[reason] || [];
  }

  // Track API usage for analytics
  async trackUsage(userId: string, reason: string, tokensUsed?: number): Promise<void> {
    try {
      // This could be stored in a database for analytics
      console.log(`AI Counseling usage - User: ${userId}, Reason: ${reason}, Tokens: ${tokensUsed || 0}`);
    } catch (error) {
      console.error('Failed to track AI usage:', error);
    }
  }
}

export const aiCounselingService = new AICounselingService();