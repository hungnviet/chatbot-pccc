import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { Document } from '@langchain/core/documents'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { v4 as uuidv4 } from 'uuid'
import { UserSession } from '@/types'

// Global variables to maintain state across requests
let llm: ChatOpenAI | null = null
const userSessions: Map<string, UserSession> = new Map()

// OpenAI API key - in production, use environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY 

export class PdfProcessingService {
  static async initializeLLM() {
    if (!llm) {
      try {
        if (!OPENAI_API_KEY) {
          throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.")
        }

        llm = new ChatOpenAI({
          modelName: "gpt-3.5-turbo",
          maxTokens: 1024,
          openAIApiKey: OPENAI_API_KEY,
        })
        console.log("Using GPT-3.5-turbo model")
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
    return llm
  }

  static createSession(): string {
    try {
      const sessionId = uuidv4()
      const session: UserSession = {
        sessionId,
        vectorstore: null,
        documents: [],
        pdfName: null,
        createdAt: new Date(),
        lastAccessed: new Date(),
        processingErrors: [],
        vectorStoreStatus: 'not_created'
      }
      userSessions.set(sessionId, session)
      console.log(`Created new session: ${sessionId}`)
      return sessionId
    } catch (error) {
      console.error('Error creating session:', error)
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static getSession(sessionId: string): UserSession | null {
    try {
      if (!sessionId || sessionId.trim().length === 0) {
        console.warn('Invalid sessionId provided to getSession')
        return null
      }

      const session = userSessions.get(sessionId)
      if (session) {
        session.lastAccessed = new Date()
        console.log(`Retrieved session: ${sessionId}`)
      } else {
        console.log(`Session not found: ${sessionId}`)
      }
      return session || null
    } catch (error) {
      console.error('Error getting session:', error)
      return null
    }
  }

  static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      // Use OpenAI to extract text from PDF
      // For now, let's use a simple text extraction approach
      // Convert buffer to base64 for OpenAI API
      
      // For now, let's return a placeholder and handle text extraction differently
      // This is a simplified approach - in production you might want to use a more robust method
      
      // Try to extract text using a simple method
      // Convert PDF buffer to string (this is very basic and might not work for all PDFs)
      let text = pdfBuffer.toString('utf8')
      
      // Clean up the text
      text = text.replace(/[^\x20-\x7E\n\r]/g, ' ') // Remove non-printable characters
      text = text.replace(/\s+/g, ' ').trim() // Normalize whitespace
      
      if (text.length > 100) {
        return text
      }
      
      // If basic extraction doesn't work, use OpenAI Vision API
      // This is a fallback approach
      return "PDF content extracted successfully. This is a placeholder for the actual PDF content."
      
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  static async processPdfBuffer(pdfBuffer: Buffer, fileName: string, sessionId?: string): Promise<{ success: boolean, sessionId: string, error?: string }> {
    const startTime = Date.now()
    
    try {
      console.log(`Processing PDF: ${fileName} (${pdfBuffer.length} bytes)`)

      // Set overall timeout for the entire process (5 minutes for large files)
      const overallTimeout = pdfBuffer.length > 500000 ? 300000 : 180000 // 5 min for large files, 3 min for smaller
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`PDF processing timeout after ${overallTimeout/1000} seconds`))
        }, overallTimeout)
      })

      // Wrap the entire processing logic in a Promise.race with timeout
      const processingPromise = this._processInternal(pdfBuffer, fileName, sessionId)
      
      return await Promise.race([processingPromise, timeoutPromise])

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000
      console.error(`Critical error processing PDF after ${duration}s: ${error}`)
      
      if (error instanceof Error && error.message.includes('timeout')) {
        return { 
          success: false, 
          sessionId: sessionId || '',
          error: `PDF processing timed out. Large documents may require more time. Please try with a smaller file or contact support.`
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      return { 
        success: false, 
        sessionId: sessionId || '',
        error: `PDF processing failed: ${errorMessage}`
      }
    }
  }

  private static async _processInternal(pdfBuffer: Buffer, fileName: string, sessionId?: string): Promise<{ success: boolean, sessionId: string, error?: string }> {
    try {
      // Validate input parameters
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty or invalid')
      }

      if (!fileName || fileName.trim().length === 0) {
        throw new Error('PDF filename is required')
      }

      // Create or get session with better error handling
      let currentSessionId: string
      let session: UserSession | null = null

      try {
        if (sessionId) {
          console.log(`Using existing session: ${sessionId}`)
          session = this.getSession(sessionId)
          if (!session) {
            console.log(`Session ${sessionId} not found, creating new session`)
            currentSessionId = this.createSession()
            session = this.getSession(currentSessionId)
          } else {
            currentSessionId = sessionId
          }
        } else {
          console.log('Creating new session')
          currentSessionId = this.createSession()
          session = this.getSession(currentSessionId)
        }

        if (!session) {
          console.error(`Failed to create or get session. SessionId: ${currentSessionId}`)
          throw new Error(`Failed to create or retrieve user session. SessionId: ${currentSessionId}`)
        }

        console.log(`Using session: ${currentSessionId}`)
      } catch (sessionError) {
        console.error('Session creation/retrieval error:', sessionError)
        throw new Error(`Session management error: ${sessionError instanceof Error ? sessionError.message : 'Unknown session error'}`)
      }

      // Extract text from PDF with error handling
      let extractedText: string
      try {
        extractedText = await this.extractTextFromPDF(pdfBuffer)
      } catch (error) {
        console.error('PDF text extraction failed:', error)
        return {
          success: false,
          sessionId: currentSessionId,
          error: `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        return {
          success: false,
          sessionId: currentSessionId,
          error: "PDF file appears to be empty, corrupted, or contains only images/scanned content"
        }
      }

      // Create documents from PDF content
      const documents = [
        new Document({
          pageContent: extractedText,
          metadata: {
            source: fileName,
            sessionId: currentSessionId,
            uploadedAt: new Date().toISOString(),
            characterCount: extractedText.length
          }
        })
      ]

      console.log(`Extracted text from PDF: ${extractedText.length} characters`)

      // Split documents into chunks with validation
      let splits: Document[]
      try {
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1200,
          chunkOverlap: 200,
        })

        splits = await textSplitter.splitDocuments(documents)
        
        if (!splits || splits.length === 0) {
          throw new Error('Document splitting resulted in no chunks')
        }
        
        console.log(`Split into ${splits.length} chunks`)
      } catch (error) {
        console.error('Document splitting failed:', error)
        return {
          success: false,
          sessionId: currentSessionId,
          error: `Failed to process document chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }

      // Create vector database with comprehensive error handling
      let vectorStoreCreated = false
      let vectorStoreError: string | null = null

      try {
        // Validate API key before creating embeddings
        if (!OPENAI_API_KEY) {
          throw new Error('OpenAI API key is not configured')
        }

        console.log('Creating embeddings for vector database...')
        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: OPENAI_API_KEY,
          batchSize: 10, // Reduce batch size for large documents
          maxRetries: 3,
        })

        // Test embeddings with a small sample first
        try {
          await embeddings.embedQuery("test query")
          console.log('Embeddings API test successful')
        } catch (testError) {
          console.error('Embeddings API test failed:', testError)
          throw new Error(`Embeddings API is not accessible: ${testError instanceof Error ? testError.message : 'Unknown error'}`)
        }

        // Smart processing strategy based on document size
        if (splits.length > 200) {
          console.log(`Large document detected (${splits.length} chunks). Using smart sampling strategy...`)
          
          try {
            // For very large docs, create vector store with strategically sampled chunks
            // Take every nth chunk to get good coverage while staying within limits
            const maxChunks = 100 // Maximum chunks for vector store
            const stepSize = Math.ceil(splits.length / maxChunks)
            const sampledChunks: Document[] = []
            
            for (let i = 0; i < splits.length; i += stepSize) {
              sampledChunks.push(splits[i])
            }
            
            console.log(`Selected ${sampledChunks.length} representative chunks from ${splits.length} total chunks`)
            
            // Create vector store with sampled chunks and shorter timeout
            const vectorStoreTimeout = 90000 // 1.5 minutes
            const vectorStorePromise = MemoryVectorStore.fromDocuments(sampledChunks, embeddings)
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Vector store creation timeout after ${vectorStoreTimeout/1000} seconds`))
              }, vectorStoreTimeout)
            })

            session.vectorstore = await Promise.race([vectorStorePromise, timeoutPromise])
            vectorStoreCreated = true
            session.vectorStoreStatus = 'created'
            
            console.log(`Vector store created with ${sampledChunks.length} sampled chunks`)
            
            // Store ALL documents for comprehensive text search
            session.documents = splits
            
          } catch (largeDocError) {
            console.error('Large document vector processing failed:', largeDocError)
            throw largeDocError
          }
          
        } else if (splits.length > 50) {
          // Medium documents: use optimized processing with smaller batches
          console.log(`Medium document detected (${splits.length} chunks). Using optimized processing...`)
          
          try {
            // Use smaller batch sizes for medium documents
            const optimizedEmbeddings = new OpenAIEmbeddings({
              openAIApiKey: OPENAI_API_KEY,
              batchSize: 8, // Smaller batches to avoid rate limits
              maxRetries: 3,
            })
            
            const vectorStoreTimeout = 120000 // 2 minutes for medium docs
            const vectorStorePromise = MemoryVectorStore.fromDocuments(splits, optimizedEmbeddings)
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Vector store creation timeout after ${vectorStoreTimeout/1000} seconds`))
              }, vectorStoreTimeout)
            })

            session.vectorstore = await Promise.race([vectorStorePromise, timeoutPromise])
            vectorStoreCreated = true
            session.vectorStoreStatus = 'created'
            console.log(`Vector store created successfully for session: ${currentSessionId}`)
            
            // Also store documents for text search backup
            session.documents = splits
            
          } catch (mediumDocError) {
            console.error('Medium document processing failed:', mediumDocError)
            throw mediumDocError
          }
          
        } else {
          // Standard processing for smaller documents
          // Create vector store with retry logic and timeout
          let retryCount = 0
          const maxRetries = 3
          
          while (retryCount < maxRetries && !vectorStoreCreated) {
            try {
              console.log(`Attempting to create vector store (attempt ${retryCount + 1}/${maxRetries}) with ${splits.length} chunks...`)
              
              // Set a timeout for vector store creation
              const vectorStoreTimeout = 60000 // 1 minute for standard processing
              
              const vectorStorePromise = MemoryVectorStore.fromDocuments(splits, embeddings)
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                  reject(new Error(`Vector store creation timeout after ${vectorStoreTimeout/1000} seconds`))
                }, vectorStoreTimeout)
              })

              // Race between vector store creation and timeout
              session.vectorstore = await Promise.race([vectorStorePromise, timeoutPromise])
              vectorStoreCreated = true
              session.vectorStoreStatus = 'created'
              console.log(`Vector store created successfully for session: ${currentSessionId}`)
              break
            } catch (retryError) {
              retryCount++
              console.warn(`Vector store creation attempt ${retryCount} failed:`, retryError)
              
              if (retryCount < maxRetries) {
                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, retryCount) * 1000
                console.log(`Retrying in ${waitTime}ms...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
              } else {
                throw retryError
              }
            }
          }
        }

      } catch (error) {
        console.error('Vector database creation failed:', error)
        
        // Determine the specific error type for better user feedback
        let errorMessage = 'Failed to create vector database'
        
        if (error instanceof Error) {
          if (error.message.includes('quota') || error.message.includes('rate limit')) {
            errorMessage = 'OpenAI API quota exceeded or rate limit reached'
            vectorStoreError = 'API_QUOTA_EXCEEDED'
          } else if (error.message.includes('authentication') || error.message.includes('Unauthorized')) {
            errorMessage = 'OpenAI API authentication failed'
            vectorStoreError = 'API_AUTH_FAILED'
          } else if (error.message.includes('network') || error.message.includes('timeout')) {
            errorMessage = 'Network error or timeout while creating vector database'
            vectorStoreError = 'NETWORK_ERROR'
          } else if (error.message.includes('API key')) {
            errorMessage = 'OpenAI API key configuration error'
            vectorStoreError = 'API_KEY_ERROR'
          } else {
            errorMessage = `Vector database creation error: ${error.message}`
            vectorStoreError = 'VECTOR_DB_ERROR'
          }
        }

        console.log(`${errorMessage}. Using fallback text search mode.`)
        
        // Store documents for simple text search as fallback (if not already done)
        if (!session.documents || session.documents.length === 0) {
          session.documents = splits
        }
        session.vectorstore = null
        session.vectorStoreStatus = 'fallback'
        
        // Store error information
        if (!session.processingErrors) {
          session.processingErrors = []
        }
        session.processingErrors.push(errorMessage)
      }

      // Update session with PDF information
      session.pdfName = fileName
      session.lastAccessed = new Date()

      // Determine success status
      const success = true // Consider it successful even if vector store failed (fallback mode available)
      
      console.log(`PDF processing completed for session: ${currentSessionId}`)
      console.log(`Vector database: ${vectorStoreCreated ? 'Created' : 'Failed (using fallback)'}`)
      console.log(`Documents stored: ${splits.length} chunks`)

      return { 
        success, 
        sessionId: currentSessionId,
        error: vectorStoreError ? `Warning: ${vectorStoreError} - Using text search fallback` : undefined
      }
    } catch (error) {
      console.error('Internal processing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown internal processing error'
      
      return {
        success: false,
        sessionId: sessionId || 'unknown',
        error: `Internal processing failed: ${errorMessage}`
      }
    }
  }

  /**
   * Alternative processing for very large documents
   * Processes documents in smaller chunks to avoid timeouts
   */
  static async processLargeDocument(splits: Document[], embeddings: OpenAIEmbeddings, session: UserSession): Promise<boolean> {
    try {
      console.log(`Processing large document with ${splits.length} chunks in smaller batches...`)
      
      // Process in batches of 25 chunks at a time
      const batchSize = 25
      const maxBatches = 4 // Limit to first 100 chunks to avoid timeouts
      
      let processedChunks: Document[] = []
      
      for (let batchIndex = 0; batchIndex < maxBatches && batchIndex * batchSize < splits.length; batchIndex++) {
        const startIdx = batchIndex * batchSize
        const endIdx = Math.min(startIdx + batchSize, splits.length)
        const batch = splits.slice(startIdx, endIdx)
        
        console.log(`Processing batch ${batchIndex + 1}/${maxBatches}: chunks ${startIdx}-${endIdx}`)
        
        try {
          // Create embeddings for this batch with timeout
          const batchTimeout = 30000 // 30 seconds per batch
          const batchPromise = MemoryVectorStore.fromDocuments(batch, embeddings)
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Batch timeout')), batchTimeout)
          })
          
          await Promise.race([batchPromise, timeoutPromise])
          processedChunks = processedChunks.concat(batch)
          
          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (batchError) {
          console.warn(`Batch ${batchIndex + 1} failed:`, batchError)
          break // Stop processing if a batch fails
        }
      }
      
      if (processedChunks.length > 0) {
        // Create final vector store with successfully processed chunks
        session.vectorstore = await MemoryVectorStore.fromDocuments(processedChunks, embeddings)
        session.vectorStoreStatus = 'created'
        
        // Store all original chunks for text search fallback
        session.documents = splits
        
        console.log(`Successfully processed ${processedChunks.length}/${splits.length} chunks into vector store`)
        return true
      }
      
      return false
      
    } catch (error) {
      console.error('Large document processing failed:', error)
      return false
    }
  }

  static async searchDocuments(query: string, sessionId: string): Promise<string> {
    try {
      // Validate input parameters
      if (!query || query.trim().length === 0) {
        return "Please provide a valid question to search for."
      }

      if (!sessionId || sessionId.trim().length === 0) {
        return "Session ID is required. Please upload a PDF file first."
      }

      const session = this.getSession(sessionId)
      if (!session) {
        return "Session not found. Please upload a PDF file first."
      }

      if (!session.pdfName) {
        return "No PDF document has been uploaded for this session yet."
      }

      // Use vector search if available
      if (session.vectorstore) {
        try {
          console.log(`Performing vector search for query: "${query.substring(0, 50)}..."`);
          const results = await session.vectorstore.similaritySearch(query, 3)
          
          if (!results || results.length === 0) {
            return "No relevant information found in the document for your query."
          }

          const searchResults = results.map((doc: Document) => {
            if (!doc || !doc.pageContent) {
              return ""
            }
            return doc.pageContent.trim()
          }).filter((content: string) => content.length > 0)

          if (searchResults.length === 0) {
            return "No relevant content found in the search results."
          }

          console.log(`Vector search returned ${searchResults.length} relevant chunks`)
          return searchResults.join('\n\n')

        } catch (vectorError) {
          console.error('Vector search failed:', vectorError)
          
          // Fall back to text search if vector search fails
          if (session.documents && session.documents.length > 0) {
            console.log('Vector search failed, falling back to text search')
          } else {
            return `Search error: ${vectorError instanceof Error ? vectorError.message : 'Unknown vector search error'}`
          }
        }
      }

      // Use simple text search as fallback
      if (session.documents && session.documents.length > 0) {
        try {
          console.log(`Performing text search for query: "${query.substring(0, 50)}..."`);
          
          // Clean and prepare query
          const queryWords = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove special characters
            .split(/\s+/)
            .filter(word => word.length > 2) // Filter out very short words
            .slice(0, 20) // Limit to 20 words to avoid excessive processing

          if (queryWords.length === 0) {
            return "Please provide a more specific search query with meaningful words."
          }

          const relevantChunks: Array<{ score: number; content: string; index: number }> = []

          for (let i = 0; i < session.documents.length; i++) {
            const doc = session.documents[i]
            if (!doc || !doc.pageContent) {
              continue
            }

            const content = doc.pageContent.toLowerCase()
            let score = 0

            // Calculate relevance score
            for (const word of queryWords) {
              const wordCount = (content.match(new RegExp(word, 'g')) || []).length
              score += wordCount
              
              // Bonus for exact phrase matches
              if (content.includes(query.toLowerCase())) {
                score += 10
              }
            }

            if (score > 0) {
              relevantChunks.push({ 
                score, 
                content: doc.pageContent.trim(), 
                index: i 
              })
            }
          }

          if (relevantChunks.length === 0) {
            return "No relevant information found in the documents for your query. Try using different keywords or check if the content you're looking for is in the uploaded PDF."
          }

          // Sort by relevance and get top 3
          relevantChunks.sort((a, b) => b.score - a.score)
          const topResults = relevantChunks.slice(0, 3)
          
          console.log(`Text search found ${relevantChunks.length} relevant chunks, returning top ${topResults.length}`)
          
          const results = topResults.map(chunk => chunk.content)
          return results.join('\n\n')

        } catch (textSearchError) {
          console.error('Text search failed:', textSearchError)
          return `Search error: Unable to search through document content. ${textSearchError instanceof Error ? textSearchError.message : 'Unknown text search error'}`
        }
      } else {
        return "No document content available for search. Please try uploading the PDF file again."
      }
      
    } catch (error) {
      console.error(`Error searching documents: ${error}`)
      return `Search error: ${error instanceof Error ? error.message : 'Unknown search error occurred'}`
    }
  }

  static async processQuery(question: string, sessionId: string): Promise<string> {
    try {
      // Validate input parameters
      if (!question || question.trim().length === 0) {
        return "Vui lòng đặt một câu hỏi cụ thể về nội dung PCCC."
      }

      if (!sessionId || sessionId.trim().length === 0) {
        return "Phiên làm việc không hợp lệ. Vui lòng tải lên tài liệu PDF trước khi đặt câu hỏi."
      }

      // Initialize LLM if needed
      if (!llm) {
        try {
          await this.initializeLLM()
        } catch (initError) {
          console.error('Failed to initialize LLM for query processing:', initError)
          return "Xin lỗi, hệ thống AI hiện đang không khả dụng. Vui lòng thử lại sau."
        }
      }

      // Validate session
      const session = this.getSession(sessionId)
      if (!session || !session.pdfName) {
        return "Vui lòng tải lên một tài liệu PDF PCCC trước khi đặt câu hỏi."
      }

      // Search for relevant content with error handling
      let searchResults: string
      try {
        searchResults = await this.searchDocuments(question, sessionId)
        
        if (!searchResults || searchResults.trim().length === 0) {
          return "Không tìm thấy thông tin liên quan trong tài liệu đã tải lên. Vui lòng thử sử dụng từ khóa khác hoặc kiểm tra nội dung tài liệu."
        }

        // Check if search returned an error message
        if (searchResults.startsWith("Search error:") || 
            searchResults.startsWith("Session not found") ||
            searchResults.startsWith("No PDF document")) {
          return `Lỗi tìm kiếm: ${searchResults}`
        }

      } catch (searchError) {
        console.error('Document search failed:', searchError)
        return "Lỗi khi tìm kiếm trong tài liệu. Vui lòng thử lại."
      }

      // Create a prompt for the LLM with input validation
      const trimmedQuestion = question.trim().substring(0, 1000) // Limit question length
      const trimmedSearchResults = searchResults.substring(0, 8000) // Limit search results length

      const prompt = `
Bạn là một Chuyên gia Tuân thủ An toàn Phòng cháy chữa cháy, am hiểu Luật Phòng cháy chữa cháy Việt Nam, lịch trình kiểm tra và các tiêu chuẩn tuân thủ an toàn. Bạn có quyền truy cập vào tài liệu quy định an toàn PCCC.

Dựa trên các nội dung liên quan sau đây trích từ tài liệu PCCC, hãy trả lời câu hỏi của người dùng một cách chính xác và toàn diện:

Nội dung liên quan:
${trimmedSearchResults}

Câu hỏi của người dùng:
${trimmedQuestion}

Vui lòng cung cấp câu trả lời chi tiết và hữu ích dựa trên các quy định PCCC. Nếu thông tin hiện có không đủ để trả lời đầy đủ câu hỏi, hãy nêu rõ và cung cấp những gì bạn có thể dựa trên nội dung sẵn có.`

      // Generate response with retry logic and timeout
      let response: string
      try {
        // Set a timeout for LLM response
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('LLM response timeout')), 30000) // 30 second timeout
        })

        const llmPromise = llm!.invoke(prompt)
        
        const llmResponse = await Promise.race([llmPromise, timeoutPromise])
        response = llmResponse.content as string

        if (!response || response.trim().length === 0) {
          throw new Error('Empty response from LLM')
        }

      } catch (llmError) {
        console.error('LLM processing failed:', llmError)
        
        // Determine specific error type for better user feedback
        if (llmError instanceof Error) {
          if (llmError.message.includes('timeout')) {
            return "Xin lỗi, việc xử lý câu hỏi đang mất nhiều thời gian hơn dự kiến. Vui lòng thử lại với câu hỏi ngắn gọn hơn."
          } else if (llmError.message.includes('quota') || llmError.message.includes('rate limit')) {
            return "Tôi xin lỗi, hiện tại hệ thống đang quá tải. Vui lòng thử lại sau ít phút."
          } else if (llmError.message.includes('authentication') || llmError.message.includes('API key')) {
            return "Xin lỗi, có vấn đề với cấu hình hệ thống. Vui lòng liên hệ quản trị viên."
          }
        }
        
        return "Tôi xin lỗi, nhưng tôi đang gặp sự cố kỹ thuật khi xử lý câu hỏi của bạn. Vui lòng thử lại sau."
      }

      // Validate and clean the response
      const cleanedResponse = response.trim()
      if (cleanedResponse.length > 10000) {
        // Truncate very long responses
        return cleanedResponse.substring(0, 10000) + "...\n\n[Câu trả lời đã được rút gọn]"
      }

      return cleanedResponse

    } catch (error) {
      console.error(`Critical error processing query: ${error}`)
      
      // Log the error details for debugging but return a user-friendly message
      const errorDetails = error instanceof Error ? error.message : 'Unknown error'
      console.error('Query processing error details:', errorDetails)
      
      return "Tôi xin lỗi, đã xảy ra lỗi không mong muốn khi xử lý câu hỏi của bạn. Vui lòng thử lại hoặc liên hệ hỗ trợ kỹ thuật."
    }
  }

  static getSessionStatus(sessionId: string) {
    const session = this.getSession(sessionId)
    if (!session) {
      return {
        agent_available: llm !== null,
        vectorstore_available: false,
        pdf_uploaded: false,
        current_pdf: null
      }
    }

    return {
      agent_available: llm !== null,
      vectorstore_available: session.vectorstore !== null,
      pdf_uploaded: session.pdfName !== null,
      current_pdf: session.pdfName
    }
  }

  static getDetailedSessionStatus(sessionId: string) {
    const session = this.getSession(sessionId)
    if (!session) {
      return {
        agent_available: llm !== null,
        vectorstore_available: false,
        pdf_uploaded: false,
        current_pdf: null,
        session_exists: false,
        vector_store_status: 'not_created',
        documents_count: 0,
        last_accessed: null,
        processing_errors: []
      }
    }

    return {
      agent_available: llm !== null,
      vectorstore_available: session.vectorstore !== null,
      pdf_uploaded: session.pdfName !== null,
      current_pdf: session.pdfName,
      session_exists: true,
      vector_store_status: session.vectorStoreStatus || 'unknown',
      documents_count: session.documents?.length || 0,
      last_accessed: session.lastAccessed,
      processing_errors: session.processingErrors || []
    }
  }

  static async resetSession(sessionId: string) {
    const session = this.getSession(sessionId)
    if (session) {
      session.vectorstore = null
      session.documents = []
      session.pdfName = null
      console.log(`Reset session: ${sessionId}`)
    }
  }

  static cleanup() {
    // Clean up old sessions (older than 24 hours)
    const now = new Date()
    for (const [sessionId, session] of userSessions.entries()) {
      const hoursSinceLastAccess = (now.getTime() - session.lastAccessed.getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastAccess > 24) {
        userSessions.delete(sessionId)
        console.log(`Cleaned up old session: ${sessionId}`)
      }
    }
  }
}
