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
        confirmAfter: true,
        resultTarget: '#activitySheet',
        resultPlacement: 'top',
        confirmText: '这是活动简介卡片，可查看评分与活动信息。',
      },
      {
        tag: '筛选',
        text: '点右上角「筛选」，可按类别、时间、距离等查找活动。',
        target: '#btnFilter',
        placement: 'bottom',
        anchorBubble: true,
        bubbleAlign: 'end',
        waitFor: 'filter-open',
        confirmAfter: true,
        resultTarget: '#filterPanel',
        resultPlacement: 'top',
        confirmText: '筛选面板已打开，可按类别、时间、距离等条件查找。',
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
        text: '点击底部「查看详情」，进入活动完整页面。',
        target: '#btnDetail',
        spotlightTarget: '#activitySheet',
        placement: 'top',
        anchorBubble: true,
        waitFor: 'detail-open',
        keepSheet: true,
        delayPosition: 420,
        repositionAgain: 220,
        scrollTarget: false,
      },
      {
        tag: '底部 Tab',
        text: '点「推荐」浏览列表，或「我的」查看想去与评价。',
        target: '.tab[data-tab="recommend"]',
        placement: 'top',
        bubbleDock: 'top',
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
    let confirming = false;
    let confirmAdvanceLock = false;
    let confirmListenersBound = false;

    function finish() {
      localStorage.setItem(STORAGE_KEY, '1');
      active = false;
      exitConfirmMode();
      overlay.hidden = true;
      overlay.classList.remove('active');
      spotlight.hidden = true;
      spotlight.classList.remove('pulse');
      if (promptEl) promptEl.remove();
      document.getElementById('app')?.classList.remove('guide-confirming');
      api.closeGuideLayers();
    }

    function resolveTarget(step, role = 'target') {
      const key = role === 'spotlight' ? 'spotlightTarget' : 'target';
      const raw = step[key] || step.target;
      if (!raw) return null;
      if (typeof raw === 'function') return raw();
      return document.querySelector(raw);
    }

    function rectsOverlap(a, b, gap = 16) {
      return !(a.right + gap < b.left || a.left - gap > b.right
        || a.bottom + gap < b.top || a.top - gap > b.bottom);
    }

    function positionStep(step) {
      const app = document.getElementById('app');
      const spotlightEl = resolveTarget(step, 'spotlight');
      const bubbleTarget = resolveTarget(step, 'target');
      const header = document.querySelector('.header');
      const headerH = header ? header.offsetHeight : 52;

      if (!app || !bubbleTarget) {
        spotlight.hidden = true;
        bubble.style.left = '12px';
        bubble.style.right = '12px';
        bubble.style.top = `${headerH + 12}px`;
        bubble.style.bottom = 'auto';
        if (arrow) arrow.hidden = true;
        return;
      }

      if (step.scrollTarget !== false && bubbleTarget.scrollIntoView) {
        try {
          bubbleTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        } catch (_) {
          bubbleTarget.scrollIntoView(false);
        }
      }

      if (bubbleTarget.id === 'btnDetail') {
        const sheetBody = document.querySelector('#activitySheet .sheet-body');
        if (sheetBody) sheetBody.scrollTop = sheetBody.scrollHeight;
      }

      const appRect = app.getBoundingClientRect();

      function placeRect(el) {
        const rect = el.getBoundingClientRect();
        const pad = 8;
        const x = Math.max(4, rect.left - appRect.left - pad);
        const y = Math.max(4, rect.top - appRect.top - pad);
        const w = Math.min(appRect.width - x - 4, rect.width + pad * 2);
        const h = Math.min(appRect.height - y - 4, rect.height + pad * 2);
        return { x, y, w, h, rect };
      }

      const spotBox = placeRect(spotlightEl || bubbleTarget);
      const { x, y, w, h } = spotBox;

      spotlight.hidden = false;
      spotlight.classList.add('pulse');
      spotlight.style.left = `${x}px`;
      spotlight.style.top = `${y}px`;
      spotlight.style.width = `${w}px`;
      spotlight.style.height = `${h}px`;
      const spotRef = spotlightEl || bubbleTarget;
      spotlight.style.borderRadius = spotRef.classList.contains('marker') ? '50%' : '12px';

      bubble.style.left = 'auto';
      bubble.style.right = 'auto';
      bubble.style.top = 'auto';
      bubble.style.bottom = 'auto';
      bubble.style.maxWidth = `${Math.min(300, appRect.width - 24)}px`;
      bubble.classList.toggle('guide-bubble-compact', appRect.height < 720);

      const bubbleBox = placeRect(bubbleTarget);
      const bx0 = bubbleBox.x;
      const by0 = bubbleBox.y;
      const bw0 = bubbleBox.w;
      const bh0 = bubbleBox.h;
      const margin = 12;
      let bubbleW = bubble.offsetWidth || 240;
      let bubbleH = bubble.offsetHeight || 100;
      const cx = bx0 + bw0 / 2;

      const targetBox = { left: bx0, top: by0, right: bx0 + bw0, bottom: by0 + bh0 };
      const spaceBelow = appRect.height - (by0 + bh0);
      const spaceAbove = by0;
      const targetInLowerHalf = (by0 + bh0 / 2) > appRect.height * 0.42;
      const dockTop = step.bubbleDock === 'top'
        || (!step.anchorBubble && targetInLowerHalf);

      let bx;
      let by;
      let arrowDir = 'down';

      if (dockTop) {
        by = headerH + 10;
        bx = Math.max(12, Math.min(appRect.width - bubbleW - 12, cx - bubbleW / 2));
        arrowDir = 'down';
      } else {
        let placement = step.placement || 'bottom';
        if (placement === 'bottom' && spaceBelow < bubbleH + 36 && spaceAbove > spaceBelow) {
          placement = 'top';
        }
        if (placement === 'top' && spaceAbove < bubbleH + 36 && spaceBelow > spaceAbove) {
          placement = 'bottom';
        }
        if (placement === 'top') {
          by = by0 - bubbleH - margin;
          arrowDir = 'down';
        } else {
          by = by0 + bh0 + margin;
          arrowDir = 'up';
        }
        if (step.bubbleAlign === 'end') {
          bx = bx0 + bw0 - bubbleW;
        } else if (step.bubbleAlign === 'start') {
          bx = bx0;
        } else {
          bx = cx - bubbleW / 2;
        }
      }

      bx = Math.max(12, Math.min(appRect.width - bubbleW - 12, bx));
      if (dockTop) {
        by = Math.max(headerH + 8, Math.min(appRect.height - bubbleH - 8, by));
      } else if (step.placement === 'top' || (step.placement !== 'bottom' && by < headerH + 8)) {
        by = Math.max(headerH + 8, by);
      } else {
        by = Math.max(headerH + 8, Math.min(appRect.height - bubbleH - 8, by));
      }

      bubbleW = bubble.offsetWidth || bubbleW;
      bubbleH = bubble.offsetHeight || bubbleH;
      const bubbleRect = { left: bx, top: by, right: bx + bubbleW, bottom: by + bubbleH };

      if (rectsOverlap(bubbleRect, targetBox)) {
        if (spaceBelow >= bubbleH + 36 && !dockTop && step.placement !== 'top') {
          by = by0 + bh0 + margin;
          arrowDir = 'up';
        } else if (spaceAbove >= bubbleH + 36) {
          by = by0 - bubbleH - margin;
          arrowDir = 'down';
        } else if (step.bubbleAlign === 'end') {
          bx = Math.max(12, bx0 + bw0 - bubbleW);
          by = by0 + bh0 + margin;
          arrowDir = 'up';
        }
      }

      bubble.style.left = `${bx}px`;
      bubble.style.top = `${by}px`;

      if (arrow) {
        arrow.hidden = false;
        arrow.className = arrowDir === 'down'
          ? 'guide-arrow guide-arrow-down'
          : 'guide-arrow guide-arrow-up';
        const arrowX = Math.max(18, Math.min(bubbleW - 18, cx - bx));
        arrow.style.left = `${arrowX}px`;
      }
    }

    function schedulePosition(step) {
      const run = () => {
        positionStep(step);
        requestAnimationFrame(() => positionStep(step));
      };
      if (step.delayPosition) {
        setTimeout(run, step.delayPosition);
        if (step.repositionAgain) {
          setTimeout(run, step.delayPosition + step.repositionAgain);
        }
      } else {
        requestAnimationFrame(run);
      }
    }

    function updateStepUI(step, mode = 'action') {
      if (tagEl) tagEl.textContent = step.tag;
      if (stepNumEl) stepNumEl.textContent = `${index + 1} / ${steps.length}`;

      if (mode === 'confirm') {
        if (textEl) textEl.textContent = step.confirmText || '很好！你已经打开了对应界面。';
        if (hintEl) {
          hintEl.hidden = false;
          hintEl.textContent = '👆 查看完毕后，点击屏幕任意位置继续';
        }
        if (btnNext) {
          btnNext.hidden = false;
          btnNext.textContent = '继续';
        }
        return;
      }

      if (textEl) textEl.textContent = step.text;
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

    function buildPositionStep(step, mode = 'action') {
      if (mode !== 'confirm' || !step.resultTarget) return step;
      return {
        ...step,
        target: step.resultTarget,
        spotlightTarget: step.resultTarget,
        placement: step.resultPlacement || 'top',
        anchorBubble: true,
        bubbleDock: undefined,
        bubbleAlign: undefined,
        delayPosition: 320,
      };
    }

    function removeConfirmListeners() {
      if (!confirmListenersBound) return;
      document.removeEventListener('click', handleConfirmPointer, true);
      document.removeEventListener('touchend', handleConfirmPointer, true);
      confirmListenersBound = false;
    }

    function handleConfirmPointer(e) {
      if (!confirming || confirmAdvanceLock) return;
      if (e.target.closest('#guideBubble')) return;
      if (e.type === 'click') e.preventDefault();
      advanceFromConfirm();
    }

    function exitConfirmMode(removeListeners = true) {
      confirming = false;
      confirmAdvanceLock = false;
      if (removeListeners) removeConfirmListeners();
      document.getElementById('app')?.classList.remove('guide-confirming');
    }

    function enterConfirmMode() {
      const step = steps[index];
      confirming = true;
      confirmAdvanceLock = false;

      document.getElementById('app')?.classList.add('guide-confirming');

      updateStepUI(step, 'confirm');
      schedulePosition(buildPositionStep(step, 'confirm'));

      if (!confirmListenersBound) {
        document.addEventListener('click', handleConfirmPointer, true);
        document.addEventListener('touchend', handleConfirmPointer, true);
        confirmListenersBound = true;
      }
    }

    function advanceFromConfirm() {
      if (!confirming || confirmAdvanceLock) return;
      confirmAdvanceLock = true;
      const next = index + 1;
      exitConfirmMode();
      showStep(next);
    }

    function showStep(i) {
      index = i;
      if (promptEl) promptEl.remove();
      exitConfirmMode();

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
      if (!active || confirming || index >= steps.length) return;
      const step = steps[index];
      if (step.waitFor !== event) return;
      if (step.confirmAfter) {
        enterConfirmMode();
        return;
      }
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
        if (confirming) {
          advanceFromConfirm();
          return;
        }
        showStep(index + 1);
      });
    }

    btnSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      finish();
    });

    window.addEventListener('resize', debounce(() => {
      if (!active || index >= steps.length) return;
      if (confirming) {
        schedulePosition(buildPositionStep(steps[index], 'confirm'));
      } else {
        schedulePosition(steps[index]);
      }
    }, IS_COARSE ? 200 : 120), { passive: true });

    if (IS_COARSE) {
      showWelcomePrompt();
    } else {
      setTimeout(() => showStep(0), 600);
    }

    return {
      onUserAction,
      isActive() {
        return active;
      },
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
