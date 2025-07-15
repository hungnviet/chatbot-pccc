/**
 * Centralized error handling utilities for the PCCC Chatbot
 */

export enum ErrorTypes {
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  API_AUTH_FAILED = 'API_AUTH_FAILED', 
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_KEY_ERROR = 'API_KEY_ERROR',
  VECTOR_DB_ERROR = 'VECTOR_DB_ERROR',
  PDF_PROCESSING_ERROR = 'PDF_PROCESSING_ERROR',
  SESSION_ERROR = 'SESSION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface ProcessingError {
  type: ErrorTypes
  message: string
  details?: string
  timestamp: Date
  sessionId?: string
}

export class ErrorHandler {
  /**
   * Categorize and format errors for better user experience
   */
  static categorizeError(error: unknown): ProcessingError {
    const timestamp = new Date()
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      // API Quota/Rate Limit Errors
      if (message.includes('quota') || 
          message.includes('rate limit') || 
          message.includes('too many requests') ||
          message.includes('429')) {
        return {
          type: ErrorTypes.API_QUOTA_EXCEEDED,
          message: 'OpenAI API quota exceeded or rate limit reached',
          details: error.message,
          timestamp
        }
      }
      
      // Authentication Errors
      if (message.includes('authentication') || 
          message.includes('unauthorized') || 
          message.includes('401') ||
          message.includes('invalid api key')) {
        return {
          type: ErrorTypes.API_AUTH_FAILED,
          message: 'OpenAI API authentication failed',
          details: error.message,
          timestamp
        }
      }
      
      // Network Errors
      if (message.includes('network') || 
          message.includes('timeout') || 
          message.includes('connection') ||
          message.includes('enotfound') ||
          message.includes('econnreset')) {
        return {
          type: ErrorTypes.NETWORK_ERROR,
          message: 'Network error occurred',
          details: error.message,
          timestamp
        }
      }
      
      // API Key Configuration
      if (message.includes('api key') && message.includes('not configured')) {
        return {
          type: ErrorTypes.API_KEY_ERROR,
          message: 'OpenAI API key not configured',
          details: error.message,
          timestamp
        }
      }
      
      // PDF Processing Errors
      if (message.includes('pdf') || 
          message.includes('extract') || 
          message.includes('document')) {
        return {
          type: ErrorTypes.PDF_PROCESSING_ERROR,
          message: 'PDF processing failed',
          details: error.message,
          timestamp
        }
      }
      
      // Session Errors
      if (message.includes('session') || 
          message.includes('invalid session')) {
        return {
          type: ErrorTypes.SESSION_ERROR,
          message: 'Session management error',
          details: error.message,
          timestamp
        }
      }
    }
    
    // Default error type
    return {
      type: ErrorTypes.VECTOR_DB_ERROR,
      message: 'Vector database error',
      details: error instanceof Error ? error.message : String(error),
      timestamp
    }
  }
  
  /**
   * Get user-friendly error message based on error type
   */
  static getUserMessage(errorType: ErrorTypes, isVietnamese: boolean = true): string {
    if (isVietnamese) {
      switch (errorType) {
        case ErrorTypes.API_QUOTA_EXCEEDED:
          return 'Hệ thống hiện đang quá tải. Vui lòng thử lại sau ít phút.'
        case ErrorTypes.API_AUTH_FAILED:
          return 'Lỗi cấu hình hệ thống. Vui lòng liên hệ quản trị viên.'
        case ErrorTypes.NETWORK_ERROR:
          return 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.'
        case ErrorTypes.API_KEY_ERROR:
          return 'Lỗi cấu hình API. Vui lòng liên hệ quản trị viên.'
        case ErrorTypes.PDF_PROCESSING_ERROR:
          return 'Không thể xử lý tệp PDF. Vui lòng kiểm tra tệp và thử lại.'
        case ErrorTypes.SESSION_ERROR:
          return 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang và thử lại.'
        case ErrorTypes.VALIDATION_ERROR:
          return 'Dữ liệu đầu vào không hợp lệ. Vui lòng kiểm tra và thử lại.'
        default:
          return 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc liên hệ hỗ trợ.'
      }
    } else {
      switch (errorType) {
        case ErrorTypes.API_QUOTA_EXCEEDED:
          return 'Service temporarily unavailable due to high demand. Please try again in a few minutes.'
        case ErrorTypes.API_AUTH_FAILED:
          return 'Service configuration error. Please contact administrator.'
        case ErrorTypes.NETWORK_ERROR:
          return 'Network connection error. Please check your internet connection and try again.'
        case ErrorTypes.API_KEY_ERROR:
          return 'API configuration error. Please contact administrator.'
        case ErrorTypes.PDF_PROCESSING_ERROR:
          return 'Unable to process PDF file. Please check the file and try again.'
        case ErrorTypes.SESSION_ERROR:
          return 'Invalid session. Please refresh the page and try again.'
        case ErrorTypes.VALIDATION_ERROR:
          return 'Invalid input data. Please check and try again.'
        default:
          return 'An unexpected error occurred. Please try again or contact support.'
      }
    }
  }
  
  /**
   * Log error with proper formatting and context
   */
  static logError(error: ProcessingError, context?: string): void {
    const logMessage = [
      `[${error.type}]`,
      error.message,
      context ? `Context: ${context}` : '',
      error.sessionId ? `Session: ${error.sessionId}` : '',
      error.details ? `Details: ${error.details}` : ''
    ].filter(Boolean).join(' | ')
    
    console.error(`${error.timestamp.toISOString()} - ${logMessage}`)
  }
  
  /**
   * Create a standardized error response for API endpoints
   */
  static createErrorResponse(error: unknown, sessionId?: string) {
    const processedError = this.categorizeError(error)
    processedError.sessionId = sessionId
    
    this.logError(processedError)
    
    return {
      success: false,
      error: processedError.message,
      errorType: processedError.type,
      userMessage: this.getUserMessage(processedError.type, true),
      timestamp: processedError.timestamp.toISOString(),
      sessionId: sessionId || ''
    }
  }
}
