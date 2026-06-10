(function () {
  'use strict';

  const STORAGE_KEY = 'ipea-guide-done';
  const IS_COARSE = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  function buildSteps() {
    return [
      {
        tag: '地图标记',
        text: '彩色标记是附近活动，带 ⭐ 的是高分好活动。请点一个试试。',
        target: () => document.querySelector('.marker.high') || document.querySelector('.marker'),
        placement: 'bottom',
        waitFor: 'marker-tap',
      },
      {
        tag: '筛选',
        text: '点右上角「筛选」，可按类别、时间、距离等查找活动。',
        target: '#btnFilter',
        placement: 'bottom',
        waitFor: 'filter-open',
        onEnter(api) {
          api.closeSheet();
          api.closeDetail();
        },
      },
      {
        tag: '活动卡片',
        text: '再点一个地图标记，看看活动简介。',
        target: () => document.querySelector('.marker'),
        placement: 'bottom',
        waitFor: 'marker-tap',
        onEnter(api) {
          api.closeFilterPanel();
        },
      },
      {
        tag: '查看详情',
        text: '点击「查看详情」，进入活动完整页面。',
        target: '#btnDetail',
        placement: 'top',
        waitFor: 'detail-open',
        keepSheet: true,
      },
      {
        tag: '底部 Tab',
        text: '点「推荐」浏览列表，或「我的」查看想去与评价。',
        target: '.tab[data-tab="recommend"]',
        placement: 'top',
        waitFor: 'tab-recommend',
        onEnter(api) {
          api.closeDetail();
          api.closeSheet();
          api.closeFilterPanel();
        },
      },
    ];
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function initGuide(api) {
    if (localStorage.getItem(STORAGE_KEY)) return null;

    const overlay = document.getElementById('guideOverlay');
    const spotlight = document.getElementById('guideSpotlight');
    const bubble = document.getElementById('guideBubble');
    const arrow = document.getElementById('guideArrow');
    const textEl = document.getElementById('guideText');
    const tagEl = document.getElementById('guideTag');
    const hintEl = document.getElementById('guideHint');
    const stepNumEl = overlay && overlay.querySelector('.guide-step-num');
    const btnNext = document.getElementById('btnGuideNext');
    const btnSkip = document.getElementById('btnGuideSkip');
    const mapPanel = document.getElementById('mapPanel');

    if (!overlay || !spotlight || !bubble || !textEl || !btnSkip) return null;

    const steps = buildSteps();
    let index = 0;
    let promptEl = null;
    let active = false;

    function finish() {
      localStorage.setItem(STORAGE_KEY, '1');
      active = false;
      overlay.hidden = true;
      overlay.classList.remove('active');
      spotlight.hidden = true;
      spotlight.classList.remove('pulse');
      if (promptEl) promptEl.remove();
      api.closeGuideLayers();
    }

    function resolveTarget(step) {
      if (!step.target) return null;
      if (typeof step.target === 'function') return step.target();
      return document.querySelector(step.target);
    }

    function positionStep(step) {
      const app = document.getElementById('app');
      const target = resolveTarget(step);
      if (!app || !target) {
        spotlight.hidden = true;
        bubble.style.left = '16px';
        bubble.style.right = '16px';
        bubble.style.top = 'auto';
        bubble.style.bottom = 'calc(var(--tabbar-h) + var(--safe-b) + 24px)';
        if (arrow) arrow.className = 'guide-arrow';
        return;
      }

      const appRect = app.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const pad = 8;
      const x = Math.max(4, rect.left - appRect.left - pad);
      const y = Math.max(4, rect.top - appRect.top - pad);
      const w = Math.min(appRect.width - x - 4, rect.width + pad * 2);
      const h = Math.min(appRect.height - y - 4, rect.height + pad * 2);

      spotlight.hidden = false;
      spotlight.classList.add('pulse');
      spotlight.style.left = `${x}px`;
      spotlight.style.top = `${y}px`;
      spotlight.style.width = `${w}px`;
      spotlight.style.height = `${h}px`;
      spotlight.style.borderRadius = target.classList.contains('marker') ? '50%' : '12px';

      bubble.style.left = 'auto';
      bubble.style.right = 'auto';
      bubble.style.top = 'auto';
      bubble.style.bottom = 'auto';
      bubble.style.maxWidth = `${Math.min(280, appRect.width - 32)}px`;

      const margin = 14;
      const bubbleRect = bubble.getBoundingClientRect();
      const bubbleW = bubbleRect.width || 260;
      const bubbleH = bubbleRect.height || 120;
      const cx = x + w / 2;
      const cy = y + h / 2;

      let placement = step.placement || 'bottom';
      const spaceBelow = appRect.height - (y + h);
      const spaceAbove = y;
      if (placement === 'bottom' && spaceBelow < bubbleH + 40 && spaceAbove > spaceBelow) {
        placement = 'top';
      }
      if (placement === 'top' && spaceAbove < bubbleH + 40 && spaceBelow > spaceAbove) {
        placement = 'bottom';
      }

      let bx;
      let by;
      if (placement === 'top') {
        by = y - bubbleH - margin;
        bx = cx - bubbleW / 2;
        if (arrow) arrow.className = 'guide-arrow guide-arrow-down';
      } else {
        by = y + h + margin;
        bx = cx - bubbleW / 2;
        if (arrow) arrow.className = 'guide-arrow guide-arrow-up';
      }

      bx = Math.max(12, Math.min(appRect.width - bubbleW - 12, bx));
      by = Math.max(12, Math.min(appRect.height - bubbleH - 12, by));

      bubble.style.left = `${bx}px`;
      bubble.style.top = `${by}px`;
    }

    function schedulePosition(step) {
      requestAnimationFrame(() => {
        positionStep(step);
        requestAnimationFrame(() => positionStep(step));
      });
    }

    function updateStepUI(step) {
      if (tagEl) tagEl.textContent = step.tag;
      textEl.textContent = step.text;
      if (stepNumEl) stepNumEl.textContent = `${index + 1} / ${steps.length}`;

      const interactive = !!step.waitFor;
      if (hintEl) hintEl.hidden = !interactive;
      if (btnNext) btnNext.hidden = interactive;
      if (interactive && hintEl) {
        hintEl.textContent = '👆 请点击高亮区域继续';
      } else if (btnNext) {
        btnNext.textContent = index === steps.length - 1 ? '开始探索' : '下一步';
        btnNext.hidden = false;
      }
    }

    function showStep(i) {
      index = i;
      if (promptEl) promptEl.remove();

      if (index >= steps.length) {
        finish();
        api.showToast('引导完成，开始探索吧！');
        return;
      }

      active = true;
      const step = steps[index];

      api.switchTab('map');
      api.closeGuideLayers();
      if (step.onEnter) step.onEnter(api);
      if (!step.keepSheet) {
        api.closeSheet();
        api.closeDetail();
      }

      updateStepUI(step);
      overlay.hidden = false;
      overlay.classList.add('active');
      schedulePosition(step);
    }

    function onUserAction(event) {
      if (!active || index >= steps.length) return;
      const step = steps[index];
      if (step.waitFor !== event) return;
      showStep(index + 1);
    }

    function showWelcomePrompt() {
      if (!mapPanel || promptEl) return;
      promptEl = document.createElement('div');
      promptEl.className = 'guide-prompt';
      promptEl.innerHTML = `
        <div class="guide-prompt-text">
          <strong>👋 首次使用？</strong>
          <span>跟着提示点一点，30 秒熟悉 Ipea</span>
        </div>
        <div class="guide-prompt-actions">
          <button type="button" class="guide-prompt-skip" id="btnGuideDismiss">跳过</button>
          <button type="button" class="btn btn-primary btn-sm" id="btnGuideStart">开始引导</button>
        </div>`;
      mapPanel.appendChild(promptEl);

      promptEl.querySelector('#btnGuideStart').addEventListener('click', (e) => {
        e.stopPropagation();
        showStep(0);
      });
      promptEl.querySelector('#btnGuideDismiss').addEventListener('click', (e) => {
        e.stopPropagation();
        finish();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        showStep(index + 1);
      });
    }

    btnSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      finish();
    });

    window.addEventListener('resize', debounce(() => {
      if (active && index < steps.length) schedulePosition(steps[index]);
    }, IS_COARSE ? 200 : 120), { passive: true });

    if (IS_COARSE) {
      showWelcomePrompt();
    } else {
      setTimeout(() => showStep(0), 600);
    }

    return {
      onUserAction,
      restart() {
        localStorage.removeItem(STORAGE_KEY);
        active = false;
        if (IS_COARSE) showWelcomePrompt();
        else showStep(0);
      },
    };
  }

  window.initGuide = initGuide;
})();
