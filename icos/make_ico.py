import io
import os
import struct
import sys
from PIL import Image

src = os.path.join(os.path.dirname(__file__), "3558103-bowl-food-noodles-ramen-soup_107829.png")
dst = os.path.join(os.path.dirname(__file__), "ramen-bowl.ico")

img = Image.open(src).convert("RGBA")
sizes = [16, 32, 48, 256]
images = []
for s in sizes:
    resized = img.resize((s, s), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format="PNG")
    images.append((s, buf.getvalue()))

with open(dst, "wb") as f:
    # ICO header: reserved=0, type=1 (icon), count
    f.write(struct.pack("<HHH", 0, 1, len(images)))
    # directory entries
    offset = 6 + 16 * len(images)
    for s, data in images:
        w = 0 if s == 256 else s
        h = 0 if s == 256 else s
        f.write(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), offset))
        offset += len(data)
    # image data
    for _, data in images:
        f.write(data)

print(f"ICO gerado: {dst} ({os.path.getsize(dst)} bytes)")
