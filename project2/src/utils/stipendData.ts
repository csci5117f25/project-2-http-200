/**
 * Load and parse stipend data from CSV file
 */

export interface StipendData {
  institution: string
  preQualStipend: number
  afterQualStipend: number
  livingCost: number
  fee: number
  publicPrivate: string
  labels: string
  afterFeesAndLiving: number
}

let stipendCache: StipendData[] | null = null

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let currentField = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField.trim())
      currentField = ''
    } else {
      currentField += char
    }
  }
  
  fields.push(currentField.trim())
  return fields
}

/**
 * Parse number from string, handling "Unknown" and empty values
 */
function parseNumber(value: string): number {
  const cleaned = value.trim()
  if (!cleaned || cleaned === 'Unknown' || cleaned === '') {
    return 0
  }
  const num = parseInt(cleaned.replace(/,/g, ''), 10)
  return isNaN(num) ? 0 : num
}

/**
 * Load stipend data from CSV file
 */
export async function loadStipendData(): Promise<StipendData[]> {
  if (stipendCache) return stipendCache
  
  try {
    // Load CSV file using import.meta.glob (similar to SOP data loading)
    let csvText = ''
    
    try {
      // Try to load from Data folder using import.meta.glob
      const csvFiles = import.meta.glob('../../Data/*.csv', { 
        eager: false,
        query: '?raw'
      })
      
      for (const [path, importFn] of Object.entries(csvFiles)) {
        if (path.includes('stipend-us')) {
          try {
            const csvContent = await importFn() as any
            csvText = csvContent.default || csvContent || ''
            if (csvText) break
          } catch (e) {
            continue
          }
        }
      }
    } catch (e) {
      // Fallback to fetch if import.meta.glob fails
    }
    
    // Fallback: try fetch from public folder
    if (!csvText) {
      const csvPaths = [
        '/Data/stipend-us.csv',
        '/stipend-us.csv'
      ]
      
      for (const path of csvPaths) {
        try {
          const csvResponse = await fetch(path)
          if (csvResponse.ok) {
            csvText = await csvResponse.text()
            break
          }
        } catch (e) {
          continue
        }
      }
    }
    
    if (!csvText) {
      console.warn('Could not load stipend CSV file. Please ensure the CSV file is in Data/ or public/Data/ folder')
      return []
    }
    
    const lines = csvText.split('\n').filter((line: string) => line.trim())
    
    if (lines.length < 2) {
      console.warn('Stipend CSV file is empty or invalid')
      return []
    }
    
    const stipendData: StipendData[] = []
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || !line.trim()) continue
      
      const lineStr: string = line
      const fields = parseCSVLine(lineStr)
      if (fields.length < 6) continue
      
      const institution = fields[0]?.replace(/^"|"$/g, '') || ''
      const preQualStipend = parseNumber(fields[1] || '0')
      const afterQualStipend = parseNumber(fields[2] || '0')
      const livingCost = parseNumber(fields[3] || '0')
      const fee = parseNumber(fields[4] || '0')
      const publicPrivate = fields[5]?.trim() || ''
      const labels = fields[6]?.trim() || ''
      
      // Use after_qual_stipend for calculation
      const stipend = afterQualStipend || preQualStipend
      const afterFeesAndLiving = stipend - fee - livingCost
      
      if (institution) {
        stipendData.push({
          institution,
          preQualStipend,
          afterQualStipend,
          livingCost,
          fee,
          publicPrivate,
          labels,
          afterFeesAndLiving
        })
      }
    }
    
    // Sort by afterFeesAndLiving descending
    stipendData.sort((a, b) => b.afterFeesAndLiving - a.afterFeesAndLiving)
    
    stipendCache = stipendData
    return stipendData
  } catch (error) {
    console.error('Error loading stipend data:', error)
    return []
  }
}
