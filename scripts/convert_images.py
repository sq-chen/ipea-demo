# -*- coding: utf-8 -*-
"""将全部活动配图统一转为标准 JPEG，避免格式/扩展名不一致导致无法显示"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'activities')

def to_jpeg(src_path, dest_path, quality=88):
    img = Image.open(src_path)
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (232, 234, 237))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(dest_path, 'JPEG', quality=quality, optimize=True)

def main():
    if not os.path.isdir(OUT):
        raise SystemExit(f'目录不存在: {OUT}')

    tmp = []
    seen = set()
    for name in sorted(os.listdir(OUT)):
        if name == 'manifest.txt':
            continue
        base, ext = os.path.splitext(name)
        if not base.startswith('a') or not base[1:].isdigit() or base in seen:
            continue
        seen.add(base)
        src = os.path.join(OUT, name)
        dest = os.path.join(OUT, f'{base}.jpg')
        tmp.append((base, src, dest))

    for base, src, dest in tmp:
        to_jpeg(src, dest if src != dest else dest + '.tmp.jpg')
        final = dest
        if src == dest:
            os.replace(dest + '.tmp.jpg', final)
        elif src != final and os.path.isfile(src):
            os.remove(src)
        print('OK', base, '->', f'{base}.jpg')

    # 清理非 jpg 残留
    for name in os.listdir(OUT):
        if name == 'manifest.txt':
            continue
        base, ext = os.path.splitext(name)
        if base.startswith('a') and base[1:].isdigit() and ext.lower() != '.jpg':
            os.remove(os.path.join(OUT, name))

    manifest = os.path.join(OUT, 'manifest.txt')
    with open(manifest, 'w', encoding='utf-8') as f:
        for base, _, _ in tmp:
            f.write(f'{base}={base}.jpg\n')
    print('done', len(tmp), 'files')

if __name__ == '__main__':
    main()
