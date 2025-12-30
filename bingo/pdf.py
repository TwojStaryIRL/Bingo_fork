from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit


def render_bingo_pdf(payload: dict, username: str) -> BytesIO:
    """
    payload = RaffleState.saved_board_payload
    {
        "size": 5,
        "grid": [
            {"cell": 0, "text": "...", "assigned_user": "..."},
            ...
        ]
    }
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    size = int(payload.get("size", 5))
    grid = payload.get("grid", [])

    # ===== HEADER =====
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2, height - 2 * cm, f"BINGO – {username}")

    # ===== GRID SETUP =====
    grid_size_cm = 16
    cell_cm = grid_size_cm / size

    start_x = (width - grid_size_cm * cm) / 2
    start_y = height - 4 * cm

    # map: index -> cell data
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
        user = (item.get("assigned_user") or "").strip()

        # ===== TEXT =====
        c.setFont("Helvetica", 9)

        max_width = cell_cm * cm - 8
        lines = simpleSplit(text, "Helvetica", 9, max_width)

        text_y = y - 14
        for line in lines[:5]:  # max 5 linii
            c.drawString(x + 4, text_y, line)
            text_y -= 11

        # ===== USER FOOTER =====
        if user:
            c.setFont("Helvetica-Oblique", 7)
            c.drawRightString(
                x + cell_cm * cm - 4,
                y - cell_cm * cm + 6,
                user
            )

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
