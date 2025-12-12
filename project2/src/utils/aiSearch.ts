import { professors } from './data'

// Re-export Professor type for consistency
export type { Professor } from './data'

export interface Professor {
  name: string
  affiliation: string
  homepage: string
  scholarid: string
}

export interface SOPData {
  name: string
  field: string
  institution: string
  content: string
  year?: string
  statementLink?: string
  website?: string
}

// Cache for SOP data
let sopCache: SOPData[] | null = null

// Check if SOP has Overleaf URL
const hasOverleafUrl = (sop: SOPData): boolean => {
  const statementLink = sop.statementLink?.toLowerCase() || ''
  const content = sop.content?.toLowerCase() || ''
  return statementLink.includes('overleaf.com') || content.includes('overleaf.com')
}

// Filter out SOPs with Overleaf URLs
const filterOutOverleafSOPs = (sops: SOPData[]): SOPData[] => {
  return sops.filter(sop => !hasOverleafUrl(sop))
}

// Load SOP data from CSV and markdown files
export async function loadSOPData(): Promise<SOPData[]> {
  if (sopCache) return sopCache
  
  try {
    // Load SOP CSV data - CSV file should be in public folder for fetch
    // Try multiple possible paths
    let csvText = ''
    const csvPaths = [
      '/Data/SOP_Data 2aa177600a3481b5ba67d20774c7d07d_all.csv',
      '/Data/SOP_Data%202aa177600a3481b5ba67d20774c7d07d_all.csv'
    ]
    
    for (const path of csvPaths) {
      try {
        const csvResponse = await fetch(path)
        if (csvResponse.ok) {
          csvText = await csvResponse.text()
          break
        }
      } catch (e) {
        // Try next path
        continue
      }
    }
    
    if (!csvText) {
      console.warn('Could not load SOP CSV file from public folder. Please ensure the CSV file is in project2/public/Data/')
      // Return empty array but don't fail completely
      return []
    }
    
    const csvLines = csvText.split('\n').slice(1) // Skip header
    const sopData: SOPData[] = []
    
    // Parse CSV
    for (const line of csvLines) {
      if (!line.trim()) continue
      
      // Simple CSV parsing (handles quoted fields)
      const fields = parseCSVLine(line)
      if (fields.length < 6) continue
      
      const name = fields[0]?.trim()
      const field = fields[4]?.trim() || ''
      const institution = fields[5]?.trim() || ''
      const statementLink = fields[7]?.trim() || ''
      const website = fields[8]?.trim() || ''
      
      if (name && name !== 'Name') {
        // Try to load corresponding markdown file
        let content = ''
        try {
          // Use dynamic import for markdown files
          const mdFiles = import.meta.glob('../../Data/SOP_Data/*.md', { 
            eager: false,
            query: '?raw'
          })
          
          // Find matching file by name
          const firstName = name.split(' ')[0]
          for (const [path, importFn] of Object.entries(mdFiles)) {
            if (path.includes(firstName) || path.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
              try {
                const mdContent = await importFn() as any
                content = mdContent.default || mdContent || ''
                if (content) break
              } catch (e) {
                // Continue to next file
              }
            }
          }
        } catch (e) {
          // If markdown not found, use basic info
        }
        
        // Fallback content
        if (!content) {
          content = `Name: ${name}\nField: ${field}\nInstitution: ${institution}`
          if (statementLink) content += `\nStatement: ${statementLink}`
          if (website) content += `\nWebsite: ${website}`
        }
        
        sopData.push({
          name,
          field,
          institution,
          content,
          statementLink,
          website
        })
      }
    }
    
    // Filter out Overleaf SOPs before caching
    const filteredData = filterOutOverleafSOPs(sopData)
    sopCache = filteredData
    console.log(`Loaded ${sopData.length} SOP entries, ${filteredData.length} after filtering Overleaf URLs`)
    return filteredData
  } catch (error) {
    console.error('Failed to load SOP data:', error)
    // Return empty array if loading fails
    return []
  }
}

// Simple CSV line parser (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  
  return fields
}

// Filter professors based on query keywords
export function filterProfessors(query: string, limit: number = 50, minScore: number = 0): Professor[] {
  if (!query.trim()) return []
  
  const q = query.toLowerCase()
  const keywords = q.split(/\s+/).filter(k => k.length > 2)
  
  // Score each professor
  const scored = professors.map(prof => {
    let score = 0
    const nameLower = prof.name.toLowerCase()
    const affiliationLower = prof.affiliation.toLowerCase()
    
    // Exact match gets highest score
    if (nameLower.includes(q)) score += 10
    if (affiliationLower.includes(q)) score += 8
    
    // Partial name match (e.g., "Kaiming" matches "Kaiming He")
    const nameParts = nameLower.split(/\s+/)
    const queryParts = q.split(/\s+/)
    queryParts.forEach(qPart => {
      if (qPart.length >= 3) {
        nameParts.forEach(namePart => {
          if (namePart.includes(qPart) || qPart.includes(namePart)) {
            score += 5
          }
        })
      }
    })
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (nameLower.includes(keyword)) score += 3
      if (affiliationLower.includes(keyword)) score += 2
    })
    
    // Single character match for initials (e.g., "K H" matches "Kaiming He")
    if (keywords.length === 0 && q.length <= 3) {
      const initials = nameParts.map(p => p[0]).join('')
      if (initials.toLowerCase().includes(q.replace(/\s+/g, ''))) {
        score += 4
      }
    }
    
    return { prof, score }
  })
  
  // Sort by score and return top results
  return scored
    .filter(item => item.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.prof)
}

// Filter SOPs based on query keywords
export function filterSOPs(query: string, sopData: SOPData[], limit: number = 20): SOPData[] {
  if (!query.trim() || sopData.length === 0) return []
  
  // Filter out Overleaf SOPs first
  const filteredData = filterOutOverleafSOPs(sopData)
  if (filteredData.length === 0) return []
  
  const q = query.toLowerCase()
  const keywords = q.split(/\s+/).filter(k => k.length > 2)
  
  // Score each SOP
  const scored = filteredData.map(sop => {
    let score = 0
    const nameLower = sop.name.toLowerCase()
    const fieldLower = sop.field.toLowerCase()
    const institutionLower = sop.institution.toLowerCase()
    const contentLower = sop.content.toLowerCase()
    
    // Field match gets high score
    if (fieldLower.includes(q)) score += 10
    if (institutionLower.includes(q)) score += 8
    if (nameLower.includes(q)) score += 5
    
    // Content match
    if (contentLower.includes(q)) score += 3
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (fieldLower.includes(keyword)) score += 3
      if (institutionLower.includes(keyword)) score += 2
      if (contentLower.includes(keyword)) score += 1
    })
    
    return { sop, score }
  })
  
  // Sort by score and return top results
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sop)
}

// Get unique schools from professors
export function getUniqueSchools(professors: Professor[]): string[] {
  const schools = new Set<string>()
  professors.forEach(p => {
    if (p.affiliation) schools.add(p.affiliation)
  })
  return Array.from(schools).sort()
}

// Acronym and alias expansion mapping
const acronymExpansions: Record<string, string[]> = {
  // Common university abbreviations
  'umn': ['University of Minnesota', 'U of M', 'U Minnesota', 'Minnesota'],
  'mit': ['Massachusetts Institute of Technology', 'MIT'],
  'stanford': ['Stanford University', 'Stanford'],
  'berkeley': ['UC Berkeley', 'University of California Berkeley', 'UCB', 'Berkeley'],
  'ucla': ['University of California Los Angeles', 'UCLA'],
  'ucsd': ['University of California San Diego', 'UCSD'],
  'ucsb': ['University of California Santa Barbara', 'UCSB'],
  'cmu': ['Carnegie Mellon University', 'Carnegie Mellon', 'CMU'],
  'caltech': ['California Institute of Technology', 'Caltech', 'CIT'],
  'gt': ['Georgia Tech', 'Georgia Institute of Technology', 'Georgia Tech'],
  'gatech': ['Georgia Tech', 'Georgia Institute of Technology', 'Georgia Tech'],
  'uiuc': ['University of Illinois Urbana Champaign', 'UIUC', 'Illinois'],
  'uw': ['University of Washington', 'UW', 'Washington'],
  'uwm': ['University of Wisconsin Madison', 'UW Madison', 'Wisconsin'],
  'umich': ['University of Michigan', 'U of M', 'Michigan', 'UM'],
  'umd': ['University of Maryland', 'UMD', 'Maryland'],
  'unc': ['University of North Carolina', 'UNC', 'North Carolina'],
  'duke': ['Duke University', 'Duke'],
  'nyu': ['New York University', 'NYU'],
  'columbia': ['Columbia University', 'Columbia'],
  'cornell': ['Cornell University', 'Cornell'],
  'princeton': ['Princeton University', 'Princeton'],
  'yale': ['Yale University', 'Yale'],
  'harvard': ['Harvard University', 'Harvard'],
  'upenn': ['University of Pennsylvania', 'UPenn', 'Penn'],
  'brown': ['Brown University', 'Brown'],
  'dartmouth': ['Dartmouth College', 'Dartmouth'],
  'rice': ['Rice University', 'Rice'],
  'vanderbilt': ['Vanderbilt University', 'Vanderbilt'],
  'northwestern': ['Northwestern University', 'Northwestern'],
  'usc': ['University of Southern California', 'USC', 'Southern California'],
  'ut': ['University of Texas', 'UT', 'Texas'],
  'utaustin': ['University of Texas Austin', 'UT Austin', 'Texas'],
  'utexas': ['University of Texas Austin', 'UT Austin', 'Texas'],
  'purdue': ['Purdue University', 'Purdue'],
  'pennstate': ['Penn State', 'Pennsylvania State University', 'Penn State'],
  'osu': ['Ohio State University', 'OSU', 'Ohio State'],
  'asu': ['Arizona State University', 'ASU', 'Arizona State'],
  'vt': ['Virginia Tech', 'Virginia Polytechnic Institute', 'Virginia Tech'],
  'vtech': ['Virginia Tech', 'Virginia Polytechnic Institute', 'Virginia Tech'],
  'ncsu': ['North Carolina State University', 'NC State', 'NCSU'],
  'rutgers': ['Rutgers University', 'Rutgers'],
  'tamu': ['Texas A&M University', 'Texas A&M', 'TAMU'],
  'gatech': ['Georgia Institute of Technology', 'Georgia Tech', 'GT'],
  'rit': ['Rochester Institute of Technology', 'RIT'],
}

// Expand acronyms and aliases in query
export function expandAcronymsAndAliases(query: string): string[] {
  const expansions = new Set<string>()
  const qLower = query.toLowerCase().trim()
  
  // Add original query
  expansions.add(query)
  
  // Check for exact acronym match
  if (acronymExpansions[qLower]) {
    acronymExpansions[qLower].forEach(expansion => {
      expansions.add(expansion)
      expansions.add(expansion.toLowerCase())
    })
  }
  
  // Check for acronym as whole word in query (e.g., "UMN professor" -> expand "UMN")
  Object.entries(acronymExpansions).forEach(([acronym, variants]) => {
    // Match whole word only (not substring)
    const acronymRegex = new RegExp(`\\b${acronym}\\b`, 'i')
    if (acronymRegex.test(query)) {
      variants.forEach(variant => {
        expansions.add(variant)
        expansions.add(variant.toLowerCase())
        // Also add query with acronym replaced
        const replaced = query.replace(acronymRegex, variant)
        expansions.add(replaced)
        expansions.add(replaced.toLowerCase())
      })
    }
  })
  
  // Check for common patterns like "U of M", "U of X", etc.
  const uOfPattern = /u\s+of\s+([a-z]+)/i
  const uOfMatch = query.match(uOfPattern)
  if (uOfMatch) {
    const school = uOfMatch[1]
    // Try to find full name
    Object.entries(acronymExpansions).forEach(([acronym, variants]) => {
      if (variants.some(v => v.toLowerCase().includes(school))) {
        variants.forEach(variant => {
          expansions.add(variant)
          expansions.add(variant.toLowerCase())
        })
      }
    })
  }
  
  // Also check reverse: if query contains full name, add acronyms
  Object.entries(acronymExpansions).forEach(([acronym, variants]) => {
    variants.forEach(variant => {
      if (query.toLowerCase().includes(variant.toLowerCase())) {
        expansions.add(acronym)
        expansions.add(acronym.toUpperCase())
      }
    })
  })
  
  return Array.from(expansions)
}

// Query preprocessing: create retrieval-optimized query with acronym expansion
export function preprocessQuery(query: string): { raw: string; retrieval: string; expanded: string[] } {
  const raw = query.trim()
  
  // Expand acronyms and aliases
  const expandedQueries = expandAcronymsAndAliases(raw)
  
  // Create retrieval query: lowercase, remove punctuation, remove stopwords, normalize spaces
  let retrieval = raw.toLowerCase()
  
  // Remove common stopwords and template phrases
  const stopwords = [
    'give me', 'all information', 'tell me', 'about', 'please', 'can you',
    'i want', 'i need', 'show me', 'find', 'search for', 'what is', 'who is',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been'
  ]
  
  stopwords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    retrieval = retrieval.replace(regex, ' ')
  })
  
  // Remove punctuation except spaces
  retrieval = retrieval.replace(/[^\w\s]/g, ' ')
  
  // Normalize spaces
  retrieval = retrieval.replace(/\s+/g, ' ').trim()
  
  // Process expanded queries similarly
  const expandedRetrieval = expandedQueries.map(q => {
    let processed = q.toLowerCase()
    stopwords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      processed = processed.replace(regex, ' ')
    })
    processed = processed.replace(/[^\w\s]/g, ' ')
    processed = processed.replace(/\s+/g, ' ').trim()
    return processed
  }).filter(q => q.length > 0)
  
  return { raw, retrieval, expanded: expandedRetrieval }
}

// Extract name candidate from query
export function extractNameCandidate(query: string): string | null {
  // Pattern 1: 2-4 consecutive capitalized words (e.g., "Kaiming He", "Ariel D. Procaccia")
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)*(?:\s+[A-Z][a-z]+)+)\b/
  const match1 = query.match(capitalizedPattern)
  if (match1) {
    const name = match1[1].trim()
    // Check if it's 2-4 words
    const words = name.split(/\s+/)
    if (words.length >= 2 && words.length <= 4) {
      return name
    }
  }
  
  // Pattern 2: Text before comma or parenthesis
  const commaPattern = /^([^,]+),/
  const parenPattern = /^([^(]+)\(/
  const match2 = query.match(commaPattern) || query.match(parenPattern)
  if (match2) {
    const candidate = match2[1].trim()
    // Check if it looks like a name (2-4 words, starts with capital)
    const words = candidate.split(/\s+/)
    if (words.length >= 2 && words.length <= 4 && /^[A-Z]/.test(candidate)) {
      return candidate
    }
  }
  
  return null
}

// Multi-path recall: combine results from multiple filter strategies
export function multiPathRecallProfessors(
  rawQuery: string,
  retrievalQuery: string,
  nameCandidate: string | null,
  limit: number = 50,
  isRetry: boolean = false,
  expandedQueries: string[] = []
): Professor[] {
  const results = new Map<string, Professor>()
  const minScore = isRetry ? -1 : 0 // Lower threshold on retry
  
  // Path A: filter with raw query
  const resultsA = filterProfessors(rawQuery, limit, minScore)
  resultsA.forEach(prof => {
    const key = `${prof.name}|${prof.affiliation}`
    if (!results.has(key)) {
      results.set(key, prof)
    }
  })
  
  // Path B: filter with retrieval query
  const resultsB = filterProfessors(retrievalQuery, limit, minScore)
  resultsB.forEach(prof => {
    const key = `${prof.name}|${prof.affiliation}`
    if (!results.has(key)) {
      results.set(key, prof)
    }
  })
  
  // Path B2: filter with expanded queries (acronym/alias expansion)
  expandedQueries.forEach(expandedQuery => {
    if (expandedQuery && expandedQuery !== retrievalQuery) {
      const resultsB2 = filterProfessors(expandedQuery, limit, minScore)
      resultsB2.forEach(prof => {
        const key = `${prof.name}|${prof.affiliation}`
        if (!results.has(key)) {
          results.set(key, prof)
        }
      })
    }
  })
  
  // Path C: filter with name candidate (if exists)
  if (nameCandidate) {
    const resultsC = filterProfessors(nameCandidate, limit, minScore)
    resultsC.forEach(prof => {
      const key = `${prof.name}|${prof.affiliation}`
      if (!results.has(key)) {
        results.set(key, prof)
      }
    })
  }
  
  // Path D: filter with name candidate lowercase (additional safety)
  if (nameCandidate) {
    const resultsD = filterProfessors(nameCandidate.toLowerCase(), limit, minScore)
    resultsD.forEach(prof => {
      const key = `${prof.name}|${prof.affiliation}`
      if (!results.has(key)) {
        results.set(key, prof)
      }
    })
  }
  
  // Path E: filter individual words from name candidate (for retry)
  if (isRetry && nameCandidate) {
    const nameWords = nameCandidate.split(/\s+/).filter(w => w.length >= 3)
    nameWords.forEach(word => {
      const resultsE = filterProfessors(word, Math.floor(limit / 2), minScore)
      resultsE.forEach(prof => {
        const key = `${prof.name}|${prof.affiliation}`
        if (!results.has(key)) {
          results.set(key, prof)
        }
      })
    })
  }
  
  return Array.from(results.values()).slice(0, limit)
}

// Multi-path recall for SOPs
export function multiPathRecallSOPs(
  rawQuery: string,
  retrievalQuery: string,
  sopData: SOPData[],
  limit: number = 20,
  expandedQueries: string[] = []
): SOPData[] {
  // Filter out Overleaf SOPs first
  const filteredData = filterOutOverleafSOPs(sopData)
  if (filteredData.length === 0) return []
  
  const results = new Map<string, SOPData>()
  
  // Path A: filter with raw query
  const resultsA = filterSOPs(rawQuery, filteredData, limit)
  resultsA.forEach(sop => {
    const key = `${sop.name}|${sop.field}|${sop.institution}`
    if (!results.has(key)) {
      results.set(key, sop)
    }
  })
  
  // Path B: filter with retrieval query
  const resultsB = filterSOPs(retrievalQuery, filteredData, limit)
  resultsB.forEach(sop => {
    const key = `${sop.name}|${sop.field}|${sop.institution}`
    if (!results.has(key)) {
      results.set(key, sop)
    }
  })
  
  // Path B2: filter with expanded queries (acronym/alias expansion)
  expandedQueries.forEach(expandedQuery => {
    if (expandedQuery && expandedQuery !== retrievalQuery) {
      const resultsB2 = filterSOPs(expandedQuery, filteredData, limit)
      resultsB2.forEach(sop => {
        const key = `${sop.name}|${sop.field}|${sop.institution}`
        if (!results.has(key)) {
          results.set(key, sop)
        }
      })
    }
  })
  
  return Array.from(results.values()).slice(0, limit)
}

// Check if query likely contains a person name
export function hasPersonName(query: string): boolean {
  const nameCandidate = extractNameCandidate(query)
  if (nameCandidate) return true
  
  // Additional check: pattern of capitalized words
  const words = query.split(/\s+/)
  let capitalizedCount = 0
  for (const word of words) {
    if (/^[A-Z][a-z]+$/.test(word)) {
      capitalizedCount++
      if (capitalizedCount >= 2) return true
    } else {
      capitalizedCount = 0
    }
  }
  
  return false
}

