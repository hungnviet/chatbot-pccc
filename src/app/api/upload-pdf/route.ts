import { NextRequest, NextResponse } from 'next/server'
import { PdfProcessingService } from '@/services/pdfProcessingService'
import { EXTERNAL_API } from '@/services/constants'
import { externalApiClient } from '@/services'
import { UploadResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Get the form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sessionId = formData.get('sessionId') as string | null

    if (!file) {
      const response: UploadResponse = {
        message: "No file uploaded",
        filename: "",
        agent_ready: false,
        error: "No file provided",
        sessionId: sessionId || ''
      }
      return NextResponse.json(response, { status: 400 })
    }

    // Validate file type
    const supportedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.odt', '.odp']
    const fileExtension = '.' + file.name.toLowerCase().split('.').pop()
    
    if (!supportedExtensions.includes(fileExtension)) {
      const response: UploadResponse = {
        message: "Invalid file type",
        filename: file.name,
        agent_ready: false,
        error: "Only PDF, DOC, DOCX, PPT, PPTX, ODT, ODP files are allowed",
        sessionId: sessionId || ''
      }
      return NextResponse.json(response, { status: 400 })
    }

    // Validate file size (limit to 10MB)
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxFileSize) {
      const response: UploadResponse = {
        message: "File too large",
        filename: file.name,
        agent_ready: false,
        error: "File size must be less than 10MB",
        sessionId: sessionId || ''
      }
      return NextResponse.json(response, { status: 400 })
    }

    // Convert file to ArrayBuffer with error handling
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
      if (arrayBuffer.byteLength === 0) {
        throw new Error("File appears to be empty")
      }
    } catch (error) {
      console.error('Error reading file:', error)
      const response: UploadResponse = {
        message: "Failed to read file",
        filename: file.name,
        agent_ready: false,
        error: "Could not read the uploaded file. Please try again.",
        sessionId: sessionId || ''
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    console.log(`Processing document: ${file.name} (${arrayBuffer.byteLength} bytes)`) 

    // If external API is enabled, proxy the upload and short-circuit
    if (EXTERNAL_API.ENABLED) {
      try {
        // Create a File object compatible with external client
        const fileObject = new File([arrayBuffer], file.name, { type: file.type })
        const external = await externalApiClient.upload(fileObject)

        // Maintain a local session for UI flow, even though external handles processing
        const ensuredSession = sessionId || PdfProcessingService.createSession()

        const response: UploadResponse = {
          message: external.message || 'File uploaded successfully. Processing will continue in the background.',
          filename: external.filename || file.name,
          agent_ready: true,
          sessionId: ensuredSession
        }
        return NextResponse.json(response)
      } catch (error) {
        console.error('External upload error:', error)
        const response: UploadResponse = {
          message: 'External upload failed',
          filename: file.name,
          agent_ready: false,
          sessionId: sessionId || ''
        }
        return NextResponse.json(response, { status: 502 })
      }
    }

    // Initialize LLM with error handling
    try {
      await PdfProcessingService.initializeLLM()
    } catch (error) {
      console.error('LLM initialization error:', error)
      const response: UploadResponse = {
        message: "Service initialization failed",
        filename: file.name,
        agent_ready: false,
        error: error instanceof Error ? error.message : "Failed to initialize AI service",
        sessionId: sessionId || ''
      }
      return NextResponse.json(response, { status: 503 })
    }

    // Process the document from buffer with session support
    // First create a File object from arrayBuffer
    const fileObject = new File([arrayBuffer], file.name, { type: file.type })
    const result = await PdfProcessingService.processPDF(fileObject, sessionId || PdfProcessingService.createSession())

    if (result.success) {
      const response: UploadResponse = {
        message: result.error ? 
          "Document uploaded successfully with warnings" : 
          "Document uploaded and processed successfully",
        filename: file.name,
        agent_ready: true,
        sessionId: result.sessionId,
        error: result.error // Include warning messages
      }
      return NextResponse.json(response)
    } else {
      const response: UploadResponse = {
        message: "Failed to process document file",
        filename: file.name,
        agent_ready: false,
        error: result.error || "Document processing failed",
        sessionId: result.sessionId
      }
      return NextResponse.json(response, { status: 500 })
    }

  } catch (error) {
    console.error('Upload error:', error)
    
    // Determine appropriate error message and status code
    let statusCode = 500
    let errorMessage = "Upload failed"
    
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        statusCode = 429
        errorMessage = "Service temporarily unavailable due to high demand"
      } else if (error.message.includes('authentication') || error.message.includes('API key')) {
        statusCode = 503
        errorMessage = "Service configuration error"
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        statusCode = 503
        errorMessage = "Network error occurred"
      }
    }
    
    const response: UploadResponse = {
      message: errorMessage,
      filename: "",
      agent_ready: false,
      error: error instanceof Error ? error.message : "Unknown error",
      sessionId: ''
    }
    return NextResponse.json(response, { status: statusCode })
  }
}
