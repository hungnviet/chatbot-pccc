import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import pdfParse from 'pdf-parse'
import { PROCESSING_CONFIG } from '../constants'
import type { ProcessingResult, ErrorType } from '../types'

export class PDFProcessingService {
  /**
   * Extract text from PDF buffer using pdf-parse
   */
  static async extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
    try {
      console.log('Starting PDF text extraction...')
      
      // Convert ArrayBuffer to Buffer
      const pdfBuffer = Buffer.from(buffer)
      
      // Extract text using pdf-parse
      const data = await pdfParse(pdfBuffer)
      
      if (!data || !data.text) {
        throw new Error('No text could be extracted from the PDF')
      }

      const fullText = data.text.trim()
      
      if (!fullText) {
        throw new Error('PDF appears to be empty or contains only images')
      }

      console.log(`Total extracted text length: ${fullText.length} characters from ${data.numpages} pages`)
      return fullText
      
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Split text into documents using text splitter
   */
  static async splitTextIntoDocuments(
    text: string, 
    pdfName: string,
    chunkSize: number = PROCESSING_CONFIG.DEFAULT_CHUNK_SIZE,
    chunkOverlap: number = PROCESSING_CONFIG.DEFAULT_CHUNK_OVERLAP
  ): Promise<Document[]> {
    try {
      console.log(`Splitting text into documents with chunk size: ${chunkSize}`)
      
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        separators: ['\n\n', '\n', '. ', ' ', ''],
      })

      const splitDocs = await textSplitter.createDocuments(
        [text],
        [{ source: pdfName, type: 'pdf' }]
      )

      console.log(`Created ${splitDocs.length} document chunks`)
      
      if (splitDocs.length === 0) {
        throw new Error('Failed to create document chunks from text')
      }

      return splitDocs
      
    } catch (error) {
      console.error('Error splitting text into documents:', error)
      throw new Error(`Failed to split text into documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process PDF file - complete pipeline
   */
  static async processPDF(
    buffer: ArrayBuffer,
    fileName: string,
    options: {
      chunkSize?: number
      chunkOverlap?: number
    } = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    const errors: Array<{ type: ErrorType; message: string; timestamp: Date }> = []
    
    try {
      console.log(`Starting PDF processing for: ${fileName}`)
      
      // Extract text from PDF
      let extractedText: string
      try {
        extractedText = await this.extractTextFromPDF(buffer)
      } catch (error) {
        const errorMsg = `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push({
          type: 'TEXT_EXTRACTION_ERROR',
          message: errorMsg,
          timestamp: new Date()
        })
        throw new Error(errorMsg)
      }

      // Split into documents
      let documents: Document[]
      try {
        documents = await this.splitTextIntoDocuments(
          extractedText,
          fileName,
          options.chunkSize,
          options.chunkOverlap
        )
      } catch (error) {
        const errorMsg = `Document splitting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push({
          type: 'DOCUMENT_SPLITTING_ERROR',
          message: errorMsg,
          timestamp: new Date()
        })
        throw new Error(errorMsg)
      }

      const processingTime = Date.now() - startTime
      
      console.log(`PDF processing completed in ${processingTime}ms`)
      console.log(`Created ${documents.length} document chunks`)
      
      return {
        success: true,
        documents,
        extractedText,
        metadata: {
          fileName,
          documentCount: documents.length,
          textLength: extractedText.length,
          processingTimeMs: processingTime,
          chunkSize: options.chunkSize || PROCESSING_CONFIG.DEFAULT_CHUNK_SIZE,
          chunkOverlap: options.chunkOverlap || PROCESSING_CONFIG.DEFAULT_CHUNK_OVERLAP
        },
        errors: errors.length > 0 ? errors : undefined
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF processing'
      
      console.error('PDF processing failed:', errorMessage)
      
      // Add general processing error if not already added
      if (!errors.some(e => e.message === errorMessage)) {
        errors.push({
          type: 'PROCESSING_ERROR',
          message: errorMessage,
          timestamp: new Date()
        })
      }
      
      return {
        success: false,
        documents: [],
        extractedText: '',
        metadata: {
          fileName,
          documentCount: 0,
          textLength: 0,
          processingTimeMs: processingTime,
          chunkSize: options.chunkSize || PROCESSING_CONFIG.DEFAULT_CHUNK_SIZE,
          chunkOverlap: options.chunkOverlap || PROCESSING_CONFIG.DEFAULT_CHUNK_OVERLAP
        },
        errors,
        error: errorMessage
      }
    }
  }

  /**
   * Validate PDF file
   */
  static validatePDFFile(file: File): { valid: boolean; error?: string } {
    try {
      // Check file type
      if (file.type !== 'application/pdf') {
        return {
          valid: false,
          error: 'Invalid file type. Please upload a PDF file.'
        }
      }

      // Check file size (limit to 10MB)
      const maxSize = PROCESSING_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024
      if (file.size > maxSize) {
        return {
          valid: false,
          error: `File size too large. Maximum allowed size is ${PROCESSING_CONFIG.MAX_FILE_SIZE_MB}MB.`
        }
      }

      // Check if file is empty
      if (file.size === 0) {
        return {
          valid: false,
          error: 'File is empty.'
        }
      }

      return { valid: true }
      
    } catch (error) {
      return {
        valid: false,
        error: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get processing configuration for different document sizes
   */
  static getOptimalProcessingConfig(textLength: number) {
    if (textLength < PROCESSING_CONFIG.SMALL_DOC_THRESHOLD) {
      return {
        chunkSize: PROCESSING_CONFIG.SMALL_DOC_CHUNK_SIZE,
        chunkOverlap: PROCESSING_CONFIG.SMALL_DOC_CHUNK_OVERLAP,
        batchSize: PROCESSING_CONFIG.STANDARD_BATCH_SIZE
      }
    } else if (textLength < PROCESSING_CONFIG.MEDIUM_DOC_THRESHOLD) {
      return {
        chunkSize: PROCESSING_CONFIG.MEDIUM_DOC_CHUNK_SIZE,
        chunkOverlap: PROCESSING_CONFIG.MEDIUM_DOC_CHUNK_OVERLAP,
        batchSize: PROCESSING_CONFIG.MEDIUM_BATCH_SIZE
      }
    } else {
      return {
        chunkSize: PROCESSING_CONFIG.LARGE_DOC_CHUNK_SIZE,
        chunkOverlap: PROCESSING_CONFIG.LARGE_DOC_CHUNK_OVERLAP,
        batchSize: PROCESSING_CONFIG.LARGE_BATCH_SIZE
      }
    }
  }
}
