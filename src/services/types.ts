import { Document } from 'langchain/document'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'

// Processing result interface
export interface ProcessingResult {
  success: boolean
  documents: Document[]
  extractedText: string
  metadata: {
    fileName: string
    documentCount: number
    textLength: number
    processingTimeMs: number
    chunkSize: number
    chunkOverlap: number
  }
  errors?: Array<{ type: ErrorType; message: string; timestamp: Date }>
  error?: string
}

// Vector store configuration
export interface VectorStoreConfig {
  batchSize: number
  timeout: number
  maxRetries: number
}

// Embedding result interface
export interface EmbeddingResult {
  success: boolean
  vectorStore?: MemoryVectorStore
  error?: string
  metadata?: {
    documentsProcessed: number
    processingTimeMs: number
    batchSize: number
  }
}

// User session interface
export interface UserSession {
  sessionId: string
  vectorstore: MemoryVectorStore | null
  documents: Document[]
  pdfName: string | null
  createdAt: Date
  lastAccessed: Date
  processingErrors: Array<{ type: ErrorType; message: string; timestamp: Date }>
  vectorStoreStatus: 'not_created' | 'creating' | 'ready' | 'error'
}

// Error types enum
export type ErrorType = 
  | 'SESSION_ERROR'
  | 'PROCESSING_ERROR'
  | 'TEXT_EXTRACTION_ERROR'
  | 'DOCUMENT_SPLITTING_ERROR'
  | 'VECTORSTORE_ERROR'
  | 'SEARCH_ERROR'
  | 'LLM_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'API_ERROR'

// Legacy interfaces for compatibility
export interface ValidationResult {
  isValid: boolean
  error?: string
}

export interface SearchResult {
  content: string
  score?: number
  index?: number
}

export interface ProcessingError {
  type: ErrorType
  message: string
  originalError?: Error
  timestamp: Date
}
