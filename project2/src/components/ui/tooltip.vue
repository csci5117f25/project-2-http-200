<script setup lang="ts">
import { ref, onUnmounted, nextTick } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  content?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
  delayDuration: 0
})

const show = ref(false)
const timeoutRef = ref<number | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)

const handleMouseEnter = async () => {
  if (props.delayDuration > 0) {
    timeoutRef.value = window.setTimeout(() => {
      show.value = true
      nextTick(() => updatePosition())
    }, props.delayDuration)
  } else {
    show.value = true
    await nextTick()
    updatePosition()
  }
}

const handleMouseLeave = () => {
  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value)
    timeoutRef.value = null
  }
  show.value = false
}

const updatePosition = () => {
  if (!triggerRef.value || !tooltipRef.value || !props.content) return
  
  const rect = triggerRef.value.getBoundingClientRect()
  const tooltip = tooltipRef.value
  
  if (props.side === 'right') {
    tooltip.style.left = `${rect.right + 8}px`
    tooltip.style.top = `${rect.top + rect.height / 2}px`
    tooltip.style.transform = 'translateY(-50%)'
  } else if (props.side === 'left') {
    tooltip.style.right = `${window.innerWidth - rect.left + 8}px`
    tooltip.style.top = `${rect.top + rect.height / 2}px`
    tooltip.style.transform = 'translateY(-50%)'
  } else if (props.side === 'top') {
    tooltip.style.left = `${rect.left + rect.width / 2}px`
    tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`
    tooltip.style.transform = 'translateX(-50%)'
  } else if (props.side === 'bottom') {
    tooltip.style.left = `${rect.left + rect.width / 2}px`
    tooltip.style.top = `${rect.bottom + 8}px`
    tooltip.style.transform = 'translateX(-50%)'
  }
}

onUnmounted(() => {
  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value)
  }
})

const arrowClasses = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900'
}
</script>

<template>
  <div 
    ref="triggerRef"
    class="relative inline-block w-full"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    style="pointer-events: auto;"
  >
    <slot />
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="show && content"
          ref="tooltipRef"
          class="fixed z-[9999] px-2 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none"
        >
          {{ content }}
          <div
            :class="cn(
              'absolute w-0 h-0 border-4 border-transparent',
              arrowClasses[side]
            )"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

