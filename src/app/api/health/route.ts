import { NextResponse } from 'next/server'
import { PdfProcessingService } from '@/services/pdfProcessingService'
import { HealthResponse } from '@/types'

export async function GET(request: Request) {
  try {
    // Get sessionId from query params
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    
    if (sessionId) {
      // Get detailed session status including vector database information
      const status = PdfProcessingService.getSessionStatus(sessionId)
      const response: HealthResponse & {
        vector_store_status?: string
        documents_count?: number
        last_accessed?: Date | null
        processing_errors?: string[]
      } = {
        status: "healthy",
        agent_available: status.session_exists,
        vectorstore_available: status.vectorstore_available,
        pdf_uploaded: status.pdf_uploaded,
        current_pdf: status.current_pdf || undefined,
        sessionId: sessionId,
        vector_store_status: status.vector_store_status,
        documents_count: status.documents_count,
        last_accessed: status.last_accessed,
        processing_errors: status.processing_errors?.map(err => 
          typeof err === 'string' ? err : err.message
        )
      }
      return NextResponse.json(response)
    } else {
      // Return general status without session
      const response: HealthResponse = {
        status: "healthy",
        agent_available: true,
        vectorstore_available: false,
        pdf_uploaded: false
      }
      return NextResponse.json(response)
    }
  } catch (error) {
    console.error('Health check error:', error)
    
    const response: HealthResponse = {
      status: "error",
      agent_available: false,
      vectorstore_available: false,
      pdf_uploaded: false,
      error: error instanceof Error ? error.message : "Health check failed"
    }

    return NextResponse.json(response, { status: 500 })
  }
}
