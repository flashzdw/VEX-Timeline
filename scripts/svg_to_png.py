#!/usr/bin/env python3
"""
从 SVG 生成 PWA / favicon 所需 PNG。
SVG 是设计之源，PNG 是渲染导出，二者保持单一真相。
"""
import cairosvg
import os

SVG_PATH = "/workspace/public/icons/icon.svg"
OUT_DIR  = "/workspace/public/icons"

# (size, output_filename)
TARGETS = [
    (32,   "favicon-32.png"),
    (180,  "apple-touch-icon.png"),  # iOS 主屏图标（标准 180x180）
    (192,  "icon-192.png"),
    (512,  "icon-512.png"),
    (1024, "icon-1024.png"),
]

def main():
    for size, name in TARGETS:
        out = os.path.join(OUT_DIR, name)
        cairosvg.svg2png(
            url=SVG_PATH,
            write_to=out,
            output_width=size,
            output_height=size,
        )
        print(f"OK {out} ({size}x{size})")

if __name__ == "__main__":
    main()
