<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { loadStipendData, type StipendData } from '../utils/stipendData'
import Sidebar from '../components/Sidebar.vue'
import Card from '../components/ui/card.vue'
import Input from '../components/ui/input.vue'
import Select from '../components/ui/select.vue'

const allStipendData = ref<StipendData[]>([])
const loading = ref(true)
const searchQuery = ref('')
const typeFilter = ref('All')
const summerFundingFilter = ref('All')

// Load stipend data on mount
onMounted(async () => {
  try {
    loading.value = true
    allStipendData.value = await loadStipendData()
  } catch (error) {
    console.error('Failed to load stipend data:', error)
  } finally {
    loading.value = false
  }
})

// Filter and sort data
const stipendData = computed(() => {
  let filtered = [...allStipendData.value]

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(item => 
      item.institution.toLowerCase().includes(query)
    )
  }

  // Type filter
  if (typeFilter.value !== 'All') {
    filtered = filtered.filter(item => 
      item.publicPrivate.toLowerCase() === typeFilter.value.toLowerCase()
    )
  }

  // Summer funding filter
  if (summerFundingFilter.value !== 'All') {
    filtered = filtered.filter(item => {
      const labels = item.labels.toLowerCase()
      if (summerFundingFilter.value === 'Guaranteed') {
        return labels.includes('summer-gtd')
      } else if (summerFundingFilter.value === 'No Guarantee') {
        return labels.includes('summer-no-gtd')
      } else if (summerFundingFilter.value === 'Unknown') {
        return labels.includes('summer-unknown')
      }
      return true
    })
  }

  // Sort by afterFeesAndLiving descending
  return filtered.sort((a, b) => b.afterFeesAndLiving - a.afterFeesAndLiving)
})

const formatCurrency = (amount: number): string => {
  if (amount === 0) return '0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const getLabels = (labels: string): string[] => {
  if (!labels) return []
  return labels.split(' ').filter(label => label.trim())
}

// Get rank icon based on position
const getRankIcon = (index: number): string => {
  if (index === 0) return '🥇'
  if (index === 1) return '🥈'
  if (index === 2) return '🥉'
  return ''
}

// Get rank color based on position
const getRankColor = (index: number): string => {
  if (index === 0) return 'text-yellow-600'
  if (index === 1) return 'text-gray-500'
  if (index === 2) return 'text-orange-600'
  return ''
}
</script>

<template>
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-y-auto transition-all duration-300 ease-in-out">
      <div class="p-6">
        <div class="max-w-7xl mx-auto space-y-6">
          <!-- Header -->
          <div class="mb-6">
            <h1 class="text-3xl font-bold mb-2">PhD Stipend Rankings</h1>
            <p class="text-muted-foreground">Compare stipends, living costs, and net income across US PhD programs</p>
          </div>

          <!-- Filters -->
          <Card class="p-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Search Institution -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-foreground">Search Institution</label>
                <Input
                  :value="searchQuery"
                  @update:value="(val) => { searchQuery = val as string }"
                  placeholder="Search by institution..."
                  class="w-full"
                />
              </div>

              <!-- Type -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-foreground">Type</label>
                <Select
                  :value="typeFilter"
                  @update:value="(val) => { typeFilter = val as string }"
                  class="w-full"
                >
                  <option value="All">All</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </Select>
              </div>

              <!-- Summer Funding -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-foreground">Summer Funding</label>
                <Select
                  :value="summerFundingFilter"
                  @update:value="(val) => { summerFundingFilter = val as string }"
                  class="w-full"
                >
                  <option value="All">All</option>
                  <option value="Guaranteed">Guaranteed</option>
                  <option value="No Guarantee">No Guarantee</option>
                  <option value="Unknown">Unknown</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card v-if="loading" class="p-8 text-center">
            <p class="text-muted-foreground">Loading stipend data...</p>
          </Card>

          <!-- Data Table -->
          <Card v-else class="overflow-hidden p-0">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b-2 border-border bg-muted/30">
                    <th class="text-left p-4 font-semibold text-sm text-muted-foreground">#</th>
                    <th class="text-left p-4 font-semibold text-sm text-muted-foreground">Institution</th>
                    <th class="text-right p-4 font-semibold text-sm text-muted-foreground">Stipend ($)</th>
                    <th class="text-right p-4 font-semibold text-sm text-muted-foreground">Fees ($)</th>
                    <th class="text-right p-4 font-semibold text-sm text-muted-foreground">Living Cost ($)</th>
                    <th class="text-right p-4 font-semibold text-sm text-muted-foreground">After Fees & Living ($)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in stipendData"
                    :key="index"
                    class="border-b border-border/30 hover:bg-muted/10 transition-colors"
                  >
                    <!-- Rank -->
                    <td class="p-4">
                      <div class="flex items-center gap-2">
                        <span v-if="getRankIcon(index)" class="text-xl">{{ getRankIcon(index) }}</span>
                        <span :class="getRankColor(index)" class="font-semibold">{{ index + 1 }}</span>
                      </div>
                    </td>

                    <!-- Institution -->
                    <td class="p-4">
                      <div class="space-y-1.5">
                        <div class="font-semibold text-foreground">{{ item.institution }}</div>
                        <div v-if="getLabels(item.labels).length > 0" class="flex flex-wrap gap-1.5 mt-1">
                          <span
                            v-for="label in getLabels(item.labels)"
                            :key="label"
                            class="text-xs px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground border border-border/50 font-medium"
                          >
                            {{ label.toUpperCase() }}
                          </span>
                        </div>
                      </div>
                    </td>

                    <!-- Stipend -->
                    <td class="p-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <span class="text-blue-600 font-bold">✓</span>
                        <span class="font-semibold">{{ formatCurrency(item.afterQualStipend || item.preQualStipend) }}</span>
                      </div>
                    </td>

                    <!-- Fees -->
                    <td class="p-4 text-right">
                      <span class="text-foreground">{{ formatCurrency(item.fee) }}</span>
                    </td>

                    <!-- Living Cost -->
                    <td class="p-4 text-right">
                      <span class="text-foreground">{{ formatCurrency(item.livingCost) }}</span>
                    </td>

                    <!-- After Fees & Living -->
                    <td class="p-4 text-right">
                      <span
                        :class="item.afterFeesAndLiving < 0 ? 'text-red-600 font-bold' : 'font-bold text-foreground'"
                      >
                        {{ formatCurrency(item.afterFeesAndLiving) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Empty State -->
            <div v-if="!loading && stipendData.length === 0" class="p-8 text-center text-muted-foreground">
              <p>No stipend data available</p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
table {
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  background-color: hsl(var(--muted) / 0.5);
  z-index: 10;
}
</style>
