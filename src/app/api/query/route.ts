import { NextRequest, NextResponse } from 'next/server'
import { PdfProcessingService } from '@/services/pdfProcessingService'
import { ChatResponse, QueryRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: QueryRequest = await request.json()
    
    if (!body.question || typeof body.question !== 'string') {
      const response: ChatResponse = {
        response: "Please provide a valid question.",
        error: "Invalid question format",
        sessionId: body.sessionId
      }
      return NextResponse.json(response, { status: 400 })
    }

    const sessionId = body.sessionId
    if (!sessionId) {
      const response: ChatResponse = {
        response: "Vui lòng tải lên tệp PDF PCCC trước khi đặt câu hỏi. Sử dụng nút tải lên để bắt đầu.",
        error: "No session ID provided",
        requires_upload: true
      }
      return NextResponse.json(response)
    }

    // Check if PDF is uploaded for this session
    const status = PdfProcessingService.getSessionStatus(sessionId)
    if (!status.pdf_uploaded) {
      const response: ChatResponse = {
        response: "Vui lòng tải lên tệp PDF PCCC trước khi đặt câu hỏi. Sử dụng nút tải lên để bắt đầu.",
        error: "No PDF uploaded for this session",
        requires_upload: true,
        sessionId: sessionId
      }
      return NextResponse.json(response)
    }

    // Process the query with session
    const responseText = await PdfProcessingService.processQuery(body.question, sessionId)
    
    const response: ChatResponse = {
      response: responseText,
      sessionId: sessionId
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Query processing error:', error)
    
    const response: ChatResponse = {
      response: "Xin lỗi, tôi gặp khó khăn kỹ thuật. Điều này có thể do giới hạn hạn ngạch API.",
      error: error instanceof Error ? error.message : "Unknown error"
    }

    return NextResponse.json(response, { status: 500 })
  }
}
