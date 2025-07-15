import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { Document } from '@langchain/core/documents'

export interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
  isError?: boolean
}

export interface ChatResponse {
  response: string
  source?: string
  requires_upload?: boolean
  error?: string
  sessionId?: string
}

export interface HealthResponse {
  status: string
  agent_available: boolean
  vectorstore_available: boolean
  pdf_uploaded: boolean
  current_pdf?: string
  sessionId?: string
  error?: string
}

export interface UploadResponse {
  message: string
  filename: string
  agent_ready: boolean
  error?: string
  sessionId: string
}

export interface QueryRequest {
  question: string
  sessionId?: string
}

export interface PdfProcessingError extends Error {
  code?: string
  statusCode?: number
  type?: 'API_QUOTA_EXCEEDED' | 'API_AUTH_FAILED' | 'NETWORK_ERROR' | 'API_KEY_ERROR' | 'VECTOR_DB_ERROR' | 'PDF_PROCESSING_ERROR'
}

export interface PdfProcessingResult {
  success: boolean
  sessionId: string
  error?: string
  warning?: string
  vectorStoreCreated?: boolean
  documentsCount?: number
}

// Import ErrorType from services
import { ErrorType } from '../services/types'

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
