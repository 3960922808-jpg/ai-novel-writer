<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="startup-splash" role="status" aria-live="polite" :aria-label="statusText">
      <div class="aurora aurora-one"></div>
      <div class="aurora aurora-two"></div>
      <div class="grain"></div>

      <div class="stars" aria-hidden="true">
        <i v-for="star in stars" :key="star.id" :style="star.style"></i>
      </div>

      <main class="splash-content">
        <div class="story-mark" aria-hidden="true">
          <div class="halo halo-one"></div>
          <div class="halo halo-two"></div>
          <svg class="book" viewBox="0 0 240 180" fill="none">
            <defs>
              <linearGradient id="pageLeft" x1="32" y1="34" x2="124" y2="151" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F8FAFF" />
                <stop offset="1" stop-color="#BFD9FF" />
              </linearGradient>
              <linearGradient id="pageRight" x1="205" y1="33" x2="118" y2="151" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF" />
                <stop offset="1" stop-color="#D9C9FF" />
              </linearGradient>
              <linearGradient id="inkLine" x1="51" y1="69" x2="190" y2="111" gradientUnits="userSpaceOnUse">
                <stop stop-color="#73C8FF" />
                <stop offset=".52" stop-color="#A897FF" />
                <stop offset="1" stop-color="#EAAFFF" />
              </linearGradient>
              <filter id="bookGlow" x="-30%" y="-30%" width="160%" height="180%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feColorMatrix in="blur" values="0 0 0 0 0.35 0 0 0 0 0.65 0 0 0 0 1 0 0 0 .55 0" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g class="book-shape" filter="url(#bookGlow)">
              <path class="page page-left" d="M119.5 55.5C97 38.3 67.2 32.8 34 41.7v94.7c32.3-9 61.3-4.4 85.5 14.1v-95Z" fill="url(#pageLeft)" fill-opacity=".96" />
              <path class="page page-right" d="M120.5 55.5c22.5-17.2 52.3-22.7 85.5-13.8v94.7c-32.3-9-61.3-4.4-85.5 14.1v-95Z" fill="url(#pageRight)" fill-opacity=".96" />
              <path d="M120 56v94" stroke="#8CB7FA" stroke-width="2.2" stroke-linecap="round" />
              <path class="page-line line-one" d="M51 69c18.5-3 34.5-.5 52 7" stroke="url(#inkLine)" stroke-width="3" stroke-linecap="round" />
              <path class="page-line line-two" d="M51 85c19-2.2 34.6.5 53 8" stroke="url(#inkLine)" stroke-width="3" stroke-linecap="round" />
              <path class="page-line line-three" d="M137 75c18.2-7.5 34.9-9.7 52-6" stroke="url(#inkLine)" stroke-width="3" stroke-linecap="round" />
              <path class="page-line line-four" d="M136 92c17.5-7.8 34.2-10.3 53-7" stroke="url(#inkLine)" stroke-width="3" stroke-linecap="round" />
            </g>
            <path class="quill" d="M169 17c-21.5 5.6-35.5 22.8-37.5 48.5 11.3-2.2 22.1-8 28.9-17.2-5 2.3-10.1 3.5-15.3 3.7 12.9-5.2 20.2-16.8 23.9-35Z" fill="url(#inkLine)" />
            <path class="quill-stem" d="M164 24c-10.5 15.7-20.7 29.4-33.6 43" stroke="#D9E9FF" stroke-width="2.4" stroke-linecap="round" />
            <path class="ink-swish" d="M70 126c31 17.5 72 18.5 103-3" stroke="url(#inkLine)" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </div>

        <div class="brand-block">
          <div class="brand-eyebrow"><span></span> 本地优先 · 长篇创作工作台 <span></span></div>
          <h1><span>Trm</span><b>Write</b></h1>
          <p>让灵感，在这里长成故事</p>
        </div>

        <div class="loading-area">
          <div class="loading-meta">
            <span class="loading-status">{{ statusText }}</span>
            <span class="loading-number">{{ displayProgress }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${displayProgress}%` }">
              <span class="progress-glint"></span>
            </div>
          </div>
          <button class="skip-button" type="button" @click="finish">进入创作空间</button>
        </div>
      </main>

      <footer>每一个世界，都从第一句话开始</footer>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ ready?: boolean }>()

const visible = ref(true)
const progress = ref(4)
const startedAt = Date.now()
const minimumDuration = 2450
let progressTimer: ReturnType<typeof setInterval> | undefined
let finishTimer: ReturnType<typeof setTimeout> | undefined
let safetyTimer: ReturnType<typeof setTimeout> | undefined

const displayProgress = computed(() => Math.round(progress.value))
const statusText = computed(() => {
  if (progress.value < 28) return '铺开稿纸'
  if (progress.value < 56) return '唤醒灵感'
  if (progress.value < 84) return '整理故事世界'
  if (progress.value < 100) return '准备进入创作空间'
  return '一切就绪'
})

const stars = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  style: {
    '--x': `${(index * 43 + 11) % 97}%`,
    '--y': `${(index * 67 + 7) % 89}%`,
    '--size': `${1 + (index % 3) * 0.7}px`,
    '--delay': `${(index % 8) * -0.47}s`,
    '--duration': `${3.2 + (index % 5) * 0.75}s`
  }
}))

function scheduleFinish() {
  if (!props.ready || !visible.value || finishTimer) return
  const remaining = Math.max(0, minimumDuration - (Date.now() - startedAt))
  progress.value = Math.max(progress.value, 88)
  finishTimer = setTimeout(() => {
    progress.value = 100
    finishTimer = setTimeout(finish, 360)
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
    finishTimer = setTimeout(finish, props.ready ? 420 : 900)
    return
  }

  progressTimer = setInterval(() => {
    if (progress.value >= 87) return
    const remaining = 87 - progress.value
    progress.value += Math.max(0.35, remaining * 0.045)
  }, 45)
  safetyTimer = setTimeout(() => {
    progress.value = 100
    finishTimer = setTimeout(finish, 300)
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
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #f8fbff;
  background:
    radial-gradient(circle at 50% 36%, rgba(79, 121, 255, .2), transparent 31%),
    radial-gradient(circle at 78% 78%, rgba(179, 95, 255, .12), transparent 31%),
    linear-gradient(145deg, #060c18 0%, #091426 48%, #101127 100%);
  isolation: isolate;
}
.startup-splash::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at center, black, transparent 73%);
}
.aurora { position: absolute; z-index: -2; border-radius: 50%; filter: blur(70px); opacity: .34; animation: auroraFloat 8s ease-in-out infinite alternate; }
.aurora-one { width: 44vw; height: 24vw; left: -10vw; top: 3vh; background: #167ed9; transform: rotate(-18deg); }
.aurora-two { width: 38vw; height: 25vw; right: -7vw; bottom: -3vh; background: #8847cf; animation-delay: -3.2s; }
.grain { position: absolute; inset: -50%; z-index: 8; pointer-events: none; opacity: .035; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E"); animation: grainShift .35s steps(2) infinite; }
.stars { position: absolute; inset: 0; z-index: -1; }
.stars i { position: absolute; left: var(--x); top: var(--y); width: var(--size); height: var(--size); border-radius: 50%; background: #ddecff; box-shadow: 0 0 9px rgba(164, 203, 255, .85); animation: starPulse var(--duration) ease-in-out var(--delay) infinite; }
.splash-content { width: min(520px, 86vw); display: flex; flex-direction: column; align-items: center; transform: translateY(-1.5vh); }
.story-mark { position: relative; width: 224px; height: 170px; margin-bottom: 2px; animation: markArrive 1s cubic-bezier(.2,.8,.2,1) both; }
.book { width: 100%; height: 100%; overflow: visible; }
.halo { position: absolute; left: 50%; top: 51%; border: 1px solid rgba(145, 193, 255, .19); border-radius: 50%; transform: translate(-50%, -50%); }
.halo-one { width: 190px; height: 190px; animation: haloPulse 3.5s ease-out infinite; }
.halo-two { width: 146px; height: 146px; border-color: rgba(203, 170, 255, .16); animation: haloPulse 3.5s 1.2s ease-out infinite; }
.page-left { transform-origin: 119px 96px; animation: openLeft 1s .18s cubic-bezier(.18,.78,.24,1) both; }
.page-right { transform-origin: 121px 96px; animation: openRight 1s .18s cubic-bezier(.18,.78,.24,1) both; }
.page-line { stroke-dasharray: 70; stroke-dashoffset: 70; animation: writeLine .7s ease forwards; }
.line-one { animation-delay: 1s; }.line-two { animation-delay: 1.15s; }.line-three { animation-delay: 1.28s; }.line-four { animation-delay: 1.43s; }
.quill { transform-origin: 150px 45px; animation: quillWrite 2.1s .35s cubic-bezier(.3,.7,.2,1) both; }
.quill-stem { stroke-dasharray: 65; stroke-dashoffset: 65; animation: writeLine .8s .7s ease forwards; }
.ink-swish { stroke-dasharray: 120; stroke-dashoffset: 120; animation: writeLine 1s 1.2s ease forwards; }
.brand-block { text-align: center; animation: textArrive .8s .55s ease-out both; }
.brand-eyebrow { display: flex; align-items: center; justify-content: center; gap: 10px; color: rgba(202, 220, 247, .58); font-size: 11px; letter-spacing: .26em; }
.brand-eyebrow span { width: 24px; height: 1px; background: linear-gradient(90deg, transparent, rgba(157, 197, 255, .7)); }
.brand-eyebrow span:last-child { transform: rotate(180deg); }
h1 { margin: 13px 0 5px; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; font-size: clamp(42px, 6vw, 58px); line-height: 1; letter-spacing: -.045em; font-weight: 300; text-shadow: 0 8px 35px rgba(97, 157, 255, .25); }
h1 span { color: #f6fbff; } h1 b { font-weight: 650; background: linear-gradient(105deg, #7ad3ff 12%, #a9a2ff 52%, #efb8ff 92%); background-clip: text; -webkit-background-clip: text; color: transparent; }
.brand-block p { margin: 12px 0 0; color: rgba(225, 236, 250, .68); font-family: 'Songti SC', SimSun, serif; font-size: 15px; letter-spacing: .42em; text-indent: .42em; }
.loading-area { width: min(360px, 76vw); margin-top: 44px; animation: textArrive .7s 1s ease-out both; }
.loading-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; color: rgba(196, 216, 243, .58); font-size: 11px; letter-spacing: .12em; }
.loading-number { font-variant-numeric: tabular-nums; letter-spacing: .04em; }
.progress-track { height: 3px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.09); box-shadow: inset 0 1px 2px rgba(0,0,0,.3); }
.progress-fill { position: relative; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #43bfff, #8c8dff 56%, #e98cff); box-shadow: 0 0 16px rgba(119, 164, 255, .66); transition: width .18s ease-out; }
.progress-glint { position: absolute; right: -3px; top: -2px; width: 7px; height: 7px; border-radius: 50%; background: #fff; box-shadow: 0 0 12px #8ac8ff, 0 0 25px #d49cff; }
.skip-button { display: block; margin: 15px auto 0; padding: 5px 14px; border: 1px solid transparent; border-radius: 999px; color: rgba(215, 229, 248, .42); background: transparent; font: inherit; font-size: 11px; letter-spacing: .12em; cursor: pointer; transition: color .2s, border-color .2s, background .2s; }
.skip-button:hover { color: rgba(240,247,255,.9); border-color: rgba(149, 190, 255, .18); background: rgba(255,255,255,.035); }
footer { position: absolute; bottom: 28px; color: rgba(179, 200, 228, .28); font-family: 'Songti SC', SimSun, serif; font-size: 11px; letter-spacing: .34em; text-indent: .34em; animation: textArrive 1s 1.2s ease-out both; }
.splash-fade-leave-active { transition: opacity .58s ease, filter .58s ease; }
.splash-fade-leave-to { opacity: 0; filter: blur(8px); }
@keyframes openLeft { from { opacity: 0; transform: perspective(500px) rotateY(72deg) translateX(18px); } to { opacity: 1; transform: perspective(500px) rotateY(0); } }
@keyframes openRight { from { opacity: 0; transform: perspective(500px) rotateY(-72deg) translateX(-18px); } to { opacity: 1; transform: perspective(500px) rotateY(0); } }
@keyframes writeLine { to { stroke-dashoffset: 0; } }
@keyframes quillWrite { 0% { opacity: 0; transform: translate(26px,-18px) rotate(15deg); } 28% { opacity: 1; } 68% { transform: translate(-8px,6px) rotate(-4deg); } 100% { opacity: .95; transform: translate(0,0) rotate(0); } }
@keyframes haloPulse { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.74); } 45% { opacity: .7; } 100% { opacity: 0; transform: translate(-50%,-50%) scale(1.25); } }
@keyframes markArrive { from { opacity: 0; transform: translateY(14px) scale(.92); } to { opacity: 1; transform: none; } }
@keyframes textArrive { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes starPulse { 0%,100% { opacity: .12; transform: scale(.7); } 50% { opacity: .8; transform: scale(1.25); } }
@keyframes auroraFloat { to { transform: translate(5vw, 3vh) rotate(10deg) scale(1.12); } }
@keyframes grainShift { 0% { transform: translate(0,0); } 25% { transform: translate(2%,-1%); } 50% { transform: translate(-1%,2%); } 75% { transform: translate(1%,1%); } }
@media (max-height: 690px) { .story-mark { width: 176px; height: 134px; } .loading-area { margin-top: 26px; } footer { bottom: 16px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition-duration: .15s !important; } .page-line, .quill-stem, .ink-swish { stroke-dashoffset: 0; } }
</style>
