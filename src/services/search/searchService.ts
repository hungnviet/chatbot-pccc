import { Document } from 'langchain/document'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { PROCESSING_CONFIG } from '../constants'
import { VectorStoreService } from '../vector/vectorStoreService'

export interface SearchOptions {
  maxResults?: number
  includeScores?: boolean
  minScore?: number
  searchType?: 'vector' | 'text' | 'hybrid'
}

export interface SearchResult {
  content: string
  score?: number
  metadata?: Record<string, unknown>
  source?: string
}

export interface CombinedSearchResult {
  success: boolean
  results: SearchResult[]
  totalFound: number
  searchType: string
  error?: string
}

export class SearchService {
  /**
   * Perform vector similarity search
   */
  static async vectorSearch(
    vectorStore: MemoryVectorStore,
    query: string,
    options: SearchOptions = {}
  ): Promise<CombinedSearchResult> {
    try {
      const {
        maxResults = PROCESSING_CONFIG.MAX_SEARCH_RESULTS,
        includeScores = true,
        minScore = 0
      } = options

      if (!query?.trim()) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          searchType: 'vector',
          error: 'Query cannot be empty'
        }
      }

      // Validate vector store
      const validation = VectorStoreService.validateVectorStore(vectorStore)
      if (!validation.isValid) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          searchType: 'vector',
          error: validation.error || 'Invalid vector store'
        }
      }

      console.log(`Performing vector search for: "${query}"`)

      let searchResults: Document[] | Array<[Document, number]>
      
      if (includeScores) {
        const result = await VectorStoreService.similaritySearchWithScore(
          vectorStore,
          query,
          maxResults * 3 // Get more results to filter by score and relevance
        )
        
        if (!result.success) {
          return {
            success: false,
            results: [],
            totalFound: 0,
            searchType: 'vector',
            error: result.error
          }
        }
        
        searchResults = result.results || []
      } else {
        const result = await VectorStoreService.similaritySearch(
          vectorStore,
          query,
          maxResults
        )
        
        if (!result.success) {
          return {
            success: false,
            results: [],
            totalFound: 0,
            searchType: 'vector',
            error: result.error
          }
        }
        
        searchResults = result.results || []
      }

      // Process results with improved filtering
      const processedResults: SearchResult[] = []
      
      for (const result of searchResults) {
        let doc: Document
        let score: number | undefined
        
        if (Array.isArray(result)) {
          [doc, score] = result
          // Apply better score filtering - only include highly relevant results
          if (minScore > 0 && score < minScore) {
            continue
          }
          // Default minimum relevance threshold
          if (score && score < 0.1) {
            continue
          }
        } else {
          doc = result
        }
        
        // Filter out very short content that might not be useful
        if (doc.pageContent.trim().length < 50) {
          continue
        }
        
        processedResults.push({
          content: doc.pageContent,
          score,
          metadata: doc.metadata,
          source: doc.metadata?.source
        })
        
        // Limit results to top matches
        if (processedResults.length >= maxResults) {
          break
        }
      }

      console.log(`Vector search found ${processedResults.length} high-quality results`)

      return {
        success: true,
        results: processedResults,
        totalFound: processedResults.length,
        searchType: 'vector'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown vector search error'
      console.error('Vector search failed:', errorMessage)
      
      return {
        success: false,
        results: [],
        totalFound: 0,
        searchType: 'vector',
        error: errorMessage
      }
    }
  }

  /**
   * Perform text-based search on documents
   */
  static async textSearch(
    documents: Document[],
    query: string,
    options: SearchOptions = {}
  ): Promise<CombinedSearchResult> {
    try {
      const {
        maxResults = PROCESSING_CONFIG.MAX_SEARCH_RESULTS
      } = options

      if (!query?.trim()) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          searchType: 'text',
          error: 'Query cannot be empty'
        }
      }

      if (!documents || documents.length === 0) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          searchType: 'text',
          error: 'No documents available for search'
        }
      }

      console.log(`Performing text search for: "${query}" in ${documents.length} documents`)

      const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
      const results: Array<{ doc: Document; score: number }> = []

      for (const doc of documents) {
        const content = doc.pageContent.toLowerCase()
        let score = 0

        // Calculate relevance score based on term matches
        for (const term of queryTerms) {
          const matches = (content.match(new RegExp(term, 'g')) || []).length
          score += matches * (term.length / 10) // Weight longer terms more
        }

        // Add phrase matching bonus
        if (content.includes(query.toLowerCase())) {
          score += queryTerms.length * 2
        }

        if (score > 0) {
          results.push({ doc, score })
        }
      }

      // Sort by score (descending) and limit results
      results.sort((a, b) => b.score - a.score)
      const limitedResults = results.slice(0, maxResults)

      const searchResults: SearchResult[] = limitedResults.map(({ doc, score }) => ({
        content: doc.pageContent,
        score,
        metadata: doc.metadata,
        source: doc.metadata?.source
      }))

      console.log(`Text search found ${searchResults.length} results`)

      return {
        success: true,
        results: searchResults,
        totalFound: searchResults.length,
        searchType: 'text'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown text search error'
      console.error('Text search failed:', errorMessage)
      
      return {
        success: false,
        results: [],
        totalFound: 0,
        searchType: 'text',
        error: errorMessage
      }
    }
  }

  /**
   * Perform hybrid search (combination of vector and text search)
   */
  static async hybridSearch(
    vectorStore: MemoryVectorStore,
    documents: Document[],
    query: string,
    options: SearchOptions = {}
  ): Promise<CombinedSearchResult> {
    try {
      const {
        maxResults = PROCESSING_CONFIG.MAX_SEARCH_RESULTS
      } = options

      console.log(`Performing hybrid search for: "${query}"`)

      // Perform both searches
      const [vectorResult, textResult] = await Promise.all([
        this.vectorSearch(vectorStore, query, { ...options, maxResults: Math.ceil(maxResults * 0.7) }),
        this.textSearch(documents, query, { ...options, maxResults: Math.ceil(maxResults * 0.5) })
      ])

      // Combine and deduplicate results
      const combinedResults = new Map<string, SearchResult>()
      
      // Add vector search results with higher weight
      if (vectorResult.success) {
        for (const result of vectorResult.results) {
          const key = this.generateResultKey(result.content)
          combinedResults.set(key, {
            ...result,
            score: (result.score || 0) * 1.2 // Boost vector search scores
          })
        }
      }

      // Add text search results (merge if duplicate)
      if (textResult.success) {
        for (const result of textResult.results) {
          const key = this.generateResultKey(result.content)
          const existing = combinedResults.get(key)
          
          if (existing) {
            // Combine scores for duplicate content
            existing.score = (existing.score || 0) + (result.score || 0) * 0.8
          } else {
            combinedResults.set(key, {
              ...result,
              score: (result.score || 0) * 0.8 // Text search scores are lower weighted
            })
          }
        }
      }

      // Sort by combined score and limit results
      const finalResults = Array.from(combinedResults.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, maxResults)

      console.log(`Hybrid search found ${finalResults.length} results`)

      return {
        success: true,
        results: finalResults,
        totalFound: finalResults.length,
        searchType: 'hybrid'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown hybrid search error'
      console.error('Hybrid search failed:', errorMessage)
      
      return {
        success: false,
        results: [],
        totalFound: 0,
        searchType: 'hybrid',
        error: errorMessage
      }
    }
  }

  /**
   * Smart search that automatically chooses the best search method
   */
  static async smartSearch(
    vectorStore: MemoryVectorStore | null,
    documents: Document[],
    query: string,
    options: SearchOptions = {}
  ): Promise<CombinedSearchResult> {
    try {
      // Determine best search strategy
      const hasVectorStore = vectorStore && VectorStoreService.validateVectorStore(vectorStore).isValid
      const hasDocuments = documents && documents.length > 0
      
      if (!hasVectorStore && !hasDocuments) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          searchType: 'none',
          error: 'No search resources available'
        }
      }

      const queryLength = query.trim().length
      const isShortQuery = queryLength < 20
      const isLongQuery = queryLength > 100

      // Choose search strategy based on query characteristics and available resources
      if (hasVectorStore && hasDocuments && !isShortQuery) {
        // Use hybrid for complex queries with both resources available
        return await this.hybridSearch(vectorStore!, documents, query, options)
      } else if (hasVectorStore && !isLongQuery) {
        // Use vector search for semantic queries
        return await this.vectorSearch(vectorStore!, query, options)
      } else if (hasDocuments) {
        // Fallback to text search
        return await this.textSearch(documents, query, options)
      } else {
        return {
          success: false,
          results: [],
          totalFound: 0,
          searchType: 'none',
          error: 'No suitable search method available'
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown smart search error'
      console.error('Smart search failed:', errorMessage)
      
      return {
        success: false,
        results: [],
        totalFound: 0,
        searchType: 'smart',
        error: errorMessage
      }
    }
  }

  /**
   * Format search results for LLM context with better structure
   */
  static formatSearchResults(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return 'No relevant information found in the uploaded document.'
    }

    // Create a well-structured context for the LLM
    const formattedResults = results
      .slice(0, 5) // Limit to top 5 most relevant results
      .map((result, index) => {
        const content = result.content.trim()
        const relevanceScore = result.score ? `(Relevance: ${result.score.toFixed(3)})` : ''
        const sourceInfo = result.source ? `[Source: ${result.source}]` : '[Source: Uploaded PDF]'
        
        return `--- Relevant Section ${index + 1} ---
${content}
${sourceInfo} ${relevanceScore}`
      })
      .join('\n\n')

    return `=== RELEVANT INFORMATION FROM DOCUMENT ===

${formattedResults}

=== END OF RELEVANT INFORMATION ===`
  }

  /**
   * Format search results for display only (shorter version)
   */
  static formatSearchResultsForDisplay(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return 'No relevant information found.'
    }

    return results
      .map((result, index) => {
        const scoreText = result.score ? ` (Score: ${result.score.toFixed(3)})` : ''
        const sourceText = result.source ? ` [Source: ${result.source}]` : ''
        
        return `${index + 1}. ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}${scoreText}${sourceText}`
      })
      .join('\n\n')
  }

  /**
   * Generate a unique key for result deduplication
   */
  private static generateResultKey(content: string): string {
    // Use first 100 characters as key for deduplication
    return content.substring(0, 100).toLowerCase().replace(/\s+/g, ' ').trim()
  }
}
