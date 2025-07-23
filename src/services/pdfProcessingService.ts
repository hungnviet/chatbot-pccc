// Legacy PDF Processing Service - Refactored to use modular services
// This file now orchestrates the new modular services while maintaining API compatibility

// Import new modular services
import {
  SessionService,
  PDFProcessingService,
  VectorStoreService,
  SearchService,
  LLMService,
  PROCESSING_CONFIG,
  API_CONFIG,
  type UserSession,
  type ProcessingResult,
  type EmbeddingResult,
  type CombinedSearchResult
} from './index'

/**
 * Legacy PDF Processing Service
 * Orchestrates the new modular services while maintaining existing API
 */
export class PdfProcessingService {
  
  /**
   * Create or retrieve user session
   */
  static createOrRetrieveUserSession(sessionId?: string): string {
    try {
      if (sessionId) {
        const session = SessionService.getSession(sessionId)
        if (session) {
          console.log(`Retrieved existing session: ${sessionId}`)
          return sessionId
        }
        console.log(`Session ${sessionId} not found, creating new session`)
      }
      
      const newSessionId = SessionService.createSession()
      console.log(`Created new session: ${newSessionId}`)
      return newSessionId
      
    } catch (error) {
      console.error('Error in createOrRetrieveUserSession:', error)
      throw new Error(`Failed to create or retrieve user session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create session
   */
  static createSession(): string {
    return SessionService.createSession()
  }

  /**
   * Get session
   */
  static getSession(sessionId: string): UserSession | null {
    return SessionService.getSession(sessionId)
  }

  /**
   * Process PDF and create vector store
   */
  static async processPDF(
    file: File,
    sessionId: string
  ): Promise<{ success: boolean; sessionId: string; error?: string }> {
    try {
      console.log(`Processing PDF: ${file.name} for session: ${sessionId}`)
      
      // Validate session
      let session = SessionService.getSession(sessionId)
      if (!session) {
        console.log(`Session ${sessionId} not found, creating new session`)
        sessionId = SessionService.createSession()
        session = SessionService.getSession(sessionId)!
      }

      // Update session status
      SessionService.updateSession(sessionId, {
        vectorStoreStatus: 'creating',
        pdfName: file.name
      })

      // Validate PDF file
      const validation = PDFProcessingService.validatePDFFile(file)
      if (!validation.valid) {
        SessionService.updateSession(sessionId, {
          vectorStoreStatus: 'error',
          processingErrors: [{
            type: 'VALIDATION_ERROR',
            message: validation.error || 'File validation failed',
            timestamp: new Date()
          }]
        })
        
        return {
          success: false,
          sessionId,
          error: validation.error
        }
      }

      try {
        // Convert file to buffer
        const buffer = await file.arrayBuffer()
        
        // Process PDF
        const processingResult: ProcessingResult = await PDFProcessingService.processPDF(
          buffer,
          file.name
        )

        if (!processingResult.success) {
          SessionService.updateSession(sessionId, {
            vectorStoreStatus: 'error',
            processingErrors: processingResult.errors || []
          })
          
          return {
            success: false,
            sessionId,
            error: processingResult.error || 'PDF processing failed'
          }
        }

        // Get optimal configuration for vector store
        const config = VectorStoreService.getOptimalConfig(processingResult.documents.length)
        
        // Create vector store
        const embeddingResult: EmbeddingResult = await VectorStoreService.createVectorStore(
          processingResult.documents,
          config
        )

        if (!embeddingResult.success) {
          SessionService.updateSession(sessionId, {
            vectorStoreStatus: 'error',
            processingErrors: [{
              type: 'VECTORSTORE_ERROR',
              message: embeddingResult.error || 'Vector store creation failed',
              timestamp: new Date()
            }]
          })
          
          return {
            success: false,
            sessionId,
            error: embeddingResult.error || 'Vector store creation failed'
          }
        }

        // Update session with results
        SessionService.updateSession(sessionId, {
          vectorstore: embeddingResult.vectorStore!,
          documents: processingResult.documents,
          vectorStoreStatus: 'ready',
          processingErrors: []
        })

        console.log(`PDF processing completed successfully for session: ${sessionId}`)
        
        return {
          success: true,
          sessionId
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
        
        SessionService.updateSession(sessionId, {
          vectorStoreStatus: 'error',
          processingErrors: [{
            type: 'PROCESSING_ERROR',
            message: errorMessage,
            timestamp: new Date()
          }]
        })
        
        return {
          success: false,
          sessionId,
          error: errorMessage
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('PDF processing failed:', errorMessage)
      
      return {
        success: false,
        sessionId,
        error: errorMessage
      }
    }
  }

  /**
   * Query the processed PDF
   */
  static async queryPDF(
    question: string,
    sessionId: string
  ): Promise<{ success: boolean; answer?: string; error?: string }> {
    try {
      console.log(`Processing query for session: ${sessionId}`)
      
      // Validate session
      const session = SessionService.getSession(sessionId)
      if (!session) {
        return {
          success: false,
          error: 'Session not found. Please upload a PDF first.'
        }
      }

      if (!session.vectorstore || session.vectorStoreStatus !== 'ready') {
        return {
          success: false,
          error: 'PDF not processed yet. Please upload and process a PDF first.'
        }
      }

      // Validate question
      if (!question?.trim()) {
        return {
          success: false,
          error: 'Question cannot be empty.'
        }
      }

      if (question.length > API_CONFIG.MAX_QUESTION_LENGTH) {
        return {
          success: false,
          error: `Question is too long. Maximum length is ${API_CONFIG.MAX_QUESTION_LENGTH} characters.`
        }
      }

      try {
        // Perform search
        const searchResult: CombinedSearchResult = await SearchService.smartSearch(
          session.vectorstore,
          session.documents,
          question,
          {
            maxResults: PROCESSING_CONFIG.MAX_SEARCH_RESULTS,
            includeScores: true,
            searchType: 'hybrid'
          }
        )

        if (!searchResult.success) {
          return {
            success: false,
            error: searchResult.error || 'Search failed'
          }
        }

        if (searchResult.results.length === 0) {
          return {
            success: true,
            answer: "I couldn't find relevant information in the uploaded PDF to answer your question. Please try rephrasing your question or upload a different document."
          }
        }

        // Format search results for LLM
        const context = SearchService.formatSearchResults(searchResult.results)
        
        console.log(`Search context length: ${context.length} characters`)
        console.log(`Found ${searchResult.results.length} relevant document sections`)
        
        // Generate answer using LLM with RAG
        const llmResult = await LLMService.generateResponse(question, context)
        
        if (!llmResult.success) {
          return {
            success: false,
            error: llmResult.error || 'Failed to generate response'
          }
        }

        console.log(`RAG pipeline completed successfully for session: ${sessionId}`)
        
        return {
          success: true,
          answer: llmResult.response
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown query processing error'
        console.error('Query processing failed:', errorMessage)
        
        return {
          success: false,
          error: errorMessage
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Query failed:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Reset session
   */
  static async resetSession(sessionId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const success = await SessionService.resetSession(sessionId)
      
      if (success) {
        return {
          success: true,
          message: 'Session reset successfully'
        }
      } else {
        return {
          success: false,
          error: 'Session not found or reset failed'
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Session reset failed:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get session status
   */
  static getSessionStatus(sessionId: string) {
    return SessionService.getDetailedSessionStatus(sessionId)
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{
    status: string;
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      const services = {
        session: true, // SessionService is always available
        llm: await LLMService.healthCheck(),
        processing: true, // PDFProcessingService is always available
        vectorStore: true, // VectorStoreService is always available
        search: true // SearchService is always available
      }

      const allHealthy = Object.values(services).every(status => status === true)
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        services,
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      console.error('Health check failed:', error)
      
      return {
        status: 'error',
        services: {
          session: false,
          llm: false,
          processing: false,
          vectorStore: false,
          search: false
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Cleanup old sessions
   */
  static cleanupSessions(): number {
    return SessionService.cleanup()
  }

  /**
   * Get active session count
   */
  static getActiveSessionCount(): number {
    return SessionService.getActiveSessionCount()
  }

  // Legacy methods for backwards compatibility
  static async initializeLLM() {
    return await LLMService.initialize()
  }

  static cleanup() {
    return SessionService.cleanup()
  }
}
