import { ChatOpenAI } from '@langchain/openai'
import { API_CONFIG, PROCESSING_CONFIG } from '../constants'

// Global LLM instance
let llm: ChatOpenAI | null = null

export class LLMService {
  private static readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY

  /**
   * Initialize the LLM instance
   */
  static async initializeLLM(): Promise<ChatOpenAI> {
    if (!llm) {
      llm = await this._createLLMInstance()
    }
    return llm
  }

  /**
   * Get current LLM instance
   */
  static getLLM(): ChatOpenAI | null {
    return llm
  }

  /**
   * Check if LLM is available
   */
  static isAvailable(): boolean {
    return llm !== null
  }

  /**
   * Generate response using LLM
   */
  static async generateResponse(question: string, searchResults: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!llm) {
      await this.initializeLLM()
    }

    const trimmedQuestion = question.trim().substring(0, API_CONFIG.MAX_QUESTION_LENGTH)
    const trimmedSearchResults = searchResults.substring(0, API_CONFIG.MAX_SEARCH_RESULTS_LENGTH)

    const prompt = this._createPrompt(trimmedQuestion, trimmedSearchResults)

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM response timeout')), PROCESSING_CONFIG.LLM_TIMEOUT)
      })

      const llmPromise = llm!.invoke(prompt)
      const llmResponse = await Promise.race([llmPromise, timeoutPromise])
      
      const response = llmResponse.content as string

      if (!response?.trim()) {
        return {
          success: false,
          error: 'Empty response from LLM'
        }
      }

      return {
        success: true,
        response: this._cleanResponse(response)
      }

    } catch (error) {
      console.error('LLM processing failed:', error)
      return {
        success: false,
        error: this._handleLLMError(error)
      }
    }
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const llm = await this.initializeLLM()
      // Simple test to see if LLM is available
      const testResult = await llm.invoke('Hello')
      return testResult?.content?.length > 0
    } catch (error) {
      console.error('LLM health check failed:', error)
      return false
    }
  }

  /**
   * Alias for initializeLLM for backwards compatibility
   */
  static async initialize() {
    return await this.initializeLLM()
  }

  /**
   * Create LLM instance with proper configuration
   */
  private static async _createLLMInstance(): Promise<ChatOpenAI> {
    try {
      if (!this.OPENAI_API_KEY) {
        throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.")
      }

      const instance = new ChatOpenAI({
        modelName: API_CONFIG.OPENAI_MODEL,
        maxTokens: API_CONFIG.MAX_TOKENS,
        openAIApiKey: this.OPENAI_API_KEY,
      })

      console.log(`Using ${API_CONFIG.OPENAI_MODEL} model`)
      return instance

    } catch (error) {
      console.error("Error initializing LLM:", error)
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error("OpenAI API configuration error: " + error.message)
        } else if (error.message.includes('quota')) {
          throw new Error("OpenAI API quota exceeded. Please check your billing and usage limits.")
        } else if (error.message.includes('authentication')) {
          throw new Error("OpenAI API authentication failed. Please check your API key.")
        }
      }
      throw error
    }
  }

  /**
   * Create prompt for LLM
   */
  private static _createPrompt(question: string, searchResults: string): string {
    return `
Bạn là một Chuyên gia Tuân thủ An toàn Phòng cháy chữa cháy, am hiểu Luật Phòng cháy chữa cháy Việt Nam, lịch trình kiểm tra và các tiêu chuẩn tuân thủ an toàn. Bạn có quyền truy cập vào tài liệu quy định an toàn PCCC.

Dựa trên các nội dung liên quan sau đây trích từ tài liệu PCCC, hãy trả lời câu hỏi của người dùng một cách chính xác và toàn diện:

Nội dung liên quan:
${searchResults}

Câu hỏi của người dùng:
${question}

Vui lòng cung cấp câu trả lời chi tiết và hữu ích dựa trên các quy định PCCC. Nếu thông tin hiện có không đủ để trả lời đầy đủ câu hỏi, hãy nêu rõ và cung cấp những gì bạn có thể dựa trên nội dung sẵn có.`
  }

  /**
   * Clean and validate LLM response
   */
  private static _cleanResponse(response: string): string {
    const cleanedResponse = response.trim()
    
    if (cleanedResponse.length > API_CONFIG.MAX_RESPONSE_LENGTH) {
      return cleanedResponse.substring(0, API_CONFIG.MAX_RESPONSE_LENGTH) + "...\n\n[Câu trả lời đã được rút gọn]"
    }

    return cleanedResponse
  }

  /**
   * Handle LLM errors with user-friendly messages
   */
  private static _handleLLMError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return "Xin lỗi, việc xử lý câu hỏi đang mất nhiều thời gian hơn dự kiến. Vui lòng thử lại với câu hỏi ngắn gọn hơn."
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        return "Tôi xin lỗi, hiện tại hệ thống đang quá tải. Vui lòng thử lại sau ít phút."
      } else if (error.message.includes('authentication') || error.message.includes('API key')) {
        return "Xin lỗi, có vấn đề với cấu hình hệ thống. Vui lòng liên hệ quản trị viên."
      }
    }
    
    return "Tôi xin lỗi, nhưng tôi đang gặp sự cố kỹ thuật khi xử lý câu hỏi của bạn. Vui lòng thử lại sau."
  }
}
