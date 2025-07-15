import { v4 as uuidv4 } from 'uuid'
import { UserSession } from '@/types'
import { PROCESSING_CONFIG } from '../constants'

// Global sessions storage
const userSessions: Map<string, UserSession> = new Map()

export class SessionService {
  /**
   * Create a new session
   */
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

  /**
   * Get session by ID
   */
  static getSession(sessionId: string): UserSession | null {
    try {
      if (!sessionId?.trim()) {
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

  /**
   * Update session with new data
   */
  static updateSession(sessionId: string, updates: Partial<UserSession>): boolean {
    try {
      const session = this.getSession(sessionId)
      if (!session) {
        return false
      }

      Object.assign(session, updates)
      session.lastAccessed = new Date()
      
      console.log(`Updated session: ${sessionId}`)
      return true
      
    } catch (error) {
      console.error('Error updating session:', error)
      return false
    }
  }

  /**
   * Reset session data
   */
  static async resetSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.getSession(sessionId)
      if (!session) {
        return false
      }

      session.vectorstore = null
      session.documents = []
      session.pdfName = null
      session.vectorStoreStatus = 'not_created'
      session.processingErrors = []
      session.lastAccessed = new Date()
      
      console.log(`Reset session: ${sessionId}`)
      return true
      
    } catch (error) {
      console.error('Error resetting session:', error)
      return false
    }
  }

  /**
   * Delete session
   */
  static deleteSession(sessionId: string): boolean {
    try {
      const deleted = userSessions.delete(sessionId)
      if (deleted) {
        console.log(`Deleted session: ${sessionId}`)
      }
      return deleted
      
    } catch (error) {
      console.error('Error deleting session:', error)
      return false
    }
  }

  /**
   * Get session status information
   */
  static getSessionStatus(sessionId: string) {
    const session = this.getSession(sessionId)
    if (!session) {
      return {
        session_exists: false,
        vectorstore_available: false,
        pdf_uploaded: false,
        current_pdf: null
      }
    }

    return {
      session_exists: true,
      vectorstore_available: session.vectorstore !== null,
      pdf_uploaded: session.pdfName !== null,
      current_pdf: session.pdfName
    }
  }

  /**
   * Get detailed session status
   */
  static getDetailedSessionStatus(sessionId: string) {
    const session = this.getSession(sessionId)
    if (!session) {
      return {
        session_exists: false,
        vectorstore_available: false,
        pdf_uploaded: false,
        current_pdf: null,
        vector_store_status: 'not_created',
        documents_count: 0,
        last_accessed: null,
        processing_errors: []
      }
    }

    return {
      session_exists: true,
      vectorstore_available: session.vectorstore !== null,
      pdf_uploaded: session.pdfName !== null,
      current_pdf: session.pdfName,
      vector_store_status: session.vectorStoreStatus || 'unknown',
      documents_count: session.documents?.length || 0,
      last_accessed: session.lastAccessed,
      processing_errors: session.processingErrors || []
    }
  }

  /**
   * Clean up old sessions
   */
  static cleanup(): number {
    const now = new Date()
    let cleanedCount = 0
    
    for (const [sessionId, session] of userSessions.entries()) {
      const hoursSinceLastAccess = (now.getTime() - session.lastAccessed.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceLastAccess > PROCESSING_CONFIG.SESSION_CLEANUP_HOURS) {
        userSessions.delete(sessionId)
        cleanedCount++
        console.log(`Cleaned up old session: ${sessionId}`)
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old sessions`)
    }
    
    return cleanedCount
  }

  /**
   * Get total number of active sessions
   */
  static getActiveSessionCount(): number {
    return userSessions.size
  }

  /**
   * Get all session IDs (for debugging)
   */
  static getAllSessionIds(): string[] {
    return Array.from(userSessions.keys())
  }
}
