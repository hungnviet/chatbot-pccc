import { VectorStoreConfig } from './types'

// Processing configuration constants
export const PROCESSING_CONFIG = {
  // Document size thresholds (in KB)
  LARGE_DOC_THRESHOLD: 200,
  MEDIUM_DOC_THRESHOLD: 50,
  SMALL_DOC_THRESHOLD: 20,
  MAX_SAMPLED_CHUNKS: 100,
  
  // Text processing - default settings
  DEFAULT_CHUNK_SIZE: 1200,
  DEFAULT_CHUNK_OVERLAP: 200,
  CHUNK_SIZE: 1200, // Legacy, keeping for compatibility
  CHUNK_OVERLAP: 200, // Legacy, keeping for compatibility
  
  // Size-specific chunk settings
  SMALL_DOC_CHUNK_SIZE: 800,
  SMALL_DOC_CHUNK_OVERLAP: 100,
  MEDIUM_DOC_CHUNK_SIZE: 1000,
  MEDIUM_DOC_CHUNK_OVERLAP: 150,
  LARGE_DOC_CHUNK_SIZE: 1200,
  LARGE_DOC_CHUNK_OVERLAP: 200,
  
  // Batch sizes for processing
  STANDARD_BATCH_SIZE: 50,
  MEDIUM_BATCH_SIZE: 25,
  LARGE_BATCH_SIZE: 10,
  
  // File validation
  MAX_FILE_SIZE_MB: 10,
  
  // Session management
  SESSION_CLEANUP_HOURS: 24,
  
  // API timeouts
  LLM_TIMEOUT: 30000, // 30 seconds
  
  // Search settings
  MAX_SEARCH_RESULTS: 3,
} as const

// Vector store configurations for different document sizes
export const VECTOR_STORE_CONFIGS: Record<string, VectorStoreConfig> = {
  standard: { batchSize: 50, timeout: 60000, maxRetries: 3 },
  medium: { batchSize: 25, timeout: 120000, maxRetries: 3 },
  large: { batchSize: 50, timeout: 90000, maxRetries: 3 }
}

// Processing timeouts based on file size
export const TIMEOUT_CONFIG = {
  SMALL_FILE_THRESHOLD: 500000, // 500KB
  LARGE_FILE_TIMEOUT: 300000,   // 5 minutes
  MEDIUM_FILE_TIMEOUT: 180000   // 3 minutes
} as const

// API configuration
export const API_CONFIG = {
  OPENAI_MODEL: 'gpt-4o-mini',
  MAX_TOKENS: 1024,
  MAX_QUESTION_LENGTH: 1000,
  MAX_SEARCH_RESULTS_LENGTH: 8000,
  MAX_RESPONSE_LENGTH: 10000
} as const
