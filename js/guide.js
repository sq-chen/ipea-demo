(function () {
  'use strict';

  const STORAGE_KEY = 'ipea-guide-done';

  function buildSteps() {
    return [
      {
        text: '地图上的彩色标记代表附近活动。留意带 ⭐ 的金色光晕——那是高分好活动。',
        target: '#mapCanvas',
        placement: 'bottom',
        onEnter(api) {
          api.closeAllOverlays();
          api.switchTab('map');
        },
      },
      {
        text: '试试右上角「筛选」，按音乐、运动、展览等类别查找感兴趣的活动。',
        target: '#btnFilter',
        placement: 'bottom',
      },
      {
        text: '点击地图标记，可快速查看活动简介与评分。',
        target: '#activitySheet',
        placement: 'top',
        onEnter(api) {
          api.openSheet('a5');
        },
      },
      {
        text: '点「查看详情」进入完整页面，了解时间、地址与用户评价。',
        target: '#btnDetail',
        placement: 'top',
        onNext(api) {
          api.openDetail('a5');
        },
      },
      {
        text: '喜欢就点「想去」收藏（演示需登录）。登录后可同步到「我的」清单。',
        target: '#btnWant',
        placement: 'top',
      },
      {
        text: '到达现场后可「打卡」，再「写评价」分享体验，帮助其他人发现好活动。',
        target: '#detailActionCard',
        placement: 'top',
      },
    ];
  }

  function initGuide(api) {
    if (localStorage.getItem(STORAGE_KEY)) return null;

    const overlay = document.getElementById('guideOverlay');
    const mask = document.getElementById('guideMask');
    const bubble = document.getElementById('guideBubble');
    const textEl = document.getElementById('guideText');
    const stepNumEl = overlay.querySelector('.guide-step-num');
    const btnNext = document.getElementById('btnGuideNext');
    const btnSkip = document.getElementById('btnGuideSkip');

    const steps = buildSteps();
    let index = 0;

    function finish() {
      localStorage.setItem(STORAGE_KEY, '1');
      overlay.hidden = true;
      overlay.classList.remove('active');
      api.closeAllOverlays();
    }

    function positionStep(step) {
      const app = document.getElementById('app');
      const target = document.querySelector(step.target);
      if (!target || !app) {
        mask.style.display = 'none';
        bubble.style.top = 'auto';
        bubble.style.bottom = '100px';
        return;
      }

      const appRect = app.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const pad = 8;

      const left = rect.left - appRect.left - pad;
      const top = rect.top - appRect.top - pad;
      const width = rect.width + pad * 2;
      const height = rect.height + pad * 2;

      mask.style.display = 'block';
      mask.style.left = `${Math.max(4, left)}px`;
      mask.style.top = `${Math.max(4, top)}px`;
      mask.style.width = `${width}px`;
      mask.style.height = `${height}px`;

      bubble.style.left = '16px';
      bubble.style.right = '16px';
      bubble.style.top = 'auto';
      bubble.style.bottom = 'auto';

      const bubbleH = bubble.offsetHeight || 120;
      const spaceBelow = appRect.height - (top + height) - 16;
      const spaceAbove = top - 16;

      if (step.placement === 'top' || spaceBelow < bubbleH + 20) {
        bubble.style.bottom = `${appRect.height - top + 12}px`;
      } else {
        bubble.style.top = `${top + height + 12}px`;
      }
    }

    function showStep(i) {
      index = i;
      if (index >= steps.length) {
        finish();
        api.showToast('引导完成，开始探索吧！');
        return;
      }

      const step = steps[index];
      if (step.onEnter) step.onEnter(api);

      textEl.textContent = step.text;

      const stepNum = stepNumEl;
      if (stepNum) stepNum.textContent = `${index + 1} / ${steps.length}`;

      btnNext.textContent = index === steps.length - 1 ? '开始探索' : '下一步';

      overlay.hidden = false;
      overlay.classList.add('active');

      const delay = step.onEnter ? 320 : 0;
      setTimeout(() => {
        requestAnimationFrame(() => positionStep(step));
      }, delay);
    }

    btnNext.addEventListener('click', () => {
      const step = steps[index];
      if (step.onNext) step.onNext(api);
      showStep(index + 1);
    });

    btnSkip.addEventListener('click', finish);

    window.addEventListener('resize', () => {
      if (!overlay.hidden && index < steps.length) {
        positionStep(steps[index]);
      }
    });

    setTimeout(() => showStep(0), 600);
    return { restart: () => { localStorage.removeItem(STORAGE_KEY); showStep(0); } };
  }

  window.initGuide = initGuide;
})();
