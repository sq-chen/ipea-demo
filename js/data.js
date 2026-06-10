/** 活动配图（统一 JPEG，兼容 GitHub Pages 与各浏览器） */
const ACTIVITY_IMAGE_FILES = {
  a1: 'a1.jpg', a2: 'a2.jpg', a3: 'a3.jpg', a4: 'a4.jpg',
  a5: 'a5.jpg', a6: 'a6.jpg', a7: 'a7.jpg', a8: 'a8.jpg',
  a9: 'a9.jpg', a10: 'a10.jpg', a11: 'a11.jpg', a12: 'a12.jpg',
};

/** 本地活动配图（随仓库一起部署，不依赖外网） */
function actImg(activityId) {
  const file = ACTIVITY_IMAGE_FILES[activityId] || `${activityId}.jpg`;
  return `assets/activities/${file}`;
}

/** 设置缩略图/头图（支持本地路径、URL 或 CSS 渐变） */
function applyThumb(el, thumb) {
  if (!el || !thumb) return;
  const src = String(thumb);
  if (src.startsWith('http') || src.startsWith('assets/')) {
    el.style.background = `url("${src}") center/cover no-repeat`;
    el.style.backgroundColor = '#E8EAED';
  } else {
    el.style.background = thumb;
  }
}

function thumbStyle(thumb) {
  const src = String(thumb);
  if (src.startsWith('http') || src.startsWith('assets/')) {
    return `background:url('${src}') center/cover no-repeat;background-color:#E8EAED`;
  }
  return `background:${thumb}`;
}

/** 活动类别配置 */
const CATEGORIES = {
  music:      { icon: '🎵', label: '音乐', color: '#8B5CF6' },
  sport:      { icon: '⚽', label: '运动', color: '#10B981' },
  exhibition: { icon: '🖼️', label: '展览', color: '#3B82F6' },
  food:       { icon: '🍔', label: '美食', color: '#EF4444' },
  social:     { icon: '💬', label: '社交', color: '#EC4899' },
};

/** 广州 mock 活动（x/y 为地图截图上的百分比位置，基于 926×755 新底图） */
const ACTIVITIES = [
  {
    id: 'a1',
    name: '广美毕业作品展',
    category: 'exhibition',
    x: 72, y: 50,
    distance: '8.2km',
    distanceKm: 8.2,
    timeFilter: 'ongoing',
    paid: false,
    time: '进行中',
    status: 'ongoing',
    rating: 4.8,
    reviewCount: 326,
    address: '广州大学城广州美术学院',
    district: '番禺',
    thumb: actImg('a1'),
    desc: '研究生与本科生毕业联展，免费参观。',
  },
  {
    id: 'a2',
    name: '永庆坊周末创意市集',
    category: 'food',
    x: 27, y: 34,
    distance: '1.8km',
    distanceKm: 1.8,
    timeFilter: 'weekend',
    paid: false,
    time: '6月14日 10:00',
    status: 'upcoming',
    rating: 4.6,
    reviewCount: 189,
    address: '荔湾区恩宁路永庆坊',
    district: '荔湾',
    thumb: actImg('a2'),
    desc: '手作、文创与广府小吃，适合周末闲逛。',
  },
  {
    id: 'a3',
    name: '二沙岛周末飞盘局',
    category: 'sport',
    x: 48, y: 36,
    distance: '2.5km',
    distanceKm: 2.5,
    timeFilter: 'ongoing',
    paid: false,
    time: '进行中',
    status: 'ongoing',
    rating: 4.5,
    reviewCount: 94,
    address: '越秀区二沙岛体育公园',
    district: '越秀',
    thumb: actImg('a3'),
    desc: '新手友好，现场可借盘，每周六下午。',
  },
  {
    id: 'a4',
    name: '太古仓 Live 音乐夜',
    category: 'music',
    x: 35, y: 48,
    distance: '2.1km',
    distanceKm: 2.1,
    timeFilter: 'weekend',
    paid: true,
    priceLabel: '¥68 起',
    time: '6月14日 19:30',
    status: 'upcoming',
    rating: 4.7,
    reviewCount: 215,
    address: '海珠区革新路太古仓码头',
    district: '海珠',
    thumb: actImg('a4'),
    desc: '江边露天 live，本地独立乐队演出。',
  },
  {
    id: 'a5',
    name: '南越王博物院特展',
    category: 'exhibition',
    x: 38, y: 24,
    distance: '1.2km',
    distanceKm: 1.2,
    timeFilter: 'ongoing',
    paid: false,
    time: '进行中',
    status: 'ongoing',
    rating: 4.9,
    reviewCount: 512,
    address: '越秀区解放北路867号',
    district: '越秀',
    thumb: actImg('a5'),
    desc: '「尼罗河的赠礼」古埃及文物数字艺术展。',
  },
  {
    id: 'a6',
    name: '珠江新城美食快闪',
    category: 'food',
    x: 56, y: 30,
    distance: '0.8km',
    distanceKm: 0.8,
    timeFilter: 'weekend',
    paid: false,
    time: '6月15日 11:00',
    status: 'upcoming',
    rating: 4.2,
    reviewCount: 67,
    address: '天河区花城广场北区',
    district: '天河',
    thumb: actImg('a6'),
    desc: '网红餐饮快闪，免费试吃名额有限。',
  },
  {
    id: 'a7',
    name: '沙面街头爵士',
    category: 'music',
    x: 33, y: 43,
    distance: '2.8km',
    distanceKm: 2.8,
    timeFilter: 'today',
    paid: true,
    priceLabel: '¥48',
    time: '6月13日 20:00',
    status: 'upcoming',
    rating: 4.4,
    reviewCount: 143,
    address: '荔湾区沙面大街',
    district: '荔湾',
    thumb: actImg('a7'),
    desc: '欧式建筑背景下的街头爵士表演。',
  },
  {
    id: 'a8',
    name: '广州塔夜跑团',
    category: 'sport',
    x: 51, y: 47,
    distance: '3.5km',
    distanceKm: 3.5,
    timeFilter: 'weekend',
    paid: false,
    time: '6月14日 20:00',
    status: 'upcoming',
    rating: 4.3,
    reviewCount: 88,
    address: '海珠区广州塔西广场',
    district: '海珠',
    thumb: actImg('a8'),
    desc: '5km 沿江夜跑，集合后统一出发。',
  },
  {
    id: 'a9',
    name: '东山口独立书展',
    category: 'exhibition',
    x: 52, y: 22,
    distance: '1.5km',
    distanceKm: 1.5,
    timeFilter: 'ongoing',
    paid: false,
    time: '进行中',
    status: 'ongoing',
    rating: 4.1,
    reviewCount: 56,
    address: '越秀区东山口恤孤院路',
    district: '越秀',
    thumb: actImg('a9'),
    desc: '独立出版与小众杂志，文艺青年聚集地。',
  },
  {
    id: 'a10',
    name: '琶醍啤酒社交夜',
    category: 'social',
    x: 46, y: 52,
    distance: '3.8km',
    distanceKm: 3.8,
    timeFilter: 'weekend',
    paid: true,
    priceLabel: '¥128',
    time: '6月14日 18:00',
    status: 'upcoming',
    rating: 4.5,
    reviewCount: 201,
    address: '海珠区阅江路琶醍啤酒文化创意区',
    district: '海珠',
    thumb: actImg('a10'),
    desc: '精酿品鉴 + 陌生人破冰桌游，需提前预约。',
  },
  {
    id: 'a11',
    name: '天河路街头滑板赛',
    category: 'sport',
    x: 60, y: 24,
    distance: '1.0km',
    distanceKm: 1.0,
    timeFilter: 'weekend',
    paid: false,
    time: '6月15日 15:00',
    status: 'upcoming',
    rating: 4.0,
    reviewCount: 42,
    address: '天河区正佳广场外广场',
    district: '天河',
    thumb: actImg('a11'),
    desc: '业余滑手交流赛，围观免费。',
  },
  {
    id: 'a12',
    name: '荔湾湖太极晨练社',
    category: 'social',
    x: 25, y: 41,
    distance: '2.0km',
    distanceKm: 2.0,
    timeFilter: 'ongoing',
    paid: false,
    time: '进行中',
    status: 'ongoing',
    rating: 4.6,
    reviewCount: 77,
    address: '荔湾区龙津西路荔湾湖公园',
    district: '荔湾',
    thumb: actImg('a12'),
    desc: '长者太极与年轻人冥想体验，免费参与。',
  },
];

/** 主办方 */
const ORGANIZERS = {
  a1: '广州美术学院',
  a2: '永庆坊文化街区',
  a3: '二沙岛飞盘社',
  a4: '太古仓码头',
  a5: '南越王博物院',
  a6: '花城广场商圈',
  a7: '沙面音乐联盟',
  a8: '广州塔跑团',
  a9: '东山口独立书店',
  a10: '琶醍文创区',
  a11: '正佳广场',
  a12: '荔湾湖公园',
};

/** 推荐一句话亮点 */
const HIGHLIGHTS = {
  a1: '免费看展，毕业佳作集中呈现',
  a2: '广府小吃 + 手作文创，适合周末闲逛',
  a3: '新手友好，现场可借盘',
  a4: '江边露天 live，氛围很好',
  a5: '古埃及特展，口碑极高',
  a6: '网红餐饮快闪，试吃名额有限',
  a7: '欧式建筑 + 街头爵士',
  a8: '5km 沿江夜跑，集合出发',
  a9: '独立出版与小众杂志',
  a10: '精酿 + 破冰桌游，需预约',
  a11: '业余滑手交流，围观免费',
  a12: '太极晨练，免费参与',
};

/** 虚拟评论 */
const COMMENTS = {
  a1: [
    { user: '阿文', rating: 5, text: '毕业展质量很高，雕塑和交互装置特别惊喜。', time: '1天前', likes: 24, verified: true },
    { user: '看展人', rating: 5, text: '免费！周末人有点多但值得来。', time: '3天前', likes: 18, verified: true },
    { user: '设计狗', rating: 4, text: '本科生展区也很精彩，建议留 2 小时。', time: '5天前', likes: 9, verified: false },
  ],
  a2: [
    { user: '吃货小美', rating: 5, text: '钵仔糕和手工饰品都很好逛，拍照也出片。', time: '2天前', likes: 31, verified: true },
    { user: '周末党', rating: 4, text: '人有点多，建议上午来。', time: '4天前', likes: 12, verified: true },
  ],
  a3: [
    { user: '飞盘新手', rating: 5, text: '教练很耐心，第一次玩就上手了。', time: '今天', likes: 8, verified: true },
    { user: '运动达人', rating: 4, text: '场地不错，下午风大时盘会飘。', time: '2天前', likes: 5, verified: true },
  ],
  a4: [
    { user: 'Live 爱好者', rating: 5, text: '江边吹风听歌，本地乐队水准在线。', time: '1天前', likes: 27, verified: true },
    { user: '夜猫子', rating: 5, text: '建议提前占座，周末爆满。', time: '3天前', likes: 15, verified: false },
    { user: '路人甲', rating: 4, text: '啤酒略贵，但氛围值得。', time: '6天前', likes: 6, verified: true },
  ],
  a5: [
    { user: '博物馆控', rating: 5, text: '展陈很用心，数字互动部分小朋友也喜欢。', time: '2天前', likes: 56, verified: true },
    { user: '历史迷', rating: 5, text: '广州必逛展览之一，强烈推荐。', time: '1周前', likes: 42, verified: true },
    { user: '带娃党', rating: 5, text: '空调足，夏天避暑看展好去处。', time: '1周前', likes: 33, verified: true },
  ],
  a6: [
    { user: '探店王', rating: 4, text: '试吃种类多，排队 20 分钟左右。', time: '3天前', likes: 11, verified: true },
    { user: '小透明', rating: 4, text: '离地铁近，快闪只开两天。', time: '5天前', likes: 4, verified: false },
  ],
  a7: [
    { user: '爵士粉', rating: 5, text: '沙面背景 + 爵士，浪漫值拉满。', time: '2天前', likes: 19, verified: true },
    { user: '摄影er', rating: 4, text: '傍晚光线最好，记得带相机。', time: '4天前', likes: 8, verified: true },
  ],
  a8: [
    { user: '跑者Leo', rating: 4, text: '路线沿江，夜景美，配速不限。', time: '3天前', likes: 14, verified: true },
    { user: '新手跑', rating: 4, text: '有存包处，组织还算有序。', time: '1周前', likes: 7, verified: false },
  ],
  a9: [
    { user: '书虫', rating: 4, text: '独立杂志种类多，价格小贵。', time: '2天前', likes: 6, verified: true },
    { user: '文艺青年', rating: 4, text: '空间不大但选品有品位。', time: '5天前', likes: 3, verified: false },
  ],
  a10: [
    { user: '社交牛', rating: 5, text: '桌游破冰设计不错，认识了新朋友。', time: '1天前', likes: 22, verified: true },
    { user: '精酿控', rating: 4, text: '啤酒选择多，江边位置加分。', time: '4天前', likes: 11, verified: true },
  ],
  a11: [
    { user: '滑板少年', rating: 4, text: '水平参差，但围观氛围好。', time: '3天前', likes: 9, verified: true },
    { user: '路人', rating: 3, text: '音响太大，离远点看更舒服。', time: '6天前', likes: 2, verified: false },
  ],
  a12: [
    { user: '早起鸟', rating: 5, text: '太极老师很专业，环境清静。', time: '今天', likes: 13, verified: true },
    { user: '附近居民', rating: 5, text: '免费参与，适合带父母来。', time: '2天前', likes: 10, verified: true },
  ],
};

function getComments(activityId) {
  return COMMENTS[activityId] || [
    { user: '匿名用户', rating: 4, text: '活动不错，值得一去。', time: '近期', likes: 1, verified: false },
  ];
}

function getOrganizer(activityId) {
  return ORGANIZERS[activityId] || '本地主办';
}

function getHighlight(activityId) {
  return HIGHLIGHTS[activityId] || '附近热门活动';
}

/** 现场直击 mock 播报 */
const LIVE_UPDATES = {
  a2: [
    { time: '8 分钟前', user: '现场小助手', text: '市集刚开门，部分摊位还在布置，建议 10:30 后再来。' },
    { time: '25 分钟前', user: '逛展的 Mia', text: '永庆坊入口人流适中，广府小吃区排队约 5 分钟。' },
  ],
  a3: [
    { time: '刚刚', user: '飞盘社志愿者', text: '正在进行友谊赛，新手组还有 3 个名额，可现场加入。' },
    { time: '15 分钟前', user: '路人阿Ken', text: '草坪有点晒，建议带帽子；借盘处排队很快。' },
  ],
  a5: [
    { time: '12 分钟前', user: '馆方播报', text: '特展展厅人流舒适，数字互动区无需排队。' },
    { time: '40 分钟前', user: '看展人', text: '古埃及区讲解很精彩，建议预留 1.5 小时。' },
  ],
  a6: [
    { time: '20 分钟前', user: '快闪主办方', text: '试吃券已发放 60%，预计 12:00 后名额紧张。' },
  ],
  a10: [
    { time: '5 分钟前', user: '现场主持', text: '破冰桌游第一轮即将开始，已购票可直接入场。' },
    { time: '30 分钟前', user: '精酿控', text: '江边风大，室外位略冷，室内区还有空位。' },
  ],
  a12: [
    { time: '刚刚', user: '晨练社', text: '太极体验进行中，现在加入无需预约。' },
  ],
};

function getLiveUpdates(activityId) {
  return LIVE_UPDATES[activityId] || null;
}

/** 筛选：时间维度标签 */
const TIME_FILTER_LABELS = {
  ongoing: '进行中',
  today: '今天',
  weekend: '本周末',
  week: '本周',
};

/** 计算标记显示坐标（自动散开重叠点，保留最大偏移量） */
function computeMarkerDisplayPositions(activities, minDist = 4.5, maxDrift = 5.5) {
  const items = activities.map((a) => ({
    id: a.id,
    ox: a.x,
    oy: a.y,
    x: a.x,
    y: a.y,
  }));

  for (let pass = 0; pass < 14; pass++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        let dx = items[j].x - items[i].x;
        let dy = items[j].y - items[i].y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.15) {
          const angle = ((i * 5 + j * 11) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (minDist - dist) / 2;
        items[i].x -= (dx / dist) * push;
        items[i].y -= (dy / dist) * push;
        items[j].x += (dx / dist) * push;
        items[j].y += (dy / dist) * push;
      }
    }
    items.forEach((it) => {
      let dx = it.x - it.ox;
      let dy = it.y - it.oy;
      const drift = Math.hypot(dx, dy);
      if (drift > maxDrift) {
        it.x = it.ox + (dx / drift) * maxDrift;
        it.y = it.oy + (dy / drift) * maxDrift;
      }
    });
  }

  items.forEach((it) => {
    it.x = Math.max(3, Math.min(97, it.x));
    it.y = Math.max(3, Math.min(97, it.y));
  });

  return items.reduce((map, it) => {
    map.set(it.id, { x: it.x, y: it.y });
    return map;
  }, new Map());
}

/** 全局标记布局（基于全部活动，筛选时位置稳定） */
const MARKER_LAYOUT = computeMarkerDisplayPositions(ACTIVITIES);

/** 是否高分活动 */
function isHighScore(activity) {
  return activity.rating >= 4.5;
}

/** 渲染星级 HTML */
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  let html = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) html += '<span class="star on">★</span>';
    else if (i === full && half) html += '<span class="star half">★</span>';
    else html += '<span class="star">★</span>';
  }
  return html;
}
