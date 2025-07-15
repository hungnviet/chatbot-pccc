import { Document } from 'langchain/document'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { OpenAIEmbeddings } from '@langchain/openai'
import { PROCESSING_CONFIG, VECTOR_STORE_CONFIGS } from '../constants'
import type { EmbeddingResult, VectorStoreConfig, ErrorType } from '../types'

export class VectorStoreService {
  private static embeddings: OpenAIEmbeddings | null = null

  /**
   * Initialize OpenAI embeddings
   */
  private static getEmbeddings(): OpenAIEmbeddings {
    if (!this.embeddings) {
      this.embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small',
        batchSize: 50,
        maxRetries: 3,
      })
    }
    return this.embeddings
  }

  /**
   * Create vector store from documents
   */
  static async createVectorStore(
    documents: Document[],
    config: VectorStoreConfig = VECTOR_STORE_CONFIGS.standard
  ): Promise<EmbeddingResult> {
    const startTime = Date.now()
    const errors: Array<{ type: ErrorType; message: string; timestamp: Date }> = []

    try {
      console.log(`Creating vector store with ${documents.length} documents using batch size ${config.batchSize}`)

      if (documents.length === 0) {
        throw new Error('No documents provided for vector store creation')
      }

      const embeddings = this.getEmbeddings()
      
      // Create vector store with progress tracking
      let vectorStore: MemoryVectorStore
      
      try {
        // Process documents in batches
        const batches = this.chunkArray(documents, config.batchSize)
        console.log(`Processing ${batches.length} batches of documents`)
        
        // Create initial vector store with first batch
        vectorStore = await MemoryVectorStore.fromDocuments(batches[0], embeddings)
        console.log(`Created initial vector store with ${batches[0].length} documents`)
        
        // Add remaining batches
        for (let i = 1; i < batches.length; i++) {
          await this.addDocumentsBatch(vectorStore, batches[i], embeddings)
          console.log(`Added batch ${i + 1}/${batches.length} (${batches[i].length} documents)`)
        }
        
      } catch (error) {
        const errorMsg = `Vector store creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push({
          type: 'VECTORSTORE_ERROR',
          message: errorMsg,
          timestamp: new Date()
        })
        throw new Error(errorMsg)
      }

      const processingTime = Date.now() - startTime
      console.log(`Vector store created successfully in ${processingTime}ms`)

      return {
        success: true,
        vectorStore,
        metadata: {
          documentsProcessed: documents.length,
          processingTimeMs: processingTime,
          batchSize: config.batchSize
        }
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during vector store creation'
      
      console.error('Vector store creation failed:', errorMessage)
      
      // Add general error if not already added
      if (!errors.some(e => e.message === errorMessage)) {
        errors.push({
          type: 'VECTORSTORE_ERROR',
          message: errorMessage,
          timestamp: new Date()
        })
      }
      
      return {
        success: false,
        error: errorMessage,
        metadata: {
          documentsProcessed: 0,
          processingTimeMs: processingTime,
          batchSize: config.batchSize
        }
      }
    }
  }

  /**
   * Add documents to existing vector store in batches
   */
  private static async addDocumentsBatch(
    vectorStore: MemoryVectorStore,
    documents: Document[],
    embeddings: OpenAIEmbeddings,
    retries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await vectorStore.addDocuments(documents)
        return
      } catch (error) {
        if (attempt === retries) {
          throw error
        }
        console.warn(`Batch add attempt ${attempt} failed, retrying...`)
        await this.delay(1000 * attempt) // Progressive delay
      }
    }
  }

  /**
   * Perform similarity search
   */
  static async similaritySearch(
    vectorStore: MemoryVectorStore,
    query: string,
    k: number = PROCESSING_CONFIG.MAX_SEARCH_RESULTS
  ): Promise<{ success: boolean; results?: Document[]; error?: string }> {
    try {
      if (!query?.trim()) {
        return {
          success: false,
          error: 'Query cannot be empty'
        }
      }

      if (!vectorStore) {
        return {
          success: false,
          error: 'Vector store not available'
        }
      }

      console.log(`Performing similarity search for: "${query}" (k=${k})`)
      
      const results = await vectorStore.similaritySearch(query, k)
      
      console.log(`Found ${results.length} similar documents`)
      
      return {
        success: true,
        results
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown search error'
      console.error('Similarity search failed:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Perform similarity search with scores
   */
  static async similaritySearchWithScore(
    vectorStore: MemoryVectorStore,
    query: string,
    k: number = PROCESSING_CONFIG.MAX_SEARCH_RESULTS
  ): Promise<{ 
    success: boolean; 
    results?: Array<[Document, number]>; 
    error?: string 
  }> {
    try {
      if (!query?.trim()) {
        return {
          success: false,
          error: 'Query cannot be empty'
        }
      }

      if (!vectorStore) {
        return {
          success: false,
          error: 'Vector store not available'
        }
      }

      console.log(`Performing similarity search with scores for: "${query}" (k=${k})`)
      
      const results = await vectorStore.similaritySearchWithScore(query, k)
      
      console.log(`Found ${results.length} similar documents with scores`)
      
      return {
        success: true,
        results
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown search error'
      console.error('Similarity search with scores failed:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get optimal vector store configuration based on document count
   */
  static getOptimalConfig(documentCount: number): VectorStoreConfig {
    if (documentCount < 20) {
      return VECTOR_STORE_CONFIGS.standard
    } else if (documentCount < 100) {
      return VECTOR_STORE_CONFIGS.medium
    } else {
      return VECTOR_STORE_CONFIGS.large
    }
  }

  /**
   * Validate vector store
   */
  static validateVectorStore(vectorStore: MemoryVectorStore | null): {
    isValid: boolean;
    error?: string;
  } {
    if (!vectorStore) {
      return {
        isValid: false,
        error: 'Vector store is null or undefined'
      }
    }

    try {
      // Basic validation - try to access vector store properties
      const docCount = vectorStore.memoryVectors?.length || 0
      
      if (docCount === 0) {
        return {
          isValid: false,
          error: 'Vector store contains no documents'
        }
      }

      return {
        isValid: true
      }

    } catch (error) {
      return {
        isValid: false,
        error: `Vector store validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get vector store statistics
   */
  static getVectorStoreStats(vectorStore: MemoryVectorStore | null) {
    if (!vectorStore) {
      return {
        documentCount: 0,
        isValid: false
      }
    }

    try {
      const documentCount = vectorStore.memoryVectors?.length || 0
      
      return {
        documentCount,
        isValid: documentCount > 0,
        hasEmbeddings: documentCount > 0
      }

    } catch (error) {
      return {
        documentCount: 0,
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Utility function to add delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
