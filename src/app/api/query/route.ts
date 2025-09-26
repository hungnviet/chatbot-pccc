import { NextRequest, NextResponse } from 'next/server'
import { PdfProcessingService } from '@/services/pdfProcessingService'
import { EXTERNAL_API } from '@/services/constants'
import { externalApiClient } from '@/services'
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

    const sessionId = body.sessionId || ''
    if (!sessionId && !EXTERNAL_API.ENABLED) {
      const response: ChatResponse = {
        response: "Vui lòng tải lên tệp PDF PCCC trước khi đặt câu hỏi. Sử dụng nút tải lên để bắt đầu.",
        error: "No session ID provided",
        requires_upload: true
      }
      return NextResponse.json(response)
    }

    // If external API is enabled, proxy the chat and return
    if (EXTERNAL_API.ENABLED) {
      try {
        const external = await externalApiClient.chat(body.question)
        const response: ChatResponse = {
          response: external.answer,
          sources: external.sources,
          suggestions: external.suggestions,
          notice: external.notice,
          sessionId
        }
        return NextResponse.json(response)
      } catch (error) {
        console.error('External chat error:', error)
        const response: ChatResponse = {
          response: 'Xin lỗi, tôi không thể liên hệ dịch vụ bên ngoài lúc này.',
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId
        }
        return NextResponse.json(response, { status: 502 })
      }
    }

    // Check if PDF is uploaded for this session (local processing path)
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
    const result = await PdfProcessingService.queryPDF(body.question, sessionId)
    
    if (!result.success) {
      const response: ChatResponse = {
        response: result.error || 'Query processing failed',
        error: result.error,
        sessionId
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    const response: ChatResponse = {
      response: result.answer || 'No answer generated',
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
