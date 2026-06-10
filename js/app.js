(function () {
  'use strict';

  const state = {
    selectedId: null,
    mapX: 0,
    mapY: 0,
    dragging: false,
    dragStart: { x: 0, y: 0, mapX: 0, mapY: 0 },
    activeTab: 'map',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const mapCanvas = $('#mapCanvas');
  const markersLayer = $('#markersLayer');
  const sheet = $('#activitySheet');
  const backdrop = $('#sheetBackdrop');
  const toastEl = $('#toast');

  let toastTimer = null;

  function showToast(msg, duration = 2200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function getActivity(id) {
    return ACTIVITIES.find((a) => a.id === id);
  }

  function renderMarkers() {
    markersLayer.innerHTML = ACTIVITIES.map((act) => {
      const cat = CATEGORIES[act.category];
      const high = isHighScore(act);
      return `
        <div class="marker${high ? ' high' : ''}${state.selectedId === act.id ? ' selected' : ''}"
             data-id="${act.id}"
             style="left:${act.x}%;top:${act.y}%">
          <div class="marker-pin">
            <div class="marker-icon" style="background:${cat.color}">
              <span>${cat.icon}</span>
            </div>
            <div class="marker-badge">⭐</div>
            <div class="marker-label">${act.name}</div>
          </div>
        </div>`;
    }).join('');

    markersLayer.querySelectorAll('.marker').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openSheet(el.dataset.id);
      });
    });
  }

  function renderSheet(act) {
    const cat = CATEGORIES[act.category];
    const high = isHighScore(act);
    $('#sheetThumb').style.background = act.thumb;
    $('#sheetTitle').textContent = act.name;
    $('#sheetCategory').textContent = cat.label;
    $('#sheetDistance').textContent = act.distance;
    $('#sheetTime').textContent = act.time;
    $('#sheetTime').className = 'sheet-time ' + act.status;
    $('#sheetStars').innerHTML = renderStars(act.rating);
    $('#sheetRatingNum').textContent = act.rating.toFixed(1);
    $('#sheetReviewCount').textContent = `(${act.reviewCount}条评价)`;
    if (high) {
      $('#sheetRatingNum').style.color = '#D97706';
    } else {
      $('#sheetRatingNum').style.color = '';
    }
  }

  function openSheet(id) {
    const act = getActivity(id);
    if (!act) return;
    state.selectedId = id;
    renderMarkers();
    renderSheet(act);
    sheet.classList.add('show');
    backdrop.classList.add('show');
  }

  function closeSheet() {
    state.selectedId = null;
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    renderMarkers();
  }

  function applyMapTransform() {
    mapCanvas.style.transform = `translate(${state.mapX}px, ${state.mapY}px)`;
  }

  function clampMapPosition() {
    const wrap = $('.map-wrap');
    const maxX = wrap.clientWidth * 0.15;
    const maxY = wrap.clientHeight * 0.15;
    state.mapX = Math.max(-maxX, Math.min(maxX, state.mapX));
    state.mapY = Math.max(-maxY, Math.min(maxY, state.mapY));
  }

  function initMapDrag() {
    const wrap = $('.map-wrap');

    function onStart(clientX, clientY) {
      if (state.selectedId) return;
      state.dragging = true;
      state.dragStart = {
        x: clientX,
        y: clientY,
        mapX: state.mapX,
        mapY: state.mapY,
      };
      mapCanvas.classList.add('dragging');
    }

    function onMove(clientX, clientY) {
      if (!state.dragging) return;
      state.mapX = state.dragStart.mapX + (clientX - state.dragStart.x);
      state.mapY = state.dragStart.mapY + (clientY - state.dragStart.y);
      clampMapPosition();
      applyMapTransform();
    }

    function onEnd() {
      state.dragging = false;
      mapCanvas.classList.remove('dragging');
    }

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.marker')) return;
      onStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    wrap.addEventListener('touchstart', (e) => {
      if (e.target.closest('.marker') || e.target.closest('.activity-sheet')) return;
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
      if (!state.dragging) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    wrap.addEventListener('touchend', onEnd);
  }

  function resetMapView() {
    state.mapX = 0;
    state.mapY = 0;
    applyMapTransform();
    showToast('已回到当前位置');
  }

  function switchTab(tab) {
    state.activeTab = tab;
    $$('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    const mapPanel = $('#mapPanel');
    const recommendPanel = $('#recommendPanel');
    const profilePanel = $('#profilePanel');

    mapPanel.classList.toggle('hidden', tab !== 'map');
    recommendPanel.classList.toggle('show', tab === 'recommend');
    profilePanel.classList.toggle('show', tab === 'profile');

    if (tab !== 'map') closeSheet();
  }

  function initTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.tab;
        if (id === 'map') {
          switchTab('map');
        } else {
          switchTab(id);
          showToast(id === 'recommend' ? '推荐页将在 V2 开放' : '我的页将在 V4 开放');
        }
      });
    });
  }

  function initUI() {
    $('#mapCount').innerHTML = `共 <strong>${ACTIVITIES.length}</strong> 个附近活动`;

    $('#btnCloseSheet').addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);

    $('#btnDetail').addEventListener('click', () => {
      showToast('活动详情页将在 V2 开放');
    });

    $('#btnFilter').addEventListener('click', () => {
      showToast('类别筛选将在 V2 开放');
    });

    $('#btnLocate').addEventListener('click', resetMapView);
  }

  function init() {
    renderMarkers();
    initMapDrag();
    initTabs();
    initUI();
    applyMapTransform();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
