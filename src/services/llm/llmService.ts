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
   * Generate response using LLM with RAG context
   */
  static async generateResponse(question: string, searchResults: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!llm) {
      await this.initializeLLM()
    }

    const trimmedQuestion = question.trim().substring(0, API_CONFIG.MAX_QUESTION_LENGTH)
    const trimmedSearchResults = searchResults.substring(0, API_CONFIG.MAX_SEARCH_RESULTS_LENGTH)

    // Validate that we have context from search results
    if (!trimmedSearchResults || trimmedSearchResults.trim() === 'No relevant information found in the uploaded document.') {
      return {
        success: true,
        response: "Tôi không tìm thấy thông tin liên quan trong tài liệu PDF đã tải lên để trả lời câu hỏi của bạn. Vui lòng thử diễn đạt lại câu hỏi hoặc tải lên tài liệu khác có chứa thông tin liên quan."
      }
    }

    const prompt = this._createRAGPrompt(trimmedQuestion, trimmedSearchResults)

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

      const cleanedResponse = this._cleanResponse(response)
      
      // Add context validation
      if (this._isGenericResponse(cleanedResponse)) {
        return {
          success: true,
          response: cleanedResponse + "\n\n*Lưu ý: Câu trả lời này dựa trên thông tin có trong tài liệu đã tải lên. Nếu bạn cần thông tin chi tiết hơn, vui lòng tham khảo trực tiếp tài liệu gốc.*"
        }
      }

      return {
        success: true,
        response: cleanedResponse
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
   * Create enhanced RAG prompt for LLM with better context structure
   */
  private static _createRAGPrompt(question: string, searchResults: string): string {
    return `
Bạn là một Chuyên gia Tuân thủ An toàn Phòng cháy chữa cháy (PCCC), am hiểu sâu sắc về Luật Phòng cháy chữa cháy Việt Nam, các quy định, tiêu chuẩn an toàn và lịch trình kiểm tra PCCC.

NHIỆM VỤ: Trả lời câu hỏi của người dùng dựa chính xác và CHỈ dựa vào thông tin được cung cấp từ tài liệu PCCC đã tải lên.

THÔNG TIN TỪ TÀI LIỆU PCCC:
${searchResults}

CÂU HỎI CỦA NGƯỜI DÙNG:
${question}

HƯỚNG DẪN TRẢ LỜI:
1. Chỉ sử dụng thông tin có trong phần "THÔNG TIN TỪ TÀI LIỆU PCCC" ở trên
2. Trả lời bằng tiếng Việt, rõ ràng và chi tiết
3. Nếu tài liệu không có đủ thông tin để trả lời đầy đủ, hãy nêu rõ điều này
4. Trích dẫn trực tiếp từ tài liệu khi cần thiết
5. Không bịa đặt thông tin không có trong tài liệu
6. Nếu không tìm thấy thông tin liên quan, thành thật nói rằng không có thông tin trong tài liệu

CÂU TRẢ LỜI:`
  }

  /**
   * Create prompt for LLM (legacy method for backward compatibility)
   */
  private static _createPrompt(question: string, searchResults: string): string {
    return this._createRAGPrompt(question, searchResults)
  }

  /**
   * Check if response is too generic and might not be based on document content
   */
  private static _isGenericResponse(response: string): boolean {
    const genericPhrases = [
      'tôi không thể',
      'xin lỗi',
      'không có thông tin',
      'tôi cần thêm thông tin',
      'không thể trả lời'
    ]
    
    const lowerResponse = response.toLowerCase()
    return genericPhrases.some(phrase => lowerResponse.includes(phrase))
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
