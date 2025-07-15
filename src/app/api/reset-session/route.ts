import { NextRequest, NextResponse } from 'next/server'
import { PdfProcessingService } from '@/services/pdfProcessingService'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Reset the session
    await PdfProcessingService.resetSession(sessionId)

    return NextResponse.json({ 
      success: true, 
      message: 'Session reset successfully' 
    })

  } catch (error) {
    console.error('Error resetting session:', error)
    return NextResponse.json(
      { error: 'Failed to reset session' },
      { status: 500 }
    )
  }
}
