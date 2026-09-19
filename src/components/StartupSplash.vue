<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="startup-splash" role="status" aria-live="polite" :aria-label="statusText">
      <main class="splash-content">
        <div class="wordmark-wrap" aria-hidden="true">
          <div class="wordmark">TrmWrite</div>
          <span class="wordmark-dot"></span>
        </div>

        <p class="slogan">让灵感，在这里长成故事</p>

        <div class="loading-area">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${displayProgress}%` }">
              <span class="progress-light"></span>
            </div>
          </div>
          <div class="loading-meta">
            <span>{{ statusText }}</span>
            <span class="loading-number">{{ displayProgress }}%</span>
          </div>
        </div>

        <button class="skip-button" type="button" @click="finish">进入创作空间</button>
      </main>

      <div class="version">TRMWRITE · {{ version }}</div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ ready?: boolean }>()

const version = '2.1.4'
const visible = ref(true)
const progress = ref(4)
const startedAt = Date.now()
const minimumDuration = 2100
let progressTimer: ReturnType<typeof setInterval> | undefined
let finishTimer: ReturnType<typeof setTimeout> | undefined
let safetyTimer: ReturnType<typeof setTimeout> | undefined

const displayProgress = computed(() => Math.round(progress.value))
const statusText = computed(() => {
  if (progress.value < 28) return '正在准备写作环境'
  if (progress.value < 58) return '正在载入创作资料'
  if (progress.value < 86) return '正在整理故事空间'
  if (progress.value < 100) return '即将完成'
  return '准备就绪'
})

function scheduleFinish() {
  if (!props.ready || !visible.value || finishTimer) return
  const remaining = Math.max(0, minimumDuration - (Date.now() - startedAt))
  progress.value = Math.max(progress.value, 88)
  finishTimer = setTimeout(() => {
    progress.value = 100
    finishTimer = setTimeout(finish, 280)
  }, remaining)
}

function finish() {
  if (!visible.value) return
  progress.value = 100
  visible.value = false
}

watch(() => props.ready, scheduleFinish, { immediate: true })

onMounted(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    progress.value = 100
    finishTimer = setTimeout(finish, props.ready ? 350 : 800)
    return
  }

  progressTimer = setInterval(() => {
    if (progress.value >= 87) return
    const remaining = 87 - progress.value
    progress.value += Math.max(0.4, remaining * 0.05)
  }, 45)

  safetyTimer = setTimeout(() => {
    progress.value = 100
    finishTimer = setTimeout(finish, 250)
  }, 7000)
  scheduleFinish()
})

onBeforeUnmount(() => {
  if (progressTimer) clearInterval(progressTimer)
  if (finishTimer) clearTimeout(finishTimer)
  if (safetyTimer) clearTimeout(safetyTimer)
})
</script>

<style scoped>
.startup-splash {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #666a70;
  background: #fff;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.startup-splash::before,
.startup-splash::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(1px);
}

.startup-splash::before {
  width: min(68vw, 900px);
  height: min(30vw, 360px);
  left: -22vw;
  top: -18vw;
  background: rgba(91, 96, 104, .025);
  transform: rotate(-12deg);
}

.startup-splash::after {
  width: min(52vw, 720px);
  height: min(22vw, 300px);
  right: -18vw;
  bottom: -13vw;
  background: rgba(91, 96, 104, .02);
  transform: rotate(-12deg);
}

.splash-content {
  width: min(460px, 78vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateY(-1.5vh);
}

.wordmark-wrap { position: relative; animation: wordmark-in .9s cubic-bezier(.2,.78,.2,1) both; }
.wordmark {
  color: #64686e;
  font-family: 'Arial Rounded MT Bold', 'Segoe UI Rounded', 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: clamp(54px, 7vw, 78px);
  font-weight: 750;
  font-style: italic;
  line-height: 1;
  letter-spacing: -.065em;
  transform: skewX(-5deg);
  text-shadow: 0 8px 22px rgba(54, 58, 64, .08);
}
.wordmark-dot {
  position: absolute;
  right: -15px;
  bottom: 5px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #8d9197;
  animation: dot-breathe 1.8s .5s ease-in-out infinite;
}

.slogan {
  margin: 18px 0 0;
  color: #a4a7ac;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: .34em;
  text-indent: .34em;
  animation: rise-in .7s .28s ease-out both;
}

.loading-area { width: min(390px, 74vw); margin-top: 60px; animation: rise-in .7s .48s ease-out both; }
.progress-track {
  height: 14px;
  padding: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef0f2;
  box-shadow: inset 0 1px 3px rgba(39, 43, 48, .08);
}
.progress-fill {
  position: relative;
  height: 100%;
  min-width: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(100deg, #a4a8ad 0%, #6f747b 65%, #8d9298 100%);
  box-shadow: 0 2px 7px rgba(60, 64, 70, .16);
  transition: width .2s cubic-bezier(.25,.8,.25,1);
}
.progress-light {
  position: absolute;
  inset: 0;
  width: 45%;
  border-radius: inherit;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.42), transparent);
  transform: translateX(-130%);
  animation: progress-shine 1.65s .6s ease-in-out infinite;
}
.loading-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 13px;
  padding: 0 3px;
  color: #adb0b5;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .12em;
}
.loading-number { color: #858990; font-variant-numeric: tabular-nums; letter-spacing: .04em; }

.skip-button {
  margin-top: 25px;
  padding: 8px 17px;
  border: 1px solid #eceef0;
  border-radius: 999px;
  color: #b2b5b9;
  background: #fafafa;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .1em;
  cursor: pointer;
  animation: rise-in .7s .65s ease-out both;
  transition: color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease;
}
.skip-button:hover { color: #6f7379; border-color: #dfe1e4; background: #f5f5f6; transform: translateY(-1px); }

.version {
  position: absolute;
  bottom: 27px;
  color: #c6c8cb;
  font-size: 9px;
  font-weight: 650;
  letter-spacing: .28em;
  text-indent: .28em;
  animation: rise-in .8s .75s ease-out both;
}

.splash-fade-leave-active { transition: opacity .42s ease, transform .42s ease; }
.splash-fade-leave-to { opacity: 0; transform: scale(1.012); }

@keyframes wordmark-in {
  from { opacity: 0; transform: translateY(16px) scale(.96); filter: blur(5px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes rise-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@keyframes progress-shine { 0%, 20% { transform: translateX(-130%); } 75%, 100% { transform: translateX(280%); } }
@keyframes dot-breathe { 0%, 100% { opacity: .55; transform: scale(.82); } 50% { opacity: 1; transform: scale(1); } }

@media (max-height: 640px) {
  .wordmark { font-size: 52px; }
  .loading-area { margin-top: 38px; }
  .version { bottom: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition-duration: .12s !important; }
}
</style>
