import { NextResponse } from 'next/server'
import { OpenAIEmbeddings } from '@langchain/openai'

export async function GET() {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured' 
      }, { status: 500 })
    }

    console.log('Testing OpenAI API connection...')
    
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: OPENAI_API_KEY,
      batchSize: 1,
      maxRetries: 1,
    })

    const startTime = Date.now()
    
    // Test with a simple query
    const testResult = await embeddings.embedQuery("test query")
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      status: 'success',
      message: 'OpenAI API is working correctly',
      duration_ms: duration,
      embedding_length: testResult.length,
      api_key_configured: true
    })

  } catch (error) {
    console.error('OpenAI API test failed:', error)
    
    let errorMessage = 'Unknown error'
    let errorType = 'unknown'
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorType = 'quota_exceeded'
      } else if (error.message.includes('authentication') || error.message.includes('Unauthorized')) {
        errorType = 'auth_failed'
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorType = 'network_error'
      }
    }
    
    return NextResponse.json({
      status: 'error',
      error: errorMessage,
      error_type: errorType,
      api_key_configured: !!process.env.OPENAI_API_KEY
    }, { status: 500 })
  }
}
