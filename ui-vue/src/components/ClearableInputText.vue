<script setup lang="ts">
import { X } from '@lucide/vue'
import InputText from 'primevue/inputtext'
import { computed, ref, useAttrs, watch } from 'vue'

interface ClearableInputTextProps {
    modelValue?: string | null
    disabled?: boolean | null
    fluid?: boolean | null
}

defineOptions({
    inheritAttrs: false,
})

const props = defineProps<ClearableInputTextProps>()

const emit = defineEmits<{
    'update:modelValue': [value: string | null]
    clear: [event: MouseEvent]
}>()

const attrs = useAttrs()
const inputRef = ref<{ $el: HTMLInputElement } | null>(null)
const localValue = ref<string | null>(props.modelValue ?? null)

watch(
    () => props.modelValue,
    (value) => {
        localValue.value = value ?? null
    }
)

const hasValue = computed(() => {
    return localValue.value !== null && localValue.value !== ''
})

const inputModelValue = computed(() => {
    return localValue.value
})

const inputDisabled = computed(() => {
    return props.disabled ?? undefined
})

const inputFluid = computed(() => {
    return props.fluid ?? undefined
})

const canClear = computed(() => {
    return hasValue.value && !props.disabled
})

const rootClass = computed(() => {
    return ['relative inline-flex items-center', { 'w-full': props.fluid }]
})

const inputClass = computed(() => {
    return [attrs.class, { 'pe-8': canClear.value }]
})

const updateModelValue = (value: string | null) => {
    localValue.value = value
    emit('update:modelValue', value)
}

const onInput = (event: Event) => {
    updateModelValue((event.target as HTMLInputElement).value)
}

const focusInput = () => {
    inputRef.value?.$el.focus()
}

const onClear = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    updateModelValue(null)
    emit('clear', event)
    requestAnimationFrame(focusInput)
}
</script>

<template>
    <span :class="rootClass">
        <InputText v-bind="attrs" ref="inputRef" :model-value="inputModelValue" :disabled="inputDisabled"
            :fluid="inputFluid" :class="inputClass" @input="onInput" />
        <button v-if="canClear" type="button"
            class="absolute inset-e-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 font-[inherit] leading-none text-(--p-form-field-color) opacity-65 hover:bg-(--p-content-hover-background) hover:text-(--p-form-field-color) hover:opacity-100 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--p-primary-color)"
            aria-label="清空" @click="onClear">
            <X :size="14" aria-hidden="true" />
        </button>
    </span>
</template>
