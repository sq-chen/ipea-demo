(function () {
  'use strict';

  const STORAGE_KEY = 'ipea-guide-done';

  function buildSteps() {
    return [
      {
        text: '地图上的彩色标记代表附近活动。带 ⭐ 金色光晕的是高分好活动。',
        target: '#mapCanvas',
        placement: 'bottom',
      },
      {
        text: '点右上角「筛选」，可按音乐、运动、展览等类别查找活动。',
        target: '#btnFilter',
        placement: 'bottom',
      },
      {
        text: '点击地图标记，可弹出活动简介卡片，再进入详情页。',
        target: '#mapCanvas',
        placement: 'bottom',
      },
      {
        text: '在详情页可以「想去」收藏、现场「打卡」并「写评价」。',
        target: '.tabbar',
        placement: 'top',
      },
      {
        text: '「推荐」Tab 浏览列表，「我的」Tab 查看想去清单与评价记录。',
        target: '.tabbar',
        placement: 'top',
      },
    ];
  }

  function initGuide(api) {
    if (localStorage.getItem(STORAGE_KEY)) return null;

    const overlay = document.getElementById('guideOverlay');
    const backdrop = document.getElementById('guideBackdrop');
    const ring = document.getElementById('guideRing');
    const bubble = document.getElementById('guideBubble');
    const textEl = document.getElementById('guideText');
    const stepNumEl = overlay.querySelector('.guide-step-num');
    const btnNext = document.getElementById('btnGuideNext');
    const btnSkip = document.getElementById('btnGuideSkip');

    if (!overlay || !backdrop || !ring || !bubble) return null;

    const steps = buildSteps();
    let index = 0;
    let positioning = false;

    function finish() {
      localStorage.setItem(STORAGE_KEY, '1');
      overlay.hidden = true;
      overlay.classList.remove('active');
      api.closeAllOverlays();
    }

    function positionStep(step) {
      if (positioning) return;
      positioning = true;

      const app = document.getElementById('app');
      const target = document.querySelector(step.target);
      if (!target || !app) {
        backdrop.style.clipPath = 'none';
        ring.hidden = true;
        bubble.style.top = 'auto';
        bubble.style.bottom = '120px';
        positioning = false;
        return;
      }

      const appRect = app.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const pad = 6;
      const x = Math.max(0, rect.left - appRect.left - pad);
      const y = Math.max(0, rect.top - appRect.top - pad);
      const w = rect.width + pad * 2;
      const h = rect.height + pad * 2;
      const W = appRect.width;
      const H = appRect.height;

      backdrop.style.clipPath = `polygon(
        0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0,
        ${x}px ${y}px, ${x}px ${y + h}px, ${x + w}px ${y + h}px, ${x + w}px ${y}px, ${x}px ${y}px
      )`;

      ring.hidden = false;
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.style.width = `${w}px`;
      ring.style.height = `${h}px`;

      bubble.style.left = '16px';
      bubble.style.right = '16px';
      bubble.style.top = 'auto';
      bubble.style.bottom = 'auto';

      const bubbleH = bubble.offsetHeight || 110;
      const spaceBelow = H - (y + h) - 16;

      if (step.placement === 'top' || spaceBelow < bubbleH + 24) {
        bubble.style.bottom = `${H - y + 12}px`;
      } else {
        bubble.style.top = `${y + h + 12}px`;
      }

      positioning = false;
    }

    function showStep(i) {
      index = i;
      if (index >= steps.length) {
        finish();
        api.showToast('引导完成，开始探索吧！');
        return;
      }

      api.closeAllOverlays();
      api.switchTab('map');

      const step = steps[index];
      textEl.textContent = step.text;
      if (stepNumEl) stepNumEl.textContent = `${index + 1} / ${steps.length}`;
      btnNext.textContent = index === steps.length - 1 ? '开始探索' : '下一步';

      overlay.hidden = false;
      overlay.classList.add('active');

      requestAnimationFrame(() => positionStep(step));
    }

    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      showStep(index + 1);
    });

    btnSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      finish();
    });

    backdrop.addEventListener('click', finish);

    window.addEventListener('resize', () => {
      if (!overlay.hidden && index < steps.length) {
        positionStep(steps[index]);
      }
    });

    setTimeout(() => showStep(0), 500);
    return {
      restart() {
        localStorage.removeItem(STORAGE_KEY);
        showStep(0);
      },
    };
  }

  window.initGuide = initGuide;
})();
