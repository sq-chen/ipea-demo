(function () {
  'use strict';

  const ZOOM = { min: 0.85, max: 2.8, step: 0.28, wheel: 0.12 };
  const CATEGORY_KEYS = Object.keys(CATEGORIES);
  const MARKER_HIT_RADIUS = 5.5;
  const IS_TOUCH_DEVICE = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  /** 超过此距离才算拖动；真机手指抖动大，阈值需更高 */
  const TAP_MOVE_THRESHOLD = IS_TOUCH_DEVICE ? 18 : 8;
  const TAP_SLOP = IS_TOUCH_DEVICE ? 14 : 8;

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
    filterTime: null,
    filterDistance: null,
    filterRating: null,
    filterPrice: null,
    filterDraft: new Set(),
    filterDraftTime: null,
    filterDraftDistance: null,
    filterDraftRating: null,
    filterDraftPrice: null,
    user: null,
    wantList: new Set(),
    checkinList: new Set(),
    ticketList: new Set(),
    userPoints: 0,
    userReviews: new Map(),
    pendingLoginCallback: null,
    profileSeg: 'want',
    reviewRating: 5,
    helpfulMarked: new Set(),
    helpfulExtra: new Map(),
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

  function closeAllOverlays() {
    closeSheet();
    closeClusterPicker();
    closeFilterPanel();
    closeLoginModal();
    closeReviewSheet();
  }

  function closeGuideLayers() {
    closeFilterPanel();
    closeLoginModal();
    closeReviewSheet();
  }

  let guideCtrl = null;

  function notifyGuide(event) {
    guideCtrl?.onUserAction(event);
  }

  function openLoginModal() {
    $('#loginBackdrop').classList.add('show');
    $('#loginModal').classList.add('show');
  }

  function closeLoginModal() {
    $('#loginBackdrop').classList.remove('show');
    $('#loginModal').classList.remove('show');
    state.pendingLoginCallback = null;
  }

  function mockLogin() {
    state.user = { name: '小橙', avatar: '🍊', badges: [] };
    closeLoginModal();
    showToast('登录成功，欢迎回来！');
    if (state.pendingLoginCallback) {
      const cb = state.pendingLoginCallback;
      state.pendingLoginCallback = null;
      cb();
    }
    renderProfileHeader();
    if (state.activeTab === 'profile') renderProfileContent();
  }

  function requireLogin(onSuccess) {
    if (state.user) {
      onSuccess();
      return;
    }
    state.pendingLoginCallback = onSuccess;
    openLoginModal();
  }

  function getActivity(id) {
    return ACTIVITIES.find((a) => a.id === id);
  }

  function matchesTimeFilter(act, timeFilter) {
    if (!timeFilter) return true;
    if (timeFilter === 'week') return act.timeFilter !== 'ongoing';
    return act.timeFilter === timeFilter;
  }

  function activityMatchesFilters(act) {
    if (state.filterCategories && state.filterCategories.size > 0
      && !state.filterCategories.has(act.category)) {
      return false;
    }
    if (!matchesTimeFilter(act, state.filterTime)) return false;
    if (state.filterDistance != null && act.distanceKm > state.filterDistance) return false;
    if (state.filterRating != null && act.rating < state.filterRating) return false;
    if (state.filterPrice === 'free' && act.paid) return false;
    if (state.filterPrice === 'paid' && !act.paid) return false;
    return true;
  }

  function getFilteredActivities() {
    const hasCat = state.filterCategories && state.filterCategories.size > 0;
    const hasExtra = state.filterTime || state.filterDistance != null
      || state.filterRating != null || state.filterPrice;
    if (!hasCat && !hasExtra) return ACTIVITIES;
    return ACTIVITIES.filter(activityMatchesFilters);
  }

  function isFilterActive() {
    const catActive = state.filterCategories && state.filterCategories.size > 0
      && state.filterCategories.size < CATEGORY_KEYS.length;
    return catActive || !!state.filterTime || state.filterDistance != null
      || state.filterRating != null || !!state.filterPrice;
  }

  function getJoinedIds() {
    return new Set([...state.checkinList, ...state.ticketList]);
  }

  function getInterestCategories() {
    const counts = {};
    state.wantList.forEach((id) => {
      const act = getActivity(id);
      if (act) counts[act.category] = (counts[act.category] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);
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
    applyThumb($('#sheetThumb'), act.thumb);
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
    notifyGuide('marker-tap');
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
    const userReview = state.userReviews.get(id);
    const checkedIn = state.checkinList.has(id);

    applyThumb($('#detailHero'), act.thumb);
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

    const live = getLiveUpdates(id);
    const liveSection = $('#detailLiveSection');
    if (live && live.length) {
      liveSection.hidden = false;
      $('#liveFeed').innerHTML = live.map((item) => `
        <div class="live-item">
          <div class="live-item-top">
            <span class="live-user">${item.user}</span>
            <span class="live-time">${item.time}</span>
          </div>
          <p class="live-text">${item.text}</p>
        </div>`).join('');
    } else {
      liveSection.hidden = true;
    }

    $('#detailCommentCount').textContent = `共 ${comments.length + (userReview ? 1 : 0)} 条`;

    const ticketBtn = $('#btnBuyTicket');
    if (act.paid) {
      ticketBtn.hidden = false;
      if (state.ticketList.has(id)) {
        ticketBtn.textContent = '已购票';
        ticketBtn.classList.add('done');
        ticketBtn.disabled = true;
      } else {
        ticketBtn.textContent = act.priceLabel ? `购票 ${act.priceLabel}` : '立即购票';
        ticketBtn.classList.remove('done');
        ticketBtn.disabled = false;
      }
    } else {
      ticketBtn.hidden = true;
    }

    const checkinBtn = $('#btnCheckin');
    const reviewBtn = $('#btnReview');
    if (checkedIn) {
      checkinBtn.classList.add('done');
      $('#btnCheckinLabel').textContent = '已打卡';
      $('#btnCheckinHint').textContent = '感谢到场参与';
    } else {
      checkinBtn.classList.remove('done');
      $('#btnCheckinLabel').textContent = '现场打卡';
      $('#btnCheckinHint').textContent = '到达活动现场后打卡';
    }

    if (userReview) {
      reviewBtn.classList.add('done');
      reviewBtn.classList.remove('disabled');
      $('#btnReviewLabel').textContent = '已评价';
      $('#btnReviewHint').textContent = '可在「我的」查看';
    } else if (!checkedIn) {
      reviewBtn.classList.remove('done');
      reviewBtn.classList.add('disabled');
      $('#btnReviewLabel').textContent = '写评价';
      $('#btnReviewHint').textContent = '请先现场打卡';
    } else {
      reviewBtn.classList.remove('done', 'disabled');
      $('#btnReviewLabel').textContent = '写评价';
      $('#btnReviewHint').textContent = '分享你的参与体验';
    }

    let commentHtml = '';
    if (userReview) {
      commentHtml += `
      <div class="comment-item mine">
        <div class="comment-top">
          <span>
            <span class="comment-user">${state.user.name}</span>
            <span class="comment-mine-tag">我的评价</span>
            <span class="comment-verified">已验证参与</span>
          </span>
          <span class="comment-meta">${userReview.time}</span>
        </div>
        <div class="comment-stars">${'★'.repeat(userReview.rating)}${'☆'.repeat(5 - userReview.rating)}</div>
        <p class="comment-text">${userReview.text}</p>
      </div>`;
    }

    commentHtml += comments.map((c, idx) => {
      const key = `${id}-${idx}`;
      const marked = state.helpfulMarked.has(key);
      const extra = state.helpfulExtra.get(key) || 0;
      const likes = c.likes + extra;
      return `
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
        <div class="comment-foot">
          <button type="button" class="comment-helpful-btn${marked ? ' on' : ''}" data-key="${key}">
            <span class="comment-helpful-icon">${marked ? '✓' : '👍'}</span>
            <span>${marked ? '已标记有帮助' : '有帮助'}</span>
            <span class="comment-helpful-count">${likes}</span>
          </button>
        </div>
      </div>`;
    }).join('');

    $('#commentList').innerHTML = commentHtml;

    $$('#commentList .comment-helpful-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleCommentHelpful(btn.dataset.key));
    });

    const wantBtn = $('#btnWant');
    if (state.wantList.has(id)) {
      wantBtn.textContent = '已想去';
      wantBtn.classList.add('active');
    } else {
      wantBtn.textContent = '想去';
      wantBtn.classList.remove('active');
    }
  }

  function toggleCommentHelpful(key) {
    if (state.helpfulMarked.has(key)) {
      state.helpfulMarked.delete(key);
      state.helpfulExtra.delete(key);
    } else {
      state.helpfulMarked.add(key);
      state.helpfulExtra.set(key, 1);
      showToast('感谢反馈！');
    }
    if (state.detailId) renderDetail(state.detailId);
  }

  function openDetail(id) {
    closeSheet();
    closeFilterPanel();
    state.detailId = id;
    renderDetail(id);
    $('#detailPage').hidden = false;
    app.classList.add('detail-open');
    $('#detailScroll').scrollTop = 0;
    notifyGuide('detail-open');
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

  function renderFilterRadioGroup(containerId, options, draftValue, onChange) {
    const el = $(containerId);
    el.innerHTML = options.map((opt) => {
      const on = draftValue === opt.value;
      return `
        <button type="button" class="filter-chip filter-chip-radio${on ? ' on' : ''}"
                data-value="${opt.value === null ? '' : opt.value}">
          ${opt.label}
        </button>`;
    }).join('');

    el.querySelectorAll('.filter-chip-radio').forEach((chip) => {
      chip.addEventListener('click', () => {
        const raw = chip.dataset.value;
        let val = null;
        if (raw !== '') {
          if (['free', 'paid', 'ongoing', 'today', 'weekend', 'week'].includes(raw)) {
            val = raw;
          } else if (raw.includes('.')) {
            val = parseFloat(raw);
          } else {
            val = Number(raw);
          }
        }
        onChange(draftValue === val ? null : val);
        renderFilterPanel();
      });
    });
  }

  function renderFilterPanel() {
    renderFilterChips();
    renderFilterRadioGroup('#filterTimeChips', [
      { value: null, label: '不限' },
      { value: 'ongoing', label: '进行中' },
      { value: 'today', label: '今天' },
      { value: 'weekend', label: '本周末' },
      { value: 'week', label: '本周' },
    ], state.filterDraftTime, (v) => { state.filterDraftTime = v; });

    renderFilterRadioGroup('#filterDistanceChips', [
      { value: null, label: '不限' },
      { value: 1, label: '<1km' },
      { value: 5, label: '5km' },
      { value: 10, label: '10km' },
    ], state.filterDraftDistance, (v) => { state.filterDraftDistance = v; });

    renderFilterRadioGroup('#filterRatingChips', [
      { value: null, label: '不限' },
      { value: 3.5, label: '≥3.5' },
      { value: 4.0, label: '≥4.0' },
      { value: 4.5, label: '≥4.5' },
    ], state.filterDraftRating, (v) => { state.filterDraftRating = v; });

    renderFilterRadioGroup('#filterPriceChips', [
      { value: null, label: '全部' },
      { value: 'free', label: '免费' },
      { value: 'paid', label: '付费' },
    ], state.filterDraftPrice, (v) => { state.filterDraftPrice = v; });
  }

  function syncFilterDraftFromActive() {
    if (state.filterCategories && state.filterCategories.size > 0) {
      state.filterDraft = new Set(state.filterCategories);
    } else {
      state.filterDraft = new Set(CATEGORY_KEYS);
    }
    state.filterDraftTime = state.filterTime;
    state.filterDraftDistance = state.filterDistance;
    state.filterDraftRating = state.filterRating;
    state.filterDraftPrice = state.filterPrice;
  }

  function openFilterPanel() {
    syncFilterDraftFromActive();
    renderFilterPanel();
    $('#filterPanel').classList.add('show');
    $('#filterBackdrop').classList.add('show');
    notifyGuide('filter-open');
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
    state.filterTime = state.filterDraftTime || null;
    state.filterDistance = state.filterDraftDistance ?? null;
    state.filterRating = state.filterDraftRating ?? null;
    state.filterPrice = state.filterDraftPrice || null;
    closeFilterPanel();
    closeSheet();
    renderMarkers();
    renderRecommendList();
    const n = getFilteredActivities().length;
    showToast(isFilterActive() ? `已筛选，找到 ${n} 个活动` : '已显示全部活动');
  }

  function resetFilterDraft() {
    state.filterDraft = new Set(CATEGORY_KEYS);
    state.filterDraftTime = null;
    state.filterDraftDistance = null;
    state.filterDraftRating = null;
    state.filterDraftPrice = null;
    renderFilterPanel();
  }

  function clearFilter() {
    state.filterCategories = null;
    state.filterTime = null;
    state.filterDistance = null;
    state.filterRating = null;
    state.filterPrice = null;
    closeSheet();
    renderMarkers();
    renderRecommendList();
    showToast('已清除筛选');
  }

  function renderRecommendHeader() {
    const interests = getInterestCategories();
    const titleEl = $('#recommendHeaderTitle');
    const subEl = $('#recommendHeaderSub');
    if (interests.length > 0) {
      const cat = CATEGORIES[interests[0]];
      titleEl.textContent = `下午好，猜你喜欢${cat.label}类活动`;
      subEl.textContent = '根据你的「想去」偏好推荐';
    } else {
      titleEl.textContent = '下午好，为你推荐附近的好活动';
      subEl.textContent = '基于你的位置与热门活动';
    }
  }

  function getRecommendList() {
    const interests = getInterestCategories();
    const primary = interests[0];
    return [...getFilteredActivities()]
      .sort((a, b) => {
        const aPref = primary && a.category === primary ? 1 : 0;
        const bPref = primary && b.category === primary ? 1 : 0;
        if (bPref !== aPref) return bPref - aPref;
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
      })
      .slice(0, 8);
  }

  function renderRecommendList() {
    renderRecommendHeader();
    const list = getRecommendList();
    const el = $('#recommendList');
    if (list.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--muted);padding:32px;font-size:14px">暂无符合筛选条件的活动</p>';
      return;
    }

    el.innerHTML = list.map((act) => {
      const cat = CATEGORIES[act.category];
      const thumbStyleStr = thumbStyle(act.thumb);
      return `
        <div class="recommend-card" data-id="${act.id}">
          <div class="recommend-thumb" style="${thumbStyleStr}"></div>
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
    requireLogin(() => {
      if (state.wantList.has(id)) {
        state.wantList.delete(id);
        showToast('已取消想去');
      } else {
        state.wantList.add(id);
        showToast('已加入想去清单，活动开始前会提醒你');
      }
      if (state.detailId === id) renderDetail(id);
      if (state.activeTab === 'profile') renderProfileContent();
      if (state.activeTab === 'recommend') renderRecommendList();
    });
  }

  function buyTicket(id) {
    requireLogin(() => {
      if (state.ticketList.has(id)) {
        showToast('你已经购过票了');
        return;
      }
      const act = getActivity(id);
      state.ticketList.add(id);
      showToast(`购票成功！${act.name} 已加入「我的活动」`);
      if (state.detailId === id) renderDetail(id);
      if (state.activeTab === 'profile') renderProfileContent();
    });
  }

  function doCheckin(id) {
    requireLogin(() => {
      if (state.checkinList.has(id)) {
        showToast('你已经打卡过了');
        return;
      }
      state.checkinList.add(id);
      showToast('打卡成功！欢迎写评价');
      if (state.detailId === id) renderDetail(id);
      if (state.activeTab === 'profile') renderProfileContent();
    });
  }

  function renderReviewStars() {
    $('#reviewStarsPick').innerHTML = [1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="review-star-btn${n <= state.reviewRating ? ' on' : ''}" data-star="${n}">★</button>`
    ).join('');

    $$('#reviewStarsPick .review-star-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.reviewRating = Number(btn.dataset.star);
        renderReviewStars();
      });
    });
  }

  function openReviewSheet(id) {
    if (!state.user) {
      requireLogin(() => openReviewSheet(id));
      return;
    }
    if (!state.checkinList.has(id)) {
      showToast('请先现场打卡');
      return;
    }
    if (state.userReviews.has(id)) {
      showToast('你已经评价过了');
      return;
    }
    const act = getActivity(id);
    if (!act) return;
    state.reviewTargetId = id;
    state.reviewRating = 5;
    $('#reviewActName').textContent = act.name;
    $('#reviewInput').value = '';
    renderReviewStars();
    $('#reviewBackdrop').classList.add('show');
    $('#reviewSheet').classList.add('show');
  }

  function closeReviewSheet() {
    state.reviewTargetId = null;
    $('#reviewBackdrop').classList.remove('show');
    $('#reviewSheet').classList.remove('show');
  }

  function submitReview() {
    const id = state.reviewTargetId;
    if (!id) return;
    const text = $('#reviewInput').value.trim();
    if (!text) {
      showToast('请写几句体验感受');
      return;
    }

    const act = getActivity(id);
    const rating = state.reviewRating;
    const oldCount = act.reviewCount;
    act.reviewCount += 1;
    act.rating = ((act.rating * oldCount) + rating) / act.reviewCount;

    state.userReviews.set(id, {
      rating,
      text,
      time: '刚刚',
    });

    state.userPoints += 10;
    const reviewTotal = state.userReviews.size;
    const earnedBadge = reviewTotal >= 3 && !(state.user.badges && state.user.badges.includes('reviewer'));
    if (earnedBadge) {
      state.user.badges = state.user.badges || [];
      state.user.badges.push('reviewer');
    }

    closeReviewSheet();
    renderMarkers();
    renderRecommendList();
    if (state.detailId === id) renderDetail(id);
    if (state.activeTab === 'profile') renderProfileContent();
    renderProfileHeader();

    const becameHigh = isHighScore(act);
    if (earnedBadge) {
      showToast('感谢分享！+10 积分 · 获得「评价者」勋章 🏅', 3200);
    } else if (becameHigh) {
      showToast('感谢分享！+10 积分 · 该活动已成为高分活动 ⭐', 2800);
    } else {
      showToast('感谢分享！+10 积分', 2600);
    }
  }

  function renderProfileHeader() {
    if (state.user) {
      $('#profileAvatar').textContent = state.user.avatar;
      $('#profileName').textContent = state.user.name;
      const badge = state.user.badges && state.user.badges.includes('reviewer') ? ' · 🏅评价者' : '';
      const pts = state.userPoints > 0 ? `积分 ${state.userPoints}${badge}` : `演示账号${badge}`;
      $('#profileSub').textContent = pts + ' · 数据仅保存在本页';
      $('#btnProfileLogin').hidden = true;
    } else {
      $('#profileAvatar').textContent = '👤';
      $('#profileName').textContent = '未登录';
      $('#profileSub').textContent = '登录后可同步想去清单与评价';
      $('#btnProfileLogin').hidden = false;
    }
    $('#profileWantCount').textContent = state.wantList.size;
    $('#profileJoinedCount').textContent = getJoinedIds().size;
    $('#profileReviewCount').textContent = state.userReviews.size;
  }

  function renderProfileContent() {
    renderProfileHeader();
    const seg = state.profileSeg;
    const el = $('#profileScroll');

    if (!state.user) {
      el.innerHTML = '<div class="profile-empty">登录后查看想去清单、打卡记录与评价</div>';
      return;
    }

    if (seg === 'want') {
      if (state.wantList.size === 0) {
        el.innerHTML = '<div class="profile-empty">还没有收藏的活动<br>在详情页点「想去」加入清单</div>';
        return;
      }
      el.innerHTML = [...state.wantList].map((id) => {
        const act = getActivity(id);
        if (!act) return '';
        const cat = CATEGORIES[act.category];
        return `
          <div class="profile-item" data-id="${id}">
            <div class="profile-item-thumb" style="${thumbStyle(act.thumb)}"></div>
            <div class="profile-item-info">
              <div class="profile-item-name">${act.name}</div>
              <div class="profile-item-meta">${cat.label} · ${act.time} · ${act.distance}</div>
            </div>
          </div>`;
      }).join('');
    } else if (seg === 'joined') {
      const joined = [...getJoinedIds()];
      if (joined.length === 0) {
        el.innerHTML = '<div class="profile-empty">还没有参与记录<br>购票或现场打卡后会出现在这里</div>';
        return;
      }
      el.innerHTML = joined.map((id) => {
        const act = getActivity(id);
        if (!act) return '';
        const reviewed = state.userReviews.has(id);
        const hasTicket = state.ticketList.has(id);
        const hasCheckin = state.checkinList.has(id);
        let status = '';
        if (hasTicket && hasCheckin) status = '已购票 · 已打卡';
        else if (hasTicket) status = '已购票 · 待参加';
        else status = `已打卡 · ${reviewed ? '已评价' : '待写评价'}`;
        return `
          <div class="profile-item" data-id="${id}">
            <div class="profile-item-thumb" style="${thumbStyle(act.thumb)}"></div>
            <div class="profile-item-info">
              <div class="profile-item-name">${act.name}</div>
              <div class="profile-item-meta">${status}${act.paid && hasTicket ? ' · 🎫' : ''}</div>
            </div>
          </div>`;
      }).join('');
    } else {
      if (state.userReviews.size === 0) {
        el.innerHTML = '<div class="profile-empty">还没有发布评价<br>打卡后可分享体验</div>';
        return;
      }
      el.innerHTML = [...state.userReviews.entries()].map(([id, review]) => {
        const act = getActivity(id);
        if (!act) return '';
        return `
          <div class="profile-item" data-id="${id}">
            <div class="profile-item-thumb" style="${thumbStyle(act.thumb)}"></div>
            <div class="profile-item-info">
              <div class="profile-item-name">${act.name}</div>
              <div class="profile-item-meta">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} · ${review.time}</div>
              <div class="profile-review-text">${review.text}</div>
            </div>
          </div>`;
      }).join('');
    }

    el.querySelectorAll('.profile-item').forEach((item) => {
      item.addEventListener('click', () => openDetail(item.dataset.id));
    });
  }

  function switchProfileSeg(seg) {
    state.profileSeg = seg;
    $$('#profileSegments .profile-seg').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.seg === seg);
    });
    renderProfileContent();
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

  let clampResizeTimer = null;
  function scheduleClampToBounds() {
    clearTimeout(clampResizeTimer);
    clampResizeTimer = setTimeout(clampToBounds, 120);
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
    let touchActive = false;
    let touchIdleTimer = null;
    let touchTapPending = false;
    let touchStartPoint = null;

    function markTouchActive() {
      touchActive = true;
      clearTimeout(touchIdleTimer);
      touchIdleTimer = setTimeout(() => {
        touchActive = false;
      }, 450);
    }

    function tryMarkerTap(clientX, clientY, ignoreMove = false) {
      if (!ignoreMove && state.mapDidMove) return;
      const nearby = getMarkersNearPoint(clientX, clientY);
      if (nearby.length === 0) return;
      handleMarkerTap(clientX, clientY);
    }

    function tapMoved(clientX, clientY) {
      if (!touchStartPoint) return false;
      return Math.hypot(clientX - touchStartPoint.x, clientY - touchStartPoint.y) > TAP_MOVE_THRESHOLD;
    }

    function onDragStart(clientX, clientY) {
      if (state.selectedId || state.pinching || state.detailId) return;
      touchTapPending = false;
      state.dragging = true;
      state.mapDidMove = false;
      state.dragPointer = { x: clientX, y: clientY };
      state.dragStart = { x: clientX, y: clientY, mapX: state.mapX, mapY: state.mapY };
      mapCanvas.classList.add('dragging');
    }

    function onDragMove(clientX, clientY) {
      if (!state.dragging || state.pinching) return;
      if (Math.hypot(clientX - state.dragPointer.x, clientY - state.dragPointer.y) > TAP_SLOP) {
        state.mapDidMove = true;
      }
      state.mapX = state.dragStart.mapX + (clientX - state.dragStart.x);
      state.mapY = state.dragStart.mapY + (clientY - state.dragStart.y);
      clampToBounds();
    }

    function onDragEnd() {
      state.dragging = false;
      touchTapPending = false;
      touchStartPoint = null;
      mapCanvas.classList.remove('dragging');
      clampToBounds();
    }

    function beginTouchTap(clientX, clientY) {
      if (state.selectedId || state.pinching || state.detailId) return;
      touchTapPending = true;
      touchStartPoint = { x: clientX, y: clientY, time: Date.now() };
      state.mapDidMove = false;
      state.dragStart = { x: clientX, y: clientY, mapX: state.mapX, mapY: state.mapY };
    }

    function onPinchStart(touches) {
      touchTapPending = false;
      touchStartPoint = null;
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
      if (touchActive) return;
      if (e.target.closest('.map-controls') || e.target.closest('.filter-bar')) return;
      onDragStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (touchActive) return;
      onDragMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', (e) => {
      if (touchActive) return;
      onDragEnd();
    });

    wrap.addEventListener('wheel', (e) => {
      if (state.selectedId || state.detailId) return;
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? -ZOOM.wheel : ZOOM.wheel, e.clientX, e.clientY);
    }, { passive: false });

    wrap.addEventListener('touchstart', (e) => {
      if (e.target.closest('.activity-sheet') || e.target.closest('.filter-bar')) return;
      markTouchActive();
      if (e.touches.length === 2) {
        onPinchStart(e.touches);
        return;
      }
      if (e.target.closest('.map-controls')) return;
      if (e.touches.length === 1) beginTouchTap(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    wrap.addEventListener('click', (e) => {
      if (touchActive) return;
      if (e.target.closest('.map-controls') || e.target.closest('.filter-bar')) return;
      if (Date.now() < suppressMarkerClickUntil) return;
      tryMarkerTap(e.clientX, e.clientY);
    });

    wrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && state.pinching) {
        e.preventDefault();
        onPinchMove(e.touches);
        return;
      }
      if (touchTapPending && e.touches.length === 1) {
        const t = e.touches[0];
        const dist = Math.hypot(t.clientX - touchStartPoint.x, t.clientY - touchStartPoint.y);
        if (dist > TAP_SLOP) {
          onDragStart(touchStartPoint.x, touchStartPoint.y);
          onDragMove(t.clientX, t.clientY);
          e.preventDefault();
        }
        return;
      }
      if (state.dragging && e.touches.length === 1) {
        e.preventDefault();
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    wrap.addEventListener('touchend', (e) => {
      markTouchActive();
      if (e.touches.length < 2) state.pinching = false;
      if (e.touches.length === 0) {
        if (touchTapPending && !state.pinching && e.changedTouches.length === 1) {
          const t = e.changedTouches[0];
          touchTapPending = false;
          if (!e.target.closest('.map-controls') && !e.target.closest('.filter-bar')) {
            const dt = Date.now() - touchStartPoint.time;
            if (dt < 450 && !tapMoved(t.clientX, t.clientY)) {
              suppressMarkerClickUntil = Date.now() + 400;
              tryMarkerTap(t.clientX, t.clientY, true);
            }
          }
          touchStartPoint = null;
        } else if (state.dragging) {
          onDragEnd();
        }
      } else if (e.touches.length === 1 && !state.pinching) {
        beginTouchTap(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    wrap.addEventListener('touchcancel', () => {
      touchTapPending = false;
      touchStartPoint = null;
      onDragEnd();
    }, { passive: true });
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
    if (tab === 'profile') renderProfileContent();
    if (tab === 'recommend') notifyGuide('tab-recommend');
  }

  function initTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    $$('#profileSegments .profile-seg').forEach((btn) => {
      btn.addEventListener('click', () => switchProfileSeg(btn.dataset.seg));
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
    $('#btnBuyTicket').addEventListener('click', () => {
      if (state.detailId) buyTicket(state.detailId);
    });
    $('#btnAskLive').addEventListener('click', () => {
      showToast('已发送提问：「现在人多吗？大概能逛多久？」现场用户稍后回复（演示）');
    });
    $('#btnCheckin').addEventListener('click', () => {
      if (state.detailId) doCheckin(state.detailId);
    });
    $('#btnReview').addEventListener('click', () => {
      if (state.detailId) openReviewSheet(state.detailId);
    });

    $('#btnMockLogin').addEventListener('click', mockLogin);
    $('#btnLoginCancel').addEventListener('click', closeLoginModal);
    $('#loginBackdrop').addEventListener('click', closeLoginModal);
    $('#btnProfileLogin').addEventListener('click', openLoginModal);

    $('#btnReviewClose').addEventListener('click', closeReviewSheet);
    $('#reviewBackdrop').addEventListener('click', closeReviewSheet);
    $('#btnReviewSubmit').addEventListener('click', submitReview);

    $('#btnZoomIn').addEventListener('click', (e) => { e.stopPropagation(); zoomBy(ZOOM.step); });
    $('#btnZoomOut').addEventListener('click', (e) => { e.stopPropagation(); zoomBy(-ZOOM.step); });
    $('#btnLocate').addEventListener('click', (e) => { e.stopPropagation(); resetMapView(); });
  }

  function init() {
    renderMarkers();
    renderRecommendList();
    renderProfileHeader();
    initMapGestures();
    initTabs();
    initUI();
    clampToBounds();
    window.addEventListener('resize', scheduleClampToBounds, { passive: true });

    if (typeof initGuide === 'function') {
      guideCtrl = initGuide({
        switchTab,
        openSheet,
        openDetail,
        closeDetail,
        closeSheet,
        closeFilterPanel,
        closeGuideLayers,
        closeAllOverlays,
        showToast,
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
