# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import textwrap

W, H = 1080, 1350
NAVY = (10, 14, 39)        # #0a0e27
PANEL = (17, 22, 31)       # #11161F
BORDER = (30, 37, 53)      # #1E2535
CYAN = (61, 220, 255)      # #3DDCFF
WHITE = (245, 247, 250)
MUTED = (150, 160, 180)
RED = (255, 107, 107)

FONT_DIR = r"C:\Windows\Fonts"
BOLD = FONT_DIR + r"\arialbd.ttf"
REG = FONT_DIR + r"\arial.ttf"
ITAL = FONT_DIR + r"\ariali.ttf"

OUT_DIR = r"C:\Users\User\Desktop\proyecto1\biohacker-score\docs\marketing\ig-assets"


def f(path, size):
    return ImageFont.truetype(path, size)


def draw_wrapped(draw, xy, text, font, fill, max_width, line_spacing=1.25, align="left", anchor_top=True):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)

    x, y = xy
    line_h = int(font.size * line_spacing)
    total_h = line_h * len(lines)
    if not anchor_top:
        y -= total_h
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        lx = x - lw if align == "right" else (x - lw // 2 if align == "center" else x)
        draw.text((lx, y + i * line_h), line, font=font, fill=fill)
    return y + total_h


def tag(draw, x, y, text, font, fg, bg=None, pad=(18, 10)):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    if bg:
        draw.rounded_rectangle(
            [x, y, x + tw + pad[0] * 2, y + th + pad[1] * 2 + 6],
            radius=8, fill=bg
        )
    draw.text((x + pad[0], y + pad[1] - bbox[1]), text, font=font, fill=fg)
    return th + pad[1] * 2 + 6


# ---------- Slide 1: Hook / Cover ----------
base = Image.open(OUT_DIR + r"\ashwagandha-4x5.webp").convert("RGB").resize((W, H))
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for i in range(H):
    t = i / H
    alpha = int(255 * max(0, (t - 0.35) / 0.65) ** 1.3) if t > 0.35 else 0
    od.line([(0, i), (W, i)], fill=(6, 8, 20, min(235, alpha)))
od.rectangle([0, 0, W, 170], fill=(6, 8, 20, 140))
img1 = Image.alpha_composite(base.convert("RGBA"), overlay)
d1 = ImageDraw.Draw(img1)

tag(d1, 64, 64, "SUPLEMENTOS · EVIDENCIA REAL", f(BOLD, 26), NAVY, bg=CYAN)

headline_font = f(BOLD, 66)
sub_font = f(BOLD, 40)
y = 950
y = draw_wrapped(d1, (64, y), "Ashwagandha no te va a subir la testosterona de la nada.",
                  headline_font, WHITE, W - 128, line_spacing=1.12)
y += 22
draw_wrapped(d1, (64, y), "— pero esto SÍ está bien probado →", sub_font, CYAN, W - 128, line_spacing=1.15)

img1.convert("RGB").save(OUT_DIR + r"\carrusel-ashwagandha-1-hook.jpg", quality=92)

# ---------- Slide 2: Lo que SÍ está probado ----------
img2 = Image.new("RGB", (W, H), NAVY)
d2 = ImageDraw.Draw(img2)
d2.rectangle([0, 0, W, 10], fill=CYAN)

tag(d2, 64, 80, "2 / 4", f(BOLD, 24), MUTED)
d2.text((64, 190), "LO QUE SÍ", font=f(BOLD, 58), fill=WHITE)
d2.text((64, 256), "ESTÁ PROBADO", font=f(BOLD, 58), fill=CYAN)
d2.rectangle([64, 340, 220, 346], fill=CYAN)

items = [
    ("Extracto KSM-66", "la forma con más evidencia clínica real"),
    ("300–600 mg/día", "dosis usada en los estudios más sólidos"),
    ("↓ Cortisol", "reducción medible de la hormona del estrés"),
    ("↑ Calidad de sueño", "mejora percibida tras 8 semanas de uso constante"),
]
y = 430
for title, desc in items:
    d2.ellipse([64, y + 8, 84, y + 28], fill=CYAN)
    d2.text((104, y), title, font=f(BOLD, 40), fill=WHITE)
    y2 = draw_wrapped(d2, (104, y + 54), desc, f(REG, 30), MUTED, W - 104 - 64, line_spacing=1.2)
    y = y2 + 46

d2.rectangle([64, 1180, W - 64, 1182], fill=BORDER)
draw_wrapped(d2, (64, 1220), "No de un día para el otro: los resultados aparecen con uso constante.",
             f(ITAL, 30), MUTED, W - 128, line_spacing=1.3)

img2.save(OUT_DIR + r"\carrusel-ashwagandha-2-si-probado.jpg", quality=92)

# ---------- Slide 3: Lo que NO está probado ----------
img3 = Image.new("RGB", (W, H), NAVY)
d3 = ImageDraw.Draw(img3)
d3.rectangle([0, 0, W, 10], fill=RED)

tag(d3, 64, 80, "3 / 4", f(BOLD, 24), MUTED)
d3.text((64, 190), "LO QUE NO", font=f(BOLD, 58), fill=WHITE)
d3.text((64, 256), "ESTÁ PROBADO", font=f(BOLD, 58), fill=RED)
d3.rectangle([64, 340, 220, 346], fill=RED)

d3.rounded_rectangle([64, 440, W - 64, 620], radius=20, outline=RED, width=3)
myth_font = f(BOLD, 42)
myth_text = '"Booster de testosterona mágico"'
bbox = d3.textbbox((0, 0), myth_text, font=myth_font)
mw = bbox[2] - bbox[0]
mx = 64 + ((W - 128) - mw) // 2
my = 440 + (180 - (bbox[3] - bbox[1])) // 2 - bbox[1]
d3.text((mx, my), myth_text, font=myth_font, fill=WHITE)
line_y = my + (bbox[3] - bbox[1]) // 2 + 6
d3.line([(mx - 10, line_y), (mx + mw + 10, line_y)], fill=RED, width=5)

y = 700
draw_wrapped(d3, (64, y),
             "El efecto sobre testosterona es mucho más modesto de lo que dicen muchos posts — y depende del punto de partida de cada quien.",
             f(REG, 38), WHITE, W - 128, line_spacing=1.35)

d3.rectangle([64, 1000, W - 64, 1002], fill=BORDER)
draw_wrapped(d3, (64, 1040),
             "No es un atajo para el gimnasio. Es una herramienta contra el estrés crónico.",
             f(BOLD, 34), CYAN, W - 128, line_spacing=1.3)

img3.save(OUT_DIR + r"\carrusel-ashwagandha-3-no-probado.jpg", quality=92)

# ---------- Slide 4: CTA ----------
img4 = Image.new("RGB", (W, H), NAVY)
d4 = ImageDraw.Draw(img4)
d4.rectangle([0, 0, W, 10], fill=CYAN)
tag(d4, 64, 80, "4 / 4", f(BOLD, 24), MUTED)

y = 220
y = draw_wrapped(d4, (64, y), "¿Estrés crónico que no te deja dormir?",
                  f(BOLD, 46), WHITE, W - 128, line_spacing=1.2)
y += 6
y = draw_wrapped(d4, (64, y), "Esto sí tiene evidencia real.",
                  f(BOLD, 46), CYAN, W - 128, line_spacing=1.2)

y += 70
d4.rectangle([64, y, W - 64, y + 2], fill=BORDER)
y += 60

y = draw_wrapped(d4, (64, y), "¿Buscás un atajo para el gimnasio?",
                  f(BOLD, 46), WHITE, W - 128, line_spacing=1.2)
y += 6
draw_wrapped(d4, (64, y), "No es la herramienta.", f(BOLD, 46), MUTED, W - 128, line_spacing=1.2)

btn_top = 980
d4.rounded_rectangle([64, btn_top, W - 64, btn_top + 140], radius=20, fill=CYAN)
btxt = "LINK EN LA BIO"
bf = f(BOLD, 44)
bbox = d4.textbbox((0, 0), btxt, font=bf)
bw = bbox[2] - bbox[0]
d4.text(((W - bw) // 2, btn_top + 46), btxt, font=bf, fill=NAVY)

draw_wrapped(d4, (W // 2, btn_top + 190), "análisis completo con las fuentes",
             f(REG, 30), MUTED, W - 200, align="center")

d4.text((64, H - 90), "@biohackerlatino", font=f(BOLD, 34), fill=CYAN)

img4.save(OUT_DIR + r"\carrusel-ashwagandha-4-cta.jpg", quality=92)

print("OK - 4 slides generated in", OUT_DIR)
