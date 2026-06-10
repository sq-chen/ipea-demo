(function () {
  'use strict';

  const ZOOM = { min: 0.85, max: 2.8, step: 0.28, wheel: 0.12 };
  const CATEGORY_KEYS = Object.keys(CATEGORIES);
  const MARKER_HIT_RADIUS = 5.5;
  const TAP_MOVE_THRESHOLD = 8;

  const state = {
    selectedId: null,
    detailId: null,
    mapX: 0,
    mapY: 0,
    scale: 1,
    dragging: false,
    pinching: false,
    mapDidMove: false,
    dragPointer: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0, mapX: 0, mapY: 0 },
    pinchStart: { dist: 0, scale: 1, mapX: 0, mapY: 0, cx: 0, cy: 0 },
    activeTab: 'map',
    filterCategories: null,
    filterDraft: new Set(),
    wantList: new Set(),
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const app = $('#app');
  const mapCanvas = $('#mapCanvas');
  const mapContent = $('.map-content');
  const markersLayer = $('#markersLayer');
  const sheet = $('#activitySheet');
  const clusterSheet = $('#clusterSheet');
  const backdrop = $('#sheetBackdrop');
  const toastEl = $('#toast');

  let toastTimer = null;
  let suppressMarkerClickUntil = 0;

  function showToast(msg, duration = 2200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function getActivity(id) {
    return ACTIVITIES.find((a) => a.id === id);
  }

  function getFilteredActivities() {
    if (!state.filterCategories || state.filterCategories.size === 0) {
      return ACTIVITIES;
    }
    return ACTIVITIES.filter((a) => state.filterCategories.has(a.category));
  }

  function isFilterActive() {
    return state.filterCategories && state.filterCategories.size > 0
      && state.filterCategories.size < CATEGORY_KEYS.length;
  }

  function updateMapCount() {
    const list = getFilteredActivities();
    const el = $('#mapCount');
    if (isFilterActive()) {
      el.innerHTML = `筛选结果 <strong>${list.length}</strong> 个活动`;
    } else {
      el.innerHTML = `共 <strong>${list.length}</strong> 个附近活动`;
    }
  }

  function updateFilterBar() {
    const bar = $('#filterBar');
    if (isFilterActive()) {
      const n = getFilteredActivities().length;
      $('#filterBarText').textContent = `找到 ${n} 个活动`;
      bar.hidden = false;
      $('#btnFilter').classList.add('active-filter');
    } else {
      bar.hidden = true;
      $('#btnFilter').classList.remove('active-filter');
    }
  }

  function getMapPercentFromClient(clientX, clientY) {
    const rect = mapContent.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  function getMarkersNearPoint(clientX, clientY, hitRadius = MARKER_HIT_RADIUS) {
    const pt = getMapPercentFromClient(clientX, clientY);
    return getFilteredActivities()
      .filter((act) => {
        const pos = MARKER_LAYOUT.get(act.id);
        if (!pos) return false;
        return Math.hypot(pos.x - pt.x, pos.y - pt.y) <= hitRadius;
      })
      .sort((a, b) => {
        const pa = MARKER_LAYOUT.get(a.id);
        const pb = MARKER_LAYOUT.get(b.id);
        return Math.hypot(pa.x - pt.x, pa.y - pt.y) - Math.hypot(pb.x - pt.x, pb.y - pt.y);
      });
  }

  function handleMarkerTap(clientX, clientY) {
    const nearby = getMarkersNearPoint(clientX, clientY);
    if (nearby.length === 0) return;
    if (nearby.length === 1) openSheet(nearby[0].id);
    else openClusterPicker(nearby);
  }

  function renderMarkers() {
    const visible = getFilteredActivities();
    const visibleIds = new Set(visible.map((a) => a.id));

    markersLayer.innerHTML = ACTIVITIES.map((act, idx) => {
      if (!visibleIds.has(act.id)) return '';
      const cat = CATEGORIES[act.category];
      const high = isHighScore(act);
      const pos = MARKER_LAYOUT.get(act.id) || { x: act.x, y: act.y };
      const z = state.selectedId === act.id ? 30 : 10 + idx;
      return `
        <div class="marker${high ? ' high' : ''}${state.selectedId === act.id ? ' selected' : ''}"
             data-id="${act.id}"
             style="left:${pos.x}%;top:${pos.y}%;z-index:${z}">
          <div class="marker-pin">
            <div class="marker-icon" style="background:${cat.color}">
              <span>${cat.icon}</span>
            </div>
            <div class="marker-badge">⭐</div>
            <div class="marker-label">${act.name}</div>
            <div class="marker-hit" aria-hidden="true"></div>
          </div>
        </div>`;
    }).join('');

    updateMapCount();
    updateFilterBar();
  }

  function openClusterPicker(activities) {
    closeSheet();
    $('#clusterTitle').textContent = `此区域有 ${activities.length} 个活动`;
    $('#clusterList').innerHTML = activities.map((act) => {
      const cat = CATEGORIES[act.category];
      return `
        <button type="button" class="cluster-item" data-id="${act.id}">
          <div class="cluster-item-icon" style="background:${cat.color}">${cat.icon}</div>
          <div class="cluster-item-info">
            <div class="cluster-item-name">${act.name}</div>
            <div class="cluster-item-meta">${cat.label} · ${act.distance} · ★ ${act.rating.toFixed(1)}</div>
          </div>
        </button>`;
    }).join('');

    $$('#clusterList .cluster-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeClusterPicker();
        openSheet(btn.dataset.id);
      });
    });

    clusterSheet.classList.add('show');
    backdrop.classList.add('show');
  }

  function closeClusterPicker() {
    clusterSheet.classList.remove('show');
    if (!state.selectedId) backdrop.classList.remove('show');
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
    $('#sheetRatingNum').style.color = high ? '#D97706' : '';
  }

  function openSheet(id) {
    const act = getActivity(id);
    if (!act) return;
    closeClusterPicker();
    state.selectedId = id;
    renderMarkers();
    renderSheet(act);
    sheet.classList.add('show');
    backdrop.classList.add('show');
  }

  function closeSheet() {
    state.selectedId = null;
    sheet.classList.remove('show');
    clusterSheet.classList.remove('show');
    backdrop.classList.remove('show');
    renderMarkers();
  }

  function renderDetail(id) {
    const act = getActivity(id);
    if (!act) return;
    const cat = CATEGORIES[act.category];
    const comments = getComments(id);

    $('#detailHero').style.background = act.thumb;
    $('#detailTitle').textContent = act.name;
    $('#detailStatus').textContent = act.status === 'ongoing' ? '进行中' : '即将开始';
    $('#detailStatus').className = 'detail-status ' + act.status;
    $('#detailOrganizer').textContent = `主办方：${getOrganizer(id)} · ${cat.icon} ${cat.label}`;
    $('#detailRatingBig').textContent = act.rating.toFixed(1);
    $('#detailStars').innerHTML = renderStars(act.rating);
    $('#detailReviewTotal').textContent = `${act.reviewCount} 条评价`;
    $('#detailTime').textContent = act.time;
    $('#detailAddress').textContent = act.address;
    $('#detailDesc').textContent = act.desc;
    $('#detailCommentCount').textContent = `共 ${comments.length} 条`;

    $('#commentList').innerHTML = comments.map((c) => `
      <div class="comment-item">
        <div class="comment-top">
          <span>
            <span class="comment-user">${c.user}</span>
            ${c.verified ? '<span class="comment-verified">已验证参与</span>' : ''}
          </span>
          <span class="comment-meta">${c.time}</span>
        </div>
        <div class="comment-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</div>
        <p class="comment-text">${c.text}</p>
        <div class="comment-foot">👍 ${c.likes} 人觉得有帮助</div>
      </div>
    `).join('');

    const wantBtn = $('#btnWant');
    if (state.wantList.has(id)) {
      wantBtn.textContent = '已想去';
      wantBtn.classList.add('active');
    } else {
      wantBtn.textContent = '想去';
      wantBtn.classList.remove('active');
    }
  }

  function openDetail(id) {
    closeSheet();
    closeFilterPanel();
    state.detailId = id;
    renderDetail(id);
    $('#detailPage').hidden = false;
    app.classList.add('detail-open');
    $('#detailScroll').scrollTop = 0;
  }

  function closeDetail() {
    state.detailId = null;
    $('#detailPage').hidden = true;
    app.classList.remove('detail-open');
  }

  function renderFilterChips() {
    $('#filterChips').innerHTML = CATEGORY_KEYS.map((key) => {
      const cat = CATEGORIES[key];
      const on = state.filterDraft.has(key);
      return `
        <button type="button" class="filter-chip${on ? ' on' : ''}" data-cat="${key}">
          <span>${cat.icon}</span>
          <span>${cat.label}</span>
        </button>`;
    }).join('');

    $$('#filterChips .filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.cat;
        if (state.filterDraft.has(key)) {
          state.filterDraft.delete(key);
          chip.classList.remove('on');
        } else {
          state.filterDraft.add(key);
          chip.classList.add('on');
        }
      });
    });
  }

  function openFilterPanel() {
    if (state.filterCategories && state.filterCategories.size > 0) {
      state.filterDraft = new Set(state.filterCategories);
    } else {
      state.filterDraft = new Set(CATEGORY_KEYS);
    }
    renderFilterChips();
    $('#filterPanel').classList.add('show');
    $('#filterBackdrop').classList.add('show');
  }

  function closeFilterPanel() {
    $('#filterPanel').classList.remove('show');
    $('#filterBackdrop').classList.remove('show');
  }

  function applyFilter() {
    if (state.filterDraft.size === 0 || state.filterDraft.size === CATEGORY_KEYS.length) {
      state.filterCategories = null;
    } else {
      state.filterCategories = new Set(state.filterDraft);
    }
    closeFilterPanel();
    closeSheet();
    renderMarkers();
    renderRecommendList();
    const n = getFilteredActivities().length;
    showToast(state.filterCategories ? `已筛选，找到 ${n} 个活动` : '已显示全部活动');
  }

  function resetFilterDraft() {
    state.filterDraft = new Set(CATEGORY_KEYS);
    renderFilterChips();
  }

  function clearFilter() {
    state.filterCategories = null;
    closeSheet();
    renderMarkers();
    renderRecommendList();
    showToast('已清除筛选');
  }

  function getRecommendList() {
    return [...getFilteredActivities()]
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      .slice(0, 8);
  }

  function renderRecommendList() {
    const list = getRecommendList();
    const el = $('#recommendList');
    if (list.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--muted);padding:32px;font-size:14px">暂无符合筛选条件的活动</p>';
      return;
    }

    el.innerHTML = list.map((act) => {
      const cat = CATEGORIES[act.category];
      return `
        <div class="recommend-card" data-id="${act.id}">
          <div class="recommend-thumb" style="background:${act.thumb}"></div>
          <div class="recommend-info">
            <div class="recommend-name">${act.name}</div>
            <div class="recommend-highlight">${getHighlight(act.id)}</div>
            <div class="recommend-meta">
              <span>${cat.icon} ${cat.label}</span>
              <span>${act.time}</span>
              <span>${act.distance}</span>
              <span class="rating">★ ${act.rating.toFixed(1)}</span>
            </div>
            <button type="button" class="recommend-map-link" data-map-id="${act.id}">在地图上查看</button>
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.recommend-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.recommend-map-link')) return;
        openDetail(card.dataset.id);
      });
    });

    el.querySelectorAll('.recommend-map-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchTab('map');
        openSheet(btn.dataset.mapId);
      });
    });
  }

  function toggleWant(id) {
    if (state.wantList.has(id)) {
      state.wantList.delete(id);
      showToast('已取消想去');
    } else {
      state.wantList.add(id);
      showToast('已加入想去清单（演示）');
    }
    if (state.detailId === id) renderDetail(id);
  }

  function applyMapTransform() {
    mapCanvas.style.transform = `translate(${state.mapX}px, ${state.mapY}px) scale(${state.scale})`;
  }

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

    function tryMarkerTap(clientX, clientY) {
      if (state.mapDidMove) return;
      const nearby = getMarkersNearPoint(clientX, clientY);
      if (nearby.length === 0) return;
      handleMarkerTap(clientX, clientY);
    }

    function onDragStart(clientX, clientY) {
      if (state.selectedId || state.pinching || state.detailId) return;
      state.dragging = true;
      state.mapDidMove = false;
      state.dragPointer = { x: clientX, y: clientY };
      state.dragStart = { x: clientX, y: clientY, mapX: state.mapX, mapY: state.mapY };
      mapCanvas.classList.add('dragging');
    }

    function onDragMove(clientX, clientY) {
      if (!state.dragging || state.pinching) return;
      if (Math.hypot(clientX - state.dragPointer.x, clientY - state.dragPointer.y) > TAP_MOVE_THRESHOLD) {
        state.mapDidMove = true;
      }
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
      const nextScale = clampScale(state.pinchStart.scale * (dist / state.pinchStart.dist));
      const scaleRatio = nextScale / state.pinchStart.scale;
      state.scale = nextScale;
      state.mapX = state.pinchStart.cx - (state.pinchStart.cx - state.pinchStart.mapX) * scaleRatio;
      state.mapY = state.pinchStart.cy - (state.pinchStart.cy - state.pinchStart.mapY) * scaleRatio;
      clampToBounds();
    }

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.map-controls') || e.target.closest('.filter-bar')) return;
      onDragStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onDragEnd);

    wrap.addEventListener('wheel', (e) => {
      if (state.selectedId || state.detailId) return;
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? -ZOOM.wheel : ZOOM.wheel, e.clientX, e.clientY);
    }, { passive: false });

    wrap.addEventListener('touchstart', (e) => {
      if (e.target.closest('.activity-sheet') || e.target.closest('.filter-bar')) return;
      if (e.touches.length === 2) {
        onPinchStart(e.touches);
        return;
      }
      if (e.target.closest('.map-controls')) return;
      if (e.touches.length === 1) onDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.map-controls') || e.target.closest('.filter-bar')) return;
      if (Date.now() < suppressMarkerClickUntil) return;
      tryMarkerTap(e.clientX, e.clientY);
    });

    wrap.addEventListener('touchend', (e) => {
      if (state.mapDidMove || state.pinching) return;
      if (e.changedTouches.length !== 1) return;
      if (e.target.closest('.map-controls') || e.target.closest('.filter-bar')) return;
      const t = e.changedTouches[0];
      suppressMarkerClickUntil = Date.now() + 400;
      tryMarkerTap(t.clientX, t.clientY);
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
      if (e.touches.length < 2) state.pinching = false;
      if (e.touches.length === 0) onDragEnd();
      else if (e.touches.length === 1 && !state.pinching) {
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
    if (state.detailId) closeDetail();
    state.activeTab = tab;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));

    $('#mapPanel').classList.toggle('hidden', tab !== 'map');
    $('#recommendPanel').classList.toggle('show', tab === 'recommend');
    $('#profilePanel').classList.toggle('show', tab === 'profile');

    if (tab !== 'map') closeSheet();
    if (tab === 'recommend') renderRecommendList();
  }

  function initTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.tab;
        if (id === 'profile') {
          switchTab('profile');
          showToast('我的页将在 V4 开放');
        } else {
          switchTab(id);
        }
      });
    });
  }

  function initUI() {
    $('#btnCloseSheet').addEventListener('click', closeSheet);
    backdrop.addEventListener('click', () => {
      closeSheet();
      closeClusterPicker();
    });
    $('#btnClusterClose').addEventListener('click', closeClusterPicker);

    $('#btnDetail').addEventListener('click', () => {
      if (state.selectedId) openDetail(state.selectedId);
    });

    $('#btnFilter').addEventListener('click', openFilterPanel);
    $('#btnFilterClose').addEventListener('click', closeFilterPanel);
    $('#filterBackdrop').addEventListener('click', closeFilterPanel);
    $('#btnFilterReset').addEventListener('click', resetFilterDraft);
    $('#btnFilterApply').addEventListener('click', applyFilter);
    $('#btnClearFilter').addEventListener('click', clearFilter);

    $('#btnDetailBack').addEventListener('click', closeDetail);
    $('#btnNav').addEventListener('click', () => showToast('已打开地图导航（演示）'));
    $('#btnShare').addEventListener('click', () => showToast('分享链接已复制（演示）'));
    $('#btnWant').addEventListener('click', () => {
      if (state.detailId) toggleWant(state.detailId);
    });

    $('#btnZoomIn').addEventListener('click', (e) => { e.stopPropagation(); zoomBy(ZOOM.step); });
    $('#btnZoomOut').addEventListener('click', (e) => { e.stopPropagation(); zoomBy(-ZOOM.step); });
    $('#btnLocate').addEventListener('click', (e) => { e.stopPropagation(); resetMapView(); });
  }

  function init() {
    renderMarkers();
    renderRecommendList();
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
