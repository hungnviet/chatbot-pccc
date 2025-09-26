'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, AlertCircle, Shield, Upload, FileText, X } from 'lucide-react'
import { Message, ChatResponse, HealthResponse } from '@/types'

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Xin chào! Tôi là Trợ lý Tuân thủ An toàn Phòng cháy chữa cháy (PCCC) của bạn. Vui lòng tải lên tài liệu PDF PCCC trước, sau đó tôi có thể giúp bạn trả lời các câu hỏi về quy định an toàn phòng cháy và yêu cầu an toàn công trình.',
      sender: 'bot',
      timestamp: new Date(),
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [pdfUploaded, setPdfUploaded] = useState(false)
  const [currentPdf, setCurrentPdf] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkBackendHealth = useCallback(async () => {
    try {
      // Include session ID if available
      const url = sessionId ? `/api/health?sessionId=${sessionId}` : '/api/health'
      const response = await fetch(url)
      if (response.ok) {
        const data: HealthResponse = await response.json()
        setBackendStatus('online')
        setPdfUploaded(data.pdf_uploaded)
        setCurrentPdf(data.current_pdf || null)
      } else {
        setBackendStatus('offline')
      }
    } catch {
      setBackendStatus('offline')
    }
  }, [sessionId])

  useEffect(() => {
    // Load session ID from localStorage on component mount
    const savedSessionId = localStorage.getItem('pccc-session-id')
    if (savedSessionId) {
      setSessionId(savedSessionId)
      console.log('Loaded session ID from storage:', savedSessionId)
    }
    
    checkBackendHealth()
  }, [checkBackendHealth])

  const uploadPdf = async (file: File) => {
    setIsUploading(true)
    
    const uploadMessage: Message = {
      id: Date.now().toString(),
      content: `Đang tải lên PDF: ${file.name}`,
      sender: 'user',
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, uploadMessage])
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // Include existing session ID if available
      if (sessionId) {
        formData.append('sessionId', sessionId)
      }
      
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Store the session ID for future queries
      if (data.sessionId) {
        setSessionId(data.sessionId)
        localStorage.setItem('pccc-session-id', data.sessionId)
        console.log('Session ID stored:', data.sessionId)
      }
      
      const successMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `✅ Tải lên PDF thành công! Tệp: ${data.filename}\n\nTài liệu của bạn đã được xử lý và tôi sẵn sàng trả lời các câu hỏi về quy định an toàn phòng cháy và tuân thủ PCCC. Bạn muốn biết gì?`,
        sender: 'bot',
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, successMessage])
      setPdfUploaded(true)
      setCurrentPdf(data.filename)
      
      // Update the initial welcome message
      setMessages(prev => {
        const newMessages = [...prev]
        if (newMessages[0]?.id === '1') {
          newMessages[0] = {
            ...newMessages[0],
            content: `Xin chào! Tôi là Trợ lý Tuân thủ An toàn Phòng cháy chữa cháy của bạn. Tôi hiện đã có quyền truy cập vào tài liệu PCCC đã tải lên (${data.filename}) và có thể giúp bạn trả lời các câu hỏi về quy định an toàn phòng cháy và yêu cầu an toàn công trình.`
          }
        }
        return newMessages
      })
      
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ Không thể tải lên PDF: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
        sender: 'bot',
        timestamp: new Date(),
        isError: true,
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Vui lòng chọn tệp PDF')
        return
      }
      
      // If there's an existing session with a PDF, ask for confirmation
      if (currentPdf && sessionId) {
        const confirmed = window.confirm(
          `Bạn đã có tài liệu "${currentPdf}" đang được xử lý. Bạn có muốn thay thế bằng tài liệu mới không? Điều này sẽ kết thúc phiên hiện tại.`
        )
        
        if (!confirmed) {
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          return
        }
        
        // Reset current session before uploading new file
        setSessionId(null)
        setPdfUploaded(false)
        setCurrentPdf(null)
        localStorage.removeItem('pccc-session-id')
      }
      
      uploadPdf(file)
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || isUploading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: userMessage.content,
          sessionId: sessionId 
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`)
      }

      const data: ChatResponse = await response.json()

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: 'bot',
        timestamp: new Date(),
        isError: data.requires_upload ? true : false,
      }

      const extraMessages: Message[] = [botMessage]
      if (data.notice) {
        extraMessages.push({
          id: (Date.now() + 2).toString(),
          content: `⚠️ Lưu ý: ${data.notice}`,
          sender: 'bot',
          timestamp: new Date(),
        })
      }
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const suggestionsText = data.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
        extraMessages.push({
          id: (Date.now() + 3).toString(),
          content: `Gợi ý câu hỏi tiếp theo:\n${suggestionsText}`,
          sender: 'bot',
          timestamp: new Date(),
        })
      }
      if (Array.isArray(data.sources) && data.sources.length > 0) {
        const sourcesText = data.sources.map((src, i) => formatSourceItem(src, i)).join('\n')
        extraMessages.push({
          id: (Date.now() + 4).toString(),
          content: `Nguồn trích dẫn:\n${sourcesText}`,
          sender: 'bot',
          timestamp: new Date(),
        })
      }

      setMessages(prev => [...prev, ...extraMessages])
      
      // If upload is required, show upload prompt
      if (data.requires_upload) {
        const uploadPromptMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: "Vui lòng sử dụng nút tải lên bên dưới để tải lên tài liệu PDF PCCC của bạn trước.",
          sender: 'bot',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, uploadPromptMessage])
      }
      
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Xin lỗi, tôi gặp lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}. Vui lòng kiểm tra kết nối mạng và thử lại.`,
        sender: 'bot',
        timestamp: new Date(),
        isError: true,
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Format external response extras for display
  const formatSourceItem = (item: unknown, index: number): string => {
    try {
      if (typeof item === 'string') return `${index + 1}. ${item}`
      if (typeof item === 'object' && item !== null) {
        const anyItem = item as Record<string, unknown>
        const title = (anyItem.title || anyItem.name || anyItem.source || anyItem.filename) as string | undefined
        const page = anyItem.page as number | string | undefined
        const url = anyItem.url as string | undefined
        const snippet = (anyItem.snippet || anyItem.text || anyItem.content) as string | undefined
        const parts: string[] = []
        if (title) parts.push(String(title))
        if (page !== undefined) parts.push(`trang ${page}`)
        if (url) parts.push(String(url))
        if (!title && !page && !url && snippet) parts.push(snippet.slice(0, 160) + (snippet.length > 160 ? '…' : ''))
        if (parts.length === 0) return `${index + 1}. ${JSON.stringify(item).slice(0, 200)}${JSON.stringify(item).length > 200 ? '…' : ''}`
        return `${index + 1}. ${parts.join(' · ')}`
      }
      return `${index + 1}. ${String(item)}`
    } catch {
      return `${index + 1}. ${String(item)}`
    }
  }

  const resetSession = async () => {
    if (!sessionId) {
      console.log('No session to reset')
      return
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn kết thúc phiên làm việc hiện tại? Điều này sẽ xóa tài liệu PDF đã tải lên và bạn cần tải lên file mới để bắt đầu cuộc hội thoại mới.'
    )

    if (!confirmed) {
      return
    }

    setIsResetting(true)

    try {
      const response = await fetch('/api/reset-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        throw new Error('Failed to reset session')
      }

      // Clear local state
      setSessionId(null)
      setPdfUploaded(false)
      setCurrentPdf(null)
      setInputMessage('')

      // Clear session from localStorage
      localStorage.removeItem('pccc-session-id')

      // Reset messages to initial state
      setMessages([
        {
          id: '1',
          content: 'Xin chào! Tôi là Trợ lý Tuân thủ An toàn Phòng cháy chữa cháy (PCCC) của bạn. Vui lòng tải lên tài liệu PDF PCCC trước, sau đó tôi có thể giúp bạn trả lời các câu hỏi về quy định an toàn phòng cháy và yêu cầu an toàn công trình.',
          sender: 'bot',
          timestamp: new Date(),
        }
      ])

      // Add success message
      const successMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '✅ Phiên làm việc đã được kết thúc thành công. Bạn có thể tải lên tài liệu PDF mới để bắt đầu cuộc hội thoại mới.',
        sender: 'bot',
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, successMessage])

    } catch (error) {
      console.error('Error resetting session:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ Không thể kết thúc phiên: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
        sender: 'bot',
        timestamp: new Date(),
        isError: true,
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Trợ lý Tuân thủ An toàn Phòng cháy chữa cháy</h1>
              <p className="text-red-100 text-sm">Chuyên gia PCCC & An toàn Công trình</p>
              {currentPdf && (
                <div className="flex items-center space-x-1 mt-1">
                  <FileText className="w-3 h-3" />
                  <span className="text-xs text-red-100">Tài liệu: {currentPdf}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* PDF Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${pdfUploaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-sm">
                {pdfUploaded ? 'PDF Sẵn sàng' : 'Chưa có PDF'}
              </span>
            </div>
            {/* Backend Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                backendStatus === 'online' ? 'bg-green-400' : 
                backendStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
              }`} />
              <span className="text-sm">
                {backendStatus === 'online' ? 'Trực tuyến' : 
                 backendStatus === 'offline' ? 'Ngoại tuyến' : 'Đang kiểm tra...'}
              </span>
            </div>
            
            {/* Session Status (Debug Info) */}
            {sessionId && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-xs text-gray-600">
                  Phiên: {sessionId.substring(0, 8)}...
                </span>
              </div>
            )}
            
            {/* Reset Session Button */}
            {currentPdf && sessionId && (
              <button
                onClick={resetSession}
                disabled={isResetting || isUploading || isLoading}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                title="Kết thúc phiên và bắt đầu mới"
              >
                {isResetting ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                <span>{isResetting ? 'Đang kết thúc...' : 'Kết thúc phiên'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-3 max-w-[80%] ${
              message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.sender === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : message.isError 
                    ? 'bg-red-500 text-white'
                    : 'bg-orange-500 text-white'
              }`}>
                {message.sender === 'user' ? (
                  <User className="w-4 h-4" />
                ) : message.isError ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.isError
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-white text-gray-800 border border-gray-200'
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </div>
                <div className={`text-xs mt-2 ${
                  message.sender === 'user' 
                    ? 'text-blue-100' 
                    : message.isError 
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3 max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        {backendStatus === 'offline' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div className="text-sm">
              <strong>Backend Ngoại tuyến:</strong> Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng.
            </div>
          </div>
        )}

        {!pdfUploaded && backendStatus === 'online' && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <Upload className="w-5 h-5 text-orange-600" />
              <div>
                <h3 className="font-medium text-orange-800">Tải lên Tài liệu PCCC</h3>
                <p className="text-sm text-orange-700">Vui lòng tải lên tài liệu PDF PCCC của bạn để bắt đầu cuộc trò chuyện</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang tải lên...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Chọn Tệp PDF</span>
                </>
              )}
            </button>
          </div>
        )}
        
        <div className="flex space-x-3 items-end">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={pdfUploaded ? "Hỏi về quy định an toàn phòng cháy, tuân thủ PCCC, hoặc an toàn công trình..." : "Tải lên PDF trước để bắt đầu đặt câu hỏi..."}
              disabled={isLoading || isUploading}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          
          {/* Upload button (always visible) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || backendStatus === 'offline'}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-3 rounded-xl hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            title="Tải lên PDF"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </button>
          
          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || isUploading || backendStatus === 'offline'}
            className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-3 rounded-xl hover:from-red-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-3 text-xs text-gray-500 text-center">
          {pdfUploaded 
            ? "Hỏi các câu hỏi về quy định an toàn phòng cháy, tuân thủ PCCC, quy trình khẩn cấp và yêu cầu an toàn công trình. Sử dụng nút 'Kết thúc phiên' ở trên để tải lên tài liệu mới."
            : "Tải lên tài liệu PDF PCCC trước, sau đó hỏi các câu hỏi về quy định an toàn phòng cháy và tuân thủ."
          }
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  )
}
