from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ===== Font registration (Unicode/PL) =====
BASE_DIR = Path(__file__).resolve().parent
FONTS_DIR = BASE_DIR / "fonts"

FONT_REGULAR = FONTS_DIR / "DejaVuSans.ttf"
FONT_BOLD = FONTS_DIR / "DejaVuSans-Bold.ttf"

# Rejestruj tylko jeśli plik istnieje (na deployu ma być w repo!)
if FONT_REGULAR.exists():
    pdfmetrics.registerFont(TTFont("DejaVuSans", str(FONT_REGULAR)))
else:
    # awaryjnie — bez tego będą kwadraty dla PL znaków
    # (zostawiamy fallback do Helvetica)
    pass

if FONT_BOLD.exists():
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", str(FONT_BOLD)))

# Helper: wybór fontów z fallbackiem
def _font(name: str) -> str:
    # jeśli zarejestrowany, używaj; inaczej fallback na Helvetica
    try:
        pdfmetrics.getFont(name)
        return name
    except Exception:
        return {
            "DejaVuSans": "Helvetica",
            "DejaVuSans-Bold": "Helvetica-Bold",
        }.get(name, "Helvetica")


def render_bingo_pdf(payload: dict, username: str) -> BytesIO:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    size = int(payload.get("size", 5))
    grid = payload.get("grid", [])

    # ===== HEADER =====
    c.setFont(_font("DejaVuSans-Bold"), 20)
    c.drawCentredString(width / 2, height - 2 * cm, f"BINGO – {username}")

    # ===== GRID SETUP =====
    grid_size_cm = 16
    cell_cm = grid_size_cm / size

    start_x = (width - grid_size_cm * cm) / 2
    start_y = height - 4 * cm

    by_index = {item.get("cell"): item for item in grid if isinstance(item, dict)}

    for idx in range(size * size):
        r = idx // size
        col = idx % size

        x = start_x + col * cell_cm * cm
        y = start_y - r * cell_cm * cm

        # ramka
        c.rect(x, y - cell_cm * cm, cell_cm * cm, cell_cm * cm)

        item = by_index.get(idx, {})
        text = (item.get("text") or "—").strip()
        assigned_user = (item.get("assigned_user") or "").strip()

        # ===== TEXT =====
        c.setFont(_font("DejaVuSans"), 9)
        max_width = cell_cm * cm - 8

        # simpleSplit MUSI dostać nazwę fonta, którego używasz
        font_name = _font("DejaVuSans")
        lines = simpleSplit(text, font_name, 9, max_width)

        text_y = y - 14
        for line in lines[:5]:
            c.drawString(x + 4, text_y, line)
            text_y -= 11

        # ===== USER FOOTER =====
        if assigned_user:
            c.setFont(_font("DejaVuSans"), 7)
            c.drawRightString(
                x + cell_cm * cm - 4,
                y - cell_cm * cm + 6,
                assigned_user
            )

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
