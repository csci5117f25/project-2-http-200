import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

export interface SearchResult {
  answer: string
  professors: Array<{
    name: string
    affiliation: string
    relevance: number
    reason: string
    homepage?: string
    scholarid?: string
  }>
  schools: Array<{
    name: string
    relevance: number
    reason: string
  }>
  sopReferences: Array<{
    title: string
    excerpt: string
    relevance: number
    field?: string
    institution?: string
  }>
}

export async function searchWithAI(
  userQuery: string,
  professors: Array<{ name: string; affiliation: string; homepage: string; scholarid: string }>,
  sopData: Array<{ name: string; field: string; institution: string; content: string }>,
  userSOP?: string
): Promise<SearchResult> {
  
  // Limit context size to avoid token limits (but allow up to 200 for retry scenarios)
  const professorsContext = professors
    .slice(0, Math.min(200, professors.length))
    .map(p => `- ${p.name} at ${p.affiliation}${p.homepage ? ` (${p.homepage})` : ''}`)
    .join('\n')
  
  const sopContext = sopData
    .slice(0, Math.min(50, sopData.length))
    .map(s => {
      const excerpt = s.content.length > 300 ? s.content.substring(0, 300) + '...' : s.content
      return `- ${s.name} (Field: ${s.field}, Institution: ${s.institution}):\n  ${excerpt}`
    })
    .join('\n\n')
  
  const userSOPContext = userSOP 
    ? `\n\nUser's Current SOP Content:\n${userSOP.substring(0, 1500)}${userSOP.length > 1500 ? '...' : ''}`
    : ''
  
  const systemPrompt = `You are a helpful PhD application assistant. Your task is to:
1. Understand the user's query about PhD applications, professors, programs, or SOP writing
2. Match relevant professors and schools from the provided database
3. Find relevant SOP examples that match the user's interests or field
4. Provide personalized, helpful recommendations

CRITICAL GROUNDING RULES (MUST FOLLOW):
- You MUST ONLY use professors, schools, and SOPs that are explicitly provided in the database below
- DO NOT invent, create, or fabricate any professor names, school names, or information
- DO NOT use information from your training data that is not in the provided database
- If the database does not contain a specific professor/school the user asks about, you MUST state clearly: "The database does not currently contain information about [name]. You can add this professor or school to your database by going to the Dashboard page and creating a new application entry."
- If no relevant matches are found, be honest: "I couldn't find exact matches in the database, but here are some related options:" and only list items from the provided database
- NEVER say "I don't have direct information" and then make up suggestions - instead, clearly state what IS available in the database

Return your response in valid JSON format with this exact structure:
{
  "answer": "A natural, conversational response to the user's query (2-3 sentences). If the requested item is not in the database, clearly state this and suggest adding it via the Dashboard.",
  "professors": [
    {
      "name": "Professor Name (MUST be from provided database)",
      "affiliation": "University Name (MUST be from provided database)",
      "relevance": 0.95,
      "reason": "Brief explanation why this professor matches (1 sentence)"
    }
  ],
  "schools": [
    {
      "name": "School/Program Name (MUST be from provided database)",
      "relevance": 0.90,
      "reason": "Brief explanation why this school matches (1 sentence)"
    }
  ],
  "sopReferences": [
    {
      "title": "SOP Title or Name (MUST be from provided database)",
      "excerpt": "Relevant excerpt from the SOP (2-3 sentences)",
      "relevance": 0.85,
      "field": "Field name if available",
      "institution": "Institution name if available"
    }
  ]
}

Important:
- Only include professors/schools/SOPs that are actually relevant (relevance > 0.7) AND exist in the provided database
- Limit to top 5 professors, top 3 schools, and top 3 SOP references
- Be specific and helpful in your recommendations
- If the user asks about someone/something not in the database, acknowledge this clearly and guide them to add it`

  const userPrompt = `User Query: "${userQuery}"

Available Professors Database (${professors.length} total, showing top ${Math.min(professors.length, 200)} matches):
${professorsContext}

Available SOP Examples Database (${sopData.length} total, showing top ${Math.min(sopData.length, 50)} matches):
${sopContext}
${userSOPContext}

CRITICAL: You MUST ONLY return professors, schools, and SOPs that appear in the lists above. Do NOT invent or create any entries that are not explicitly provided. If the user asks about someone/something not in these lists, clearly state that it's not in the database and suggest they add it via the Dashboard.

Please analyze the user's query and provide relevant matches with relevance scores (0-1). Focus on quality over quantity.`
  
  try {
    const completion = await openai.chat.completions.create({
      model: import.meta.env.VITE_OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    })
    
    const responseText = completion.choices[0]?.message?.content || '{}'
    const response = JSON.parse(responseText) as SearchResult
    
    // Ensure arrays exist
    if (!response.professors) response.professors = []
    if (!response.schools) response.schools = []
    if (!response.sopReferences) response.sopReferences = []
    if (!response.answer) response.answer = "I found some relevant results for your query."
    
    return response
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    
    // Provide fallback response
    return {
      answer: "I encountered an error processing your query. Please make sure you have configured your OpenAI API key and try again.",
      professors: [],
      schools: [],
      sopReferences: []
    }
  }
}

