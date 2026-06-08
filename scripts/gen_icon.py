#!/usr/bin/env python3
"""
生成 Apple Liquid Glass 风格的 VEX-Timeline 应用图标。
- 主图标 1024x1024（master）
- 衍生 favicon-32, icon-192, icon-512
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os

OUT_DIR = "/workspace/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

# 主色调（与项目保持一致的蓝色品牌色，但加深饱和度以体现 Liquid Glass 质感）
COLOR_BG_TOP    = (91, 155, 246, 255)    # #5B9BF6 天蓝
COLOR_BG_MID    = (99, 130, 240, 255)    # #6382F0 蓝紫过渡
COLOR_BG_BOTTOM = (139, 92, 246, 255)    # #8B5CF6 紫罗兰
COLOR_HIGHLIGHT = (255, 255, 255, 220)   # 顶部反光
COLOR_EDGE      = (255, 255, 255, 120)   # 边缘折射光
COLOR_LINE      = (255, 255, 255, 245)   # 时间轴主线
COLOR_DOT_DIM   = (255, 255, 255, 200)   # 普通事件点
COLOR_DOT_MAIN  = (255, 255, 255, 255)   # 中心主点
COLOR_GLOW      = (220, 235, 255, 255)   # 主点外光晕

CANVAS = 1024
CORNER_RADIUS = 224  # iOS app icon 圆角比例 ≈ 22.4% (squircle)

def make_glass_background(size):
    """1. 玻璃渐变底 + 边缘高光 + 内部光带。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # ---- 圆角蒙版（圆角比例随尺寸缩放，但最小 4px） ----
    radius = max(4, int(CORNER_RADIUS * size / CANVAS))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)

    # ---- 渐变填充（纵向） ----
    base = Image.new("RGBA", (size, size), COLOR_BG_TOP)
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / max(1, size - 1)
        # 二次贝塞尔式渐变：顶蓝 → 中过渡 → 底紫
        if t < 0.5:
            k = t * 2
            r = int(COLOR_BG_TOP[0] * (1 - k) + COLOR_BG_MID[0] * k)
            g = int(COLOR_BG_TOP[1] * (1 - k) + COLOR_BG_MID[1] * k)
            b = int(COLOR_BG_TOP[2] * (1 - k) + COLOR_BG_MID[2] * k)
        else:
            k = (t - 0.5) * 2
            r = int(COLOR_BG_MID[0] * (1 - k) + COLOR_BG_BOTTOM[0] * k)
            g = int(COLOR_BG_MID[1] * (1 - k) + COLOR_BG_BOTTOM[1] * k)
            b = int(COLOR_BG_MID[2] * (1 - k) + COLOR_BG_BOTTOM[2] * k)
        gd.line((0, y, size, y), fill=(r, g, b, 255))
    img = Image.composite(grad, base, mask)

    # ---- 小尺寸跳过细节光带（避免绘制精度问题） ----
    if size >= 64:
        # ---- 内部柔光带（左上 → 右下） ----
        light_band = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        bd = ImageDraw.Draw(light_band)
        bd.ellipse((-size * 0.4, -size * 0.5, size * 0.9, size * 0.6),
                   fill=(255, 255, 255, 70))
        light_band = light_band.filter(ImageFilter.GaussianBlur(radius=size * 0.10))
        img = Image.alpha_composite(img, Image.composite(light_band, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask))

        # ---- 顶部高光（液态玻璃典型效果） ----
        top_highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        td = ImageDraw.Draw(top_highlight)
        hl_x0 = int(radius * 0.3)
        hl_x1 = int(size - radius * 0.3)
        hl_y1 = max(int(size * 0.18), 4)
        if hl_x1 > hl_x0:
            td.rounded_rectangle((hl_x0, 1, hl_x1, hl_y1),
                                  radius=(hl_x1 - hl_x0) // 2,
                                  fill=(255, 255, 255, 130))
            top_highlight = top_highlight.filter(ImageFilter.GaussianBlur(radius=max(1, size * 0.025)))
            img = Image.alpha_composite(img, Image.composite(top_highlight, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask))

    # ---- 边缘折射光（内描边） ----
    edge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    inset = max(1, size // 256)
    if radius - inset > 1:
        ed.rounded_rectangle((inset, inset, size - inset - 1, size - inset - 1),
                             radius=radius - inset,
                             outline=(255, 255, 255, 140), width=max(1, size // 256))
    img = Image.alpha_composite(img, edge)

    return img, mask

def make_timeline_subject(size, mask):
    """2. 主体：竖直时间轴 + 4 个事件点 + 1 个高亮中心点（带光晕）。"""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    cx = size / 2
    # 时间轴主线
    line_top    = size * 0.20
    line_bottom = size * 0.80
    line_width  = int(size * 0.025)
    d.rounded_rectangle(
        (cx - line_width / 2, line_top, cx + line_width / 2, line_bottom),
        radius=line_width / 2,
        fill=COLOR_LINE
    )

    # 普通事件点（上下各 2 个，半透明白）
    dot_radius = int(size * 0.030)
    for fy in (0.28, 0.39):
        d.ellipse(
            (cx - dot_radius, size * fy - dot_radius, cx + dot_radius, size * fy + dot_radius),
            fill=COLOR_DOT_DIM
        )
    for fy in (0.61, 0.72):
        d.ellipse(
            (cx - dot_radius, size * fy - dot_radius, cx + dot_radius, size * fy + dot_radius),
            fill=COLOR_DOT_DIM
        )

    # 中心主点：先画光晕，再画主体
    cy = size * 0.50
    main_r = int(size * 0.075)

    # 光晕（外圈柔光）
    glow_r = int(main_r * 2.6)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r),
               fill=(220, 235, 255, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.040))
    layer = Image.alpha_composite(layer, glow)

    # 重新获取 draw（在 alpha_composite 后 layer 重新生成）
    d = ImageDraw.Draw(layer)

    # 中心主体（玻璃质感白圆 + 内圈亮高光）
    d.ellipse(
        (cx - main_r, cy - main_r, cx + main_r, cy + main_r),
        fill=COLOR_DOT_MAIN
    )
    # 内圈高光（左上小光斑，模拟液态玻璃折射）
    hl_r = int(main_r * 0.45)
    hl_cx = cx - main_r * 0.25
    hl_cy = cy - main_r * 0.30
    d.ellipse(
        (hl_cx - hl_r, hl_cy - hl_r, hl_cx + hl_r, hl_cy + hl_r),
        fill=(255, 255, 255, 180)
    )

    # 裁剪到圆角矩形
    return Image.composite(layer, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask)

def render(size, out_path):
    bg, mask = make_glass_background(size)
    subject  = make_timeline_subject(size, mask)
    final    = Image.alpha_composite(bg, subject)
    final.save(out_path, "PNG", optimize=True)
    print(f"OK {out_path}  ({size}x{size})")

if __name__ == "__main__":
    # 1) 主图标 1024x1024（master）
    master_path = os.path.join(OUT_DIR, "icon-1024.png")
    render(1024, master_path)

    # 2) 衍生 PWA 标准尺寸
    render(512,  os.path.join(OUT_DIR, "icon-512.png"))
    render(192,  os.path.join(OUT_DIR, "icon-192.png"))
    render(32,   os.path.join(OUT_DIR, "favicon-32.png"))
    print("Done.")
