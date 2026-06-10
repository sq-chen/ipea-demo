# -*- coding: utf-8 -*-
"""将上级 pic 文件夹中的图片导入 assets/activities/"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIC = os.path.join(os.path.dirname(ROOT), 'pic')
OUT = os.path.join(ROOT, 'assets', 'activities')

# 文件名关键词 -> 活动 id
MAPPING = [
    ('广美', 'a1'),
    ('永庆坊', 'a2'),
    ('飞盘', 'a3'),
    ('live', 'a4'),
    ('Live', 'a4'),
    ('南越王', 'a5'),
    ('美食', 'a6'),
    ('快闪', 'a6'),
    ('爵士', 'a7'),
    ('夜跑', 'a8'),
    ('书展', 'a9'),
    ('展览', 'a9'),
    ('独立', 'a9'),
    ('啤酒', 'a10'),
    ('琶醍', 'a10'),
    ('社交', 'a10'),
    ('滑板', 'a11'),
    ('太极', 'a12'),
    ('荔湾', 'a12'),
    ('晨练', 'a12'),
]

def main():
    os.makedirs(OUT, exist_ok=True)
    if not os.path.isdir(PIC):
        raise SystemExit(f'找不到 pic 文件夹: {PIC}')

    files = os.listdir(PIC)
    used = set()
    assigned = {}

    for act_id in [f'a{i}' for i in range(1, 13)]:
        for name in files:
            if name in used:
                continue
            base = os.path.splitext(name)[0]
            lower = (name + base).lower()
            for kw, aid in MAPPING:
                if aid != act_id:
                    continue
                if kw.lower() in lower or kw in name:
                    assigned[act_id] = name
                    used.add(name)
                    break
            if act_id in assigned:
                break

    # live.jpg 单独匹配
    if 'a4' not in assigned:
        for name in files:
            if name.lower() == 'live.jpg' and name not in used:
                assigned['a4'] = name
                used.add(name)
                break

    unmapped = [f for f in files if f not in used]
    print('已匹配:', assigned)
    print('未匹配:', unmapped)

    ext_map = {}
    for act_id, src_name in assigned.items():
        ext = os.path.splitext(src_name)[1].lower()
        if ext in ('.jpg', '.jpeg'):
            dest_name = f'{act_id}.jpg'
        elif ext == '.webp':
            dest_name = f'{act_id}.webp'
        elif ext in ('.jfif', '.jpe'):
            dest_name = f'{act_id}.jfif'
        elif ext == '.png':
            dest_name = f'{act_id}.png'
        else:
            dest_name = f'{act_id}{ext}'

        src = os.path.join(PIC, src_name)
        dest = os.path.join(OUT, dest_name)
        shutil.copy2(src, dest)
        ext_map[act_id] = dest_name.replace('\\', '/')
        print(f'  {src_name} -> {dest_name}')

    # 写扩展名映射供 data.js 参考
    map_path = os.path.join(OUT, 'manifest.txt')
    with open(map_path, 'w', encoding='utf-8') as f:
        for k in sorted(ext_map):
            f.write(f'{k}={ext_map[k]}\n')

    print(f'\n共导入 {len(ext_map)} 张，manifest: {map_path}')
    if unmapped:
        print('提示: 未匹配文件可手动重命名后放入 assets/activities/')

if __name__ == '__main__':
    main()
