import profData from '../data/professors.json'

export interface Professor {
  name: string
  affiliation: string
  homepage: string
  scholarid: string
}

export const professors: Professor[] = profData

const allSchools = () => {
  const schools = new Set<string>()
  professors.forEach(p => {
    if (p.affiliation) schools.add(p.affiliation)
  })
  return Array.from(schools).sort()
}

const profsBySchool = (school: string) => {
  return professors.filter(p => p.affiliation === school)
}

export const searchSchools = (query: string) => {
  if (!query) return []
  const q = query.toLowerCase()
  return allSchools().filter(s => s.toLowerCase().includes(q)).slice(0, 8)
}

export const searchProfs = (school: string, query: string) => {
  if (!school) return []
  const profs = profsBySchool(school)
  if (!query) return profs.slice(0, 8)
  
  const q = query.toLowerCase()
  return profs.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8)
}
