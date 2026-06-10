(function () {
  'use strict';

  const ZOOM = { min: 0.85, max: 2.8, step: 0.28, wheel: 0.12 };

  const state = {
    selectedId: null,
    mapX: 0,
    mapY: 0,
    scale: 1,
    dragging: false,
    pinching: false,
    dragStart: { x: 0, y: 0, mapX: 0, mapY: 0 },
    pinchStart: { dist: 0, scale: 1, mapX: 0, mapY: 0, cx: 0, cy: 0 },
    activeTab: 'map',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const mapCanvas = $('#mapCanvas');
  const mapContent = $('.map-content');
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
    mapCanvas.style.transform = `translate(${state.mapX}px, ${state.mapY}px) scale(${state.scale})`;
  }

  /** 限制视口不超出地图边界（不出现地图外的空白） */
  function clampToBounds() {
    applyMapTransform();

    const wrap = $('.map-wrap');
    const wr = wrap.getBoundingClientRect();
    const cr = mapContent.getBoundingClientRect();

    let adjustX = 0;
    let adjustY = 0;

    if (cr.width <= wr.width + 1) {
      adjustX = (wr.left + wr.width / 2) - (cr.left + cr.width / 2);
    } else if (cr.left > wr.left + 0.5) {
      adjustX = wr.left - cr.left;
    } else if (cr.right < wr.right - 0.5) {
      adjustX = wr.right - cr.right;
    }

    if (cr.height <= wr.height + 1) {
      adjustY = (wr.top + wr.height / 2) - (cr.top + cr.height / 2);
    } else if (cr.top > wr.top + 0.5) {
      adjustY = wr.top - cr.top;
    } else if (cr.bottom < wr.bottom - 0.5) {
      adjustY = wr.bottom - cr.bottom;
    }

    if (Math.abs(adjustX) > 0.05 || Math.abs(adjustY) > 0.05) {
      state.mapX += adjustX;
      state.mapY += adjustY;
      applyMapTransform();
    }
  }

  function clampScale(value) {
    return Math.max(ZOOM.min, Math.min(ZOOM.max, value));
  }

  /** 以视口某点为中心缩放（clientX/Y 为屏幕坐标，可省略则取地图中心） */
  function zoomAt(nextScale, clientX, clientY) {
    const wrap = $('.map-wrap');
    const rect = wrap.getBoundingClientRect();
    const focalX = clientX != null ? clientX - rect.left : rect.width / 2;
    const focalY = clientY != null ? clientY - rect.top : rect.height / 2;

    const oldScale = state.scale;
    const newScale = clampScale(nextScale);
    if (Math.abs(newScale - oldScale) < 0.001) return;

    const ratio = newScale / oldScale;
    state.mapX = focalX - (focalX - state.mapX) * ratio;
    state.mapY = focalY - (focalY - state.mapY) * ratio;
    state.scale = newScale;
    clampToBounds();
  }

  function zoomBy(delta, clientX, clientY) {
    zoomAt(state.scale + delta, clientX, clientY);
  }

  function pinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function pinchCenter(touches, rect) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
  }

  function initMapGestures() {
    const wrap = $('.map-wrap');

    function onDragStart(clientX, clientY) {
      if (state.selectedId || state.pinching) return;
      state.dragging = true;
      state.dragStart = {
        x: clientX,
        y: clientY,
        mapX: state.mapX,
        mapY: state.mapY,
      };
      mapCanvas.classList.add('dragging');
    }

    function onDragMove(clientX, clientY) {
      if (!state.dragging || state.pinching) return;
      state.mapX = state.dragStart.mapX + (clientX - state.dragStart.x);
      state.mapY = state.dragStart.mapY + (clientY - state.dragStart.y);
      clampToBounds();
    }

    function onDragEnd() {
      state.dragging = false;
      mapCanvas.classList.remove('dragging');
      clampToBounds();
    }

    function onPinchStart(touches) {
      state.pinching = true;
      state.dragging = false;
      mapCanvas.classList.remove('dragging');
      const rect = wrap.getBoundingClientRect();
      const center = pinchCenter(touches, rect);
      state.pinchStart = {
        dist: pinchDistance(touches),
        scale: state.scale,
        mapX: state.mapX,
        mapY: state.mapY,
        cx: center.x,
        cy: center.y,
      };
    }

    function onPinchMove(touches) {
      if (!state.pinching || touches.length < 2) return;
      const dist = pinchDistance(touches);
      const ratio = dist / state.pinchStart.dist;
      const nextScale = clampScale(state.pinchStart.scale * ratio);
      const scaleRatio = nextScale / state.pinchStart.scale;
      state.scale = nextScale;
      state.mapX = state.pinchStart.cx - (state.pinchStart.cx - state.pinchStart.mapX) * scaleRatio;
      state.mapY = state.pinchStart.cy - (state.pinchStart.cy - state.pinchStart.mapY) * scaleRatio;
      clampToBounds();
    }

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.marker') || e.target.closest('.map-controls')) return;
      onDragStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onDragEnd);

    wrap.addEventListener('wheel', (e) => {
      if (state.selectedId) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM.wheel : ZOOM.wheel;
      zoomBy(delta, e.clientX, e.clientY);
    }, { passive: false });

    wrap.addEventListener('touchstart', (e) => {
      if (e.target.closest('.activity-sheet')) return;
      if (e.touches.length === 2) {
        onPinchStart(e.touches);
        return;
      }
      if (e.target.closest('.marker') || e.target.closest('.map-controls')) return;
      if (e.touches.length === 1) {
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && state.pinching) {
        e.preventDefault();
        onPinchMove(e.touches);
        return;
      }
      if (state.dragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    wrap.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        state.pinching = false;
      }
      if (e.touches.length === 0) {
        onDragEnd();
      } else if (e.touches.length === 1 && !state.pinching) {
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
  }

  function resetMapView() {
    state.mapX = 0;
    state.mapY = 0;
    state.scale = 1;
    clampToBounds();
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

    $('#btnZoomIn').addEventListener('click', (e) => {
      e.stopPropagation();
      zoomBy(ZOOM.step);
    });

    $('#btnZoomOut').addEventListener('click', (e) => {
      e.stopPropagation();
      zoomBy(-ZOOM.step);
    });

    $('#btnLocate').addEventListener('click', (e) => {
      e.stopPropagation();
      resetMapView();
    });
  }

  function init() {
    renderMarkers();
    initMapGestures();
    initTabs();
    initUI();
    clampToBounds();
    window.addEventListener('resize', clampToBounds);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
