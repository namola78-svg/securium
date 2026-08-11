import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "securium-content-upgrade-v2"
OUTPUT = ROOT / "reports" / "content-v3"
RENDERS = OUTPUT / "pdf-renders"
OUTPUT.mkdir(parents=True, exist_ok=True)
RENDERS.mkdir(parents=True, exist_ok=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def page_thumbnail(page: pymupdf.Page, width: int = 260) -> Image.Image:
    scale = width / page.rect.width
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
    return Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)


def render_page(document: pymupdf.Document, page_index: int, output: Path, width: int = 1500):
    page = document[page_index]
    scale = width / page.rect.width
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
    pixmap.save(output)


def contact_sheets(items):
    font = ImageFont.load_default()
    columns, rows = 4, 5
    cell_width, cell_height = 330, 420
    sheets = []
    for sheet_index in range(0, len(items), columns * rows):
        chunk = items[sheet_index : sheet_index + columns * rows]
        canvas = Image.new("RGB", (columns * cell_width, rows * cell_height), "white")
        draw = ImageDraw.Draw(canvas)
        for index, item in enumerate(chunk):
            x = (index % columns) * cell_width
            y = (index // columns) * cell_height
            image = item["thumbnail"]
            canvas.paste(image, (x + (cell_width - image.width) // 2, y + 5))
            label = item["filename"][:42]
            draw.text((x + 8, y + 375), label, fill="black", font=font)
            draw.text((x + 8, y + 392), f"pages={item['pages']} text={item['first_page_text_length']}", fill="black", font=font)
        path = RENDERS / f"pdf-first-pages-{len(sheets) + 1:02d}.png"
        canvas.save(path)
        sheets.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    return sheets


def main():
    inspections = []
    thumbnails = []
    representative_renders = []
    for path in sorted(SOURCE.glob("*.pdf"), key=lambda item: item.name):
        row = {
            "source_file": path.name,
            "sha256": sha256(path),
            "open_status": "OK",
            "pages": 0,
            "encrypted": False,
            "first_page_text_length": 0,
            "pages_with_text": 0,
            "pages_without_text": 0,
            "practical_marker_pages": [],
            "notes": [],
        }
        try:
            document = pymupdf.open(path)
            row["pages"] = document.page_count
            row["encrypted"] = document.is_encrypted
            first_text = document[0].get_text("text") if document.page_count else ""
            row["first_page_text_length"] = len(first_text.strip())
            pages_with_text = 0
            marker_pages = []
            for page_index in range(document.page_count):
                text = document[page_index].get_text("text")
                if text.strip():
                    pages_with_text += 1
                if text.lstrip().startswith("실기 최신") and len(marker_pages) < 10:
                    marker_pages.append(page_index + 1)
            row["pages_with_text"] = pages_with_text
            row["pages_without_text"] = document.page_count - pages_with_text
            row["practical_marker_pages"] = marker_pages
            if row["pages_without_text"]:
                row["notes"].append("image_or_textless_pages_present")
            if document.page_count:
                thumbnails.append({**row, "filename": path.name, "thumbnail": page_thumbnail(document[0])})
            if path.name == "2026 정보보안기사 올인원_구매인증 이벤트 자료.pdf":
                pages = unique([0, *[page - 1 for page in marker_pages[:1]], 160])
                for page_index in pages:
                    output = RENDERS / f"all-in-one-page-{page_index + 1:03d}.png"
                    render_page(document, page_index, output)
                    representative_renders.append(str(output.relative_to(ROOT)).replace("\\", "/"))
            elif path.name in {
                "2022 2회차 산업기사 필기.pdf",
                "정보보안기사 필기-2023년도 제4회_2023.10.07_babayetu.tistory.com.pdf",
            }:
                output = RENDERS / f"{path.stem[:28]}-page-001.png"
                render_page(document, 0, output)
                representative_renders.append(str(output.relative_to(ROOT)).replace("\\", "/"))
            document.close()
        except Exception as error:  # noqa: BLE001 - inspection must record per-file failures
            row["open_status"] = "ERROR"
            row["notes"].append(f"{type(error).__name__}:{str(error)[:200]}")
        inspections.append(row)

    sheets = contact_sheets(thumbnails)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceRoot": str(SOURCE),
        "summary": {
            "pdfFiles": len(inspections),
            "opened": sum(row["open_status"] == "OK" for row in inspections),
            "failed": sum(row["open_status"] != "OK" for row in inspections),
            "totalPages": sum(row["pages"] for row in inspections),
            "filesWithTextlessPages": sum(row["pages_without_text"] > 0 for row in inspections),
            "contactSheets": len(sheets),
            "representativeRenders": len(representative_renders),
        },
        "contactSheets": sheets,
        "representativeRenders": representative_renders,
        "files": inspections,
    }
    (OUTPUT / "pdf-inspection.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report["summary"], ensure_ascii=False))


def unique(values):
    return list(dict.fromkeys(values))


if __name__ == "__main__":
    main()
