<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="startup-splash" :class="{ 'is-ready': displayProgress === 100 }" role="status" aria-live="polite" :aria-label="statusText">
      <div class="paper-lines" aria-hidden="true"></div>
      <div class="soft-aura" aria-hidden="true"></div>
      <main class="splash-content">
        <div class="brand-eyebrow" aria-hidden="true"><i></i><span>LONGFORM STORY STUDIO</span><i></i></div>
        <div class="wordmark-wrap" aria-hidden="true">
          <div class="wordmark-ghost">TrmWrite</div>
          <div class="wordmark">TrmWrite</div>
          <span class="wordmark-dot"></span>
        </div>

        <p class="slogan">让灵感，在这里长成故事</p>

        <div class="loading-area">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${displayProgress}%` }">
              <span class="progress-light"></span>
              <span class="progress-head"></span>
            </div>
          </div>
          <div class="loading-meta">
            <span>{{ statusText }}</span>
            <span class="loading-number">{{ displayProgress }}%</span>
          </div>
          <div class="progress-stages" aria-hidden="true">
            <span :class="{ active: displayProgress >= 18 }"></span>
            <span :class="{ active: displayProgress >= 45 }"></span>
            <span :class="{ active: displayProgress >= 72 }"></span>
            <span :class="{ active: displayProgress >= 96 }"></span>
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

const version = '2.3.0'
const visible = ref(true)
const progress = ref(4)
const startedAt = Date.now()
const minimumDuration = 2350
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
    finishTimer = setTimeout(finish, 480)
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

.paper-lines {
  position: absolute;
  inset: 0;
  opacity: .42;
  background: repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(80, 85, 92, .027) 48px);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at center, #000 0%, transparent 72%);
  mask-image: radial-gradient(ellipse 70% 60% at center, #000 0%, transparent 72%);
}
.soft-aura {
  position: absolute;
  width: min(760px, 82vw);
  height: min(420px, 52vw);
  border: 1px solid rgba(80, 84, 90, .035);
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(80, 84, 90, .026), transparent 66%);
  transform: rotate(-8deg);
  animation: aura-enter 1.4s cubic-bezier(.2,.75,.2,1) both;
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
  position: relative;
  z-index: 2;
  width: min(460px, 78vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateY(-1.5vh);
}

.brand-eyebrow {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 19px;
  color: #b5b8bc;
  font-size: 8px;
  font-weight: 750;
  letter-spacing: .27em;
  animation: rise-in .65s .05s ease-out both;
}
.brand-eyebrow i { display: block; width: 24px; height: 1px; background: #dfe1e3; }

.wordmark-wrap { position: relative; animation: wordmark-in .9s cubic-bezier(.2,.78,.2,1) both; }
.wordmark-ghost {
  position: absolute;
  inset: 0;
  color: transparent;
  font-family: 'Arial Rounded MT Bold', 'Segoe UI Rounded', 'Segoe UI', sans-serif;
  font-size: clamp(54px, 7vw, 78px);
  font-weight: 750;
  font-style: italic;
  line-height: 1;
  letter-spacing: -.065em;
  -webkit-text-stroke: 1px rgba(92, 96, 102, .09);
  transform: translate(8px, 7px) skewX(-5deg);
  filter: blur(.2px);
}
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
.progress-head {
  position: absolute;
  top: 50%;
  right: 1px;
  width: 5px;
  height: 5px;
  border: 2px solid rgba(255,255,255,.72);
  border-radius: 50%;
  background: #777c82;
  box-shadow: 0 0 0 4px rgba(255,255,255,.18), 0 2px 7px rgba(42,46,51,.25);
  transform: translateY(-50%);
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
.progress-stages { display: flex; justify-content: space-between; padding: 0 4px; margin-top: 12px; }
.progress-stages span { width: 4px; height: 4px; border-radius: 50%; background: #e1e3e5; transition: background .35s ease, transform .35s ease, box-shadow .35s ease; }
.progress-stages span.active { background: #858a90; box-shadow: 0 0 0 3px rgba(133,138,144,.08); transform: scale(1.12); }

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

.startup-splash.is-ready .wordmark { animation: ready-wordmark .48s ease-out both; }
.startup-splash.is-ready .wordmark-dot { animation: ready-dot .48s ease-out both; }
.startup-splash.is-ready .progress-fill { background: linear-gradient(100deg, #aeb2b7, #686d73 60%, #92979c); }

.splash-fade-leave-active {
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.1) 15%, #000 42%, #000 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.1) 15%, #000 42%, #000 100%);
  -webkit-mask-size: 100% 260%;
  mask-size: 100% 260%;
  animation: splash-gradient-away .92s cubic-bezier(.55,.05,.25,1) both;
}
.splash-fade-leave-active .splash-content,
.splash-fade-leave-active .version { transition: opacity .48s ease, transform .68s cubic-bezier(.3,.7,.2,1), filter .58s ease; }
.splash-fade-leave-active .paper-lines,
.splash-fade-leave-active .soft-aura { transition: opacity .65s ease, transform .85s ease; }
.splash-fade-leave-to .splash-content { opacity: 0; transform: translateY(-16px) scale(1.018); filter: blur(3px); }
.splash-fade-leave-to .version { opacity: 0; }
.splash-fade-leave-to .paper-lines { opacity: 0; transform: translateY(-22px); }
.splash-fade-leave-to .soft-aura { opacity: 0; transform: rotate(-8deg) scale(1.18); }

@keyframes wordmark-in {
  from { opacity: 0; transform: translateY(16px) scale(.96); filter: blur(5px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes aura-enter { from { opacity: 0; transform: rotate(-8deg) scale(.8); } to { opacity: 1; transform: rotate(-8deg) scale(1); } }
@keyframes ready-wordmark { 0% { transform: skewX(-5deg); } 48% { color: #555a60; transform: translateY(-2px) skewX(-5deg); text-shadow: 0 12px 28px rgba(54,58,64,.12); } 100% { transform: skewX(-5deg); } }
@keyframes ready-dot { 0% { opacity: .6; transform: scale(.8); } 52% { opacity: 1; transform: scale(1.55); box-shadow: 0 0 0 8px rgba(120,125,131,.08); } 100% { opacity: 1; transform: scale(1); } }
@keyframes rise-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@keyframes progress-shine { 0%, 20% { transform: translateX(-130%); } 75%, 100% { transform: translateX(280%); } }
@keyframes dot-breathe { 0%, 100% { opacity: .55; transform: scale(.82); } 50% { opacity: 1; transform: scale(1); } }
@keyframes splash-gradient-away {
  0% { opacity: 1; -webkit-mask-position: 0 100%; mask-position: 0 100%; filter: blur(0); }
  58% { opacity: .92; }
  100% { opacity: 0; -webkit-mask-position: 0 0; mask-position: 0 0; filter: blur(4px); }
}

@media (max-height: 640px) {
  .wordmark { font-size: 52px; }
  .loading-area { margin-top: 38px; }
  .version { bottom: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition-duration: .12s !important; }
}
</style>
