// Color tag generator for schools and subfields
// Ensures unique colors within each category (schools or subfields)

const colorPalette = [
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' }, // Light brown
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' }, // Light blue
  { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }, // Light gray
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' }, // Light purple
  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' }, // Golden yellow
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' }, // Deeper purple
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' }, // Reddish brown
  { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' }, // Light grey
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' }, // Orange
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' }, // Light green
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' }, // Cyan
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' }, // Pink
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' }, // Teal
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' }, // Emerald
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' }, // Violet
  { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' }, // Lime
  { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' }, // Red
  { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200' }, // Sky blue
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-200' }, // Fuchsia
  { bg: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-200' }, // Stone
]

// Cache for color assignments per category
const colorAssignments = new Map<string, Map<string, number>>()

// Simple hash function to convert string to number
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Assign unique colors to a list of strings within a category
function assignUniqueColors(category: string, items: string[]): Map<string, number> {
  // Check if we already have assignments for this category
  if (!colorAssignments.has(category)) {
    colorAssignments.set(category, new Map())
  }

  const categoryMap = colorAssignments.get(category)!
  const usedIndices = new Set<number>()

  // First, preserve existing assignments for items that still exist
  const existingItems = new Set<string>()
  items.forEach(item => {
    if (categoryMap.has(item)) {
      usedIndices.add(categoryMap.get(item)!)
      existingItems.add(item)
    }
  })

  // Remove assignments for items that no longer exist
  categoryMap.forEach((_, item) => {
    if (!items.includes(item)) {
      categoryMap.delete(item)
    }
  })

  // Assign colors to new items, ensuring uniqueness within the category
  const newItems = items.filter(item => !existingItems.has(item))
  
  newItems.forEach(item => {
    // Find an unused color index
    let index = hashString(item) % colorPalette.length
    let attempts = 0
    
    // If the color is already used, find the next available one
    while (usedIndices.has(index) && attempts < colorPalette.length) {
      index = (index + 1) % colorPalette.length
      attempts++
    }
    
    // If all colors are used, we need to reuse colors, but try to minimize conflicts
    // by using the hash-based index as a starting point
    if (attempts >= colorPalette.length) {
      // All colors are used, use hash-based assignment (will have some duplicates)
      // but this should be rare if we have enough colors
      index = hashString(item) % colorPalette.length
    }
    
    categoryMap.set(item, index)
    usedIndices.add(index)
  })
  
  return categoryMap
}

// Initialize color assignments for schools and subfields
export function initializeColorAssignments(schools: string[], subfields: string[]) {
  assignUniqueColors('schools', schools)
  assignUniqueColors('subfields', subfields)
}

// Get color for a given string within a category (ensures uniqueness)
export function getColorTag(str: string, category?: 'schools' | 'subfields'): { bg: string; text: string; border: string } {
  if (category) {
    const categoryMap = colorAssignments.get(category)
    if (categoryMap && categoryMap.has(str)) {
      const index = categoryMap.get(str)!
      const color = colorPalette[index]
      if (color) return color
    }
  }
  
  // Fallback to hash-based assignment if no category or not initialized
  const hash = hashString(str)
  const index = hash % colorPalette.length
  const color = colorPalette[index]
  return color || colorPalette[0]! // Ensure a fallback color is always returned
}

// Get all color classes as a string
export function getColorClasses(str: string, category?: 'schools' | 'subfields'): string {
  const colors = getColorTag(str, category)
  return `${colors.bg} ${colors.text} ${colors.border}`
}
