from pathlib import Path
from shutil import copy2
from collections import deque

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DRAFT = ROOT / "art" / "animation_drafts" / "player_walk_up_8frame"
LIVE = ROOT / "art" / "animations" / "player_walk_up"
BACKUP = (
    ROOT
    / "art"
    / "animation_backups"
    / "player_walk_up"
    / "pre_head_sync_2026-07-25"
)
IDLE = ROOT / "art" / "player_idle" / "player_idle_up.png"
FRAME_NAMES = [f"frame_{number:02}.png" for number in range(1, 5)]


def backup_current_files():
    BACKUP.mkdir(parents=True, exist_ok=True)
    for name in FRAME_NAMES:
        source = DRAFT / name
        destination = BACKUP / name
        if source.exists() and not destination.exists():
            copy2(source, destination)
    live_sheet = LIVE / "sprite_sheet_review.png"
    backup_sheet = BACKUP / "sprite_sheet_review.png"
    if live_sheet.exists() and not backup_sheet.exists():
        copy2(live_sheet, backup_sheet)


def shifted_head(base, dx, dy):
    """Return the idle head moved with the cape without resampling pixels."""
    width, height = base.size
    head_bottom = 380
    head = base.crop((0, 0, width, head_bottom))
    layer = Image.new("RGBA", base.size)
    layer.alpha_composite(head, (dx, dy))
    return layer


def replace_stationary_head(frame, idle, dx, dy):
    result = frame.copy()
    idle_pixels = idle.load()
    result_pixels = result.load()

    # The generated step frames retained the idle head exactly. Remove only
    # that stationary head, leaving the cape, arms, hands, and legs untouched.
    for y in range(380):
        for x in range(idle.width):
            if idle_pixels[x, y][3]:
                result_pixels[x, y] = (0, 0, 0, 0)

    result.alpha_composite(shifted_head(idle, dx, dy))
    return result


def arm_mask(image, box):
    """Select arm/hand colors plus their dark outline, excluding green cape."""
    x0, y0, x1, y1 = box
    crop = image.crop(box)
    seed = Image.new("L", crop.size)
    seed_pixels = seed.load()
    source = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue, alpha = source[x, y]
            if (
                alpha >= 32
                and red >= 45
                and red > green * 1.10
                and red > blue * 1.14
            ):
                seed_pixels[x, y] = 255

    nearby = seed.filter(ImageFilter.MaxFilter(21))
    near_pixels = nearby.load()
    mask = Image.new("L", crop.size)
    mask_pixels = mask.load()
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue, alpha = source[x, y]
            is_arm_or_outline = (
                near_pixels[x, y]
                and alpha > 0
                and not (green > red * 1.18 and green > blue * 1.12)
            )
            if seed_pixels[x, y] or is_arm_or_outline:
                mask_pixels[x, y] = alpha
    return mask


def replace_generated_arms(frame, idle, cape_dx, left_dy, right_dy):
    """Use the clean idle arms, shifted vertically, instead of AI-smeared arms."""
    result = frame.copy()
    boxes = [(25, 395, 135, 640), (380, 395, 511, 640)]
    shifts = [(cape_dx, left_dy), (cape_dx, right_dy)]

    for box, (dx, dy) in zip(boxes, shifts):
        old_mask = arm_mask(result, box)
        old_pixels = old_mask.load()
        result_pixels = result.load()
        x0, y0, x1, y1 = box
        for local_y in range(y1 - y0):
            for local_x in range(x1 - x0):
                if old_pixels[local_x, local_y]:
                    result_pixels[x0 + local_x, y0 + local_y] = (0, 0, 0, 0)

        clean_arm = idle.crop(box)
        clean_mask = arm_mask(idle, box)
        clean_arm.putalpha(clean_mask)

        # Keep the shoulder attached to the cape while the forearm and hand
        # swing. This avoids narrow transparent seams at the joint.
        shoulder_mask = clean_mask.copy()
        shoulder_pixels = shoulder_mask.load()
        for local_y in range(shoulder_mask.height):
            for local_x in range(shoulder_mask.width):
                if local_y > 105:
                    shoulder_pixels[local_x, local_y] = 0
        shoulder = idle.crop(box)
        shoulder.putalpha(shoulder_mask)
        result.alpha_composite(shoulder, (x0 + cape_dx, y0 - 4))
        result.alpha_composite(clean_arm, (x0 + dx, y0 + dy))

    return result


def close_tiny_arm_seams(image):
    """Close only 1–3 px background leaks around animated arm joints."""
    result = image.copy()
    boxes = [(20, 390, 145, 650), (370, 390, 511, 650)]
    for box in boxes:
        x0, y0, x1, y1 = box
        crop = result.crop(box)
        alpha = crop.getchannel("A").point(lambda value: 255 if value >= 32 else 0)
        closed = alpha.filter(ImageFilter.MaxFilter(7)).filter(
            ImageFilter.MinFilter(7)
        )
        original_pixels = crop.load()
        alpha_pixels = alpha.load()
        closed_pixels = closed.load()
        additions = []
        for y in range(crop.height):
            for x in range(crop.width):
                if not alpha_pixels[x, y] and closed_pixels[x, y]:
                    additions.append((x, y))

        for x, y in additions:
            nearest = None
            for radius in range(1, 7):
                candidates = []
                for oy in range(-radius, radius + 1):
                    for ox in range(-radius, radius + 1):
                        nx, ny = x + ox, y + oy
                        if (
                            0 <= nx < crop.width
                            and 0 <= ny < crop.height
                            and alpha_pixels[nx, ny]
                        ):
                            candidates.append(original_pixels[nx, ny])
                if candidates:
                    nearest = min(
                        candidates,
                        key=lambda pixel: abs(pixel[0] - pixel[1]),
                    )
                    break
            if nearest:
                original_pixels[x, y] = nearest[:3] + (255,)
        result.alpha_composite(crop, (x0, y0))
    return result


def repair_isolated_alpha_defects(image):
    """Fill only enclosed one-pixel alpha defects; preserve real outer edges."""
    result = image.copy()
    width, height = result.size

    for _ in range(12):
        source = result.copy()
        src = source.load()
        dst = result.load()
        repairs = 0
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                pixel = src[x, y]
                neighbors = [
                    src[x + ox, y + oy]
                    for oy in (-1, 0, 1)
                    for ox in (-1, 0, 1)
                    if ox or oy
                ]
                solid = [neighbor for neighbor in neighbors if neighbor[3] >= 240]

                # A transparent pinhole or weak-alpha speck fully enclosed by
                # solid artwork is an artifact, not a legitimate silhouette.
                if pixel[3] < 240 and len(solid) >= 7:
                    channels = [
                        sorted(neighbor[channel] for neighbor in solid)
                        for channel in range(3)
                    ]
                    dst[x, y] = tuple(
                        channel[len(channel) // 2] for channel in channels
                    ) + (255,)
                    repairs += 1
        if not repairs:
            break

    return result


def harden_pixel_art_alpha(image):
    """Remove blurry fractional-alpha pixels while preserving the silhouette."""
    result = image.copy()
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (
                (red, green, blue, 255)
                if alpha >= 32
                else (0, 0, 0, 0)
            )
    return result


def repair_enclosed_transparent_specks(image):
    """Fill tiny transparent islands that do not connect to the background."""
    result = image.copy()
    pixels = result.load()
    width, height = result.size
    transparent = {
        (x, y)
        for y in range(height)
        for x in range(width)
        if pixels[x, y][3] < 16
    }
    edge = deque(
        [(x, y) for x in range(width) for y in (0, height - 1)
         if (x, y) in transparent]
        + [(x, y) for y in range(height) for x in (0, width - 1)
           if (x, y) in transparent]
    )
    outside = set(edge)
    while edge:
        x, y = edge.popleft()
        for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if neighbor in transparent and neighbor not in outside:
                outside.add(neighbor)
                edge.append(neighbor)

    enclosed = transparent - outside
    while enclosed:
        start = enclosed.pop()
        component = {start}
        queue = deque([start])
        while queue:
            x, y = queue.popleft()
            for neighbor in (
                (x - 1, y),
                (x + 1, y),
                (x, y - 1),
                (x, y + 1),
            ):
                if neighbor in enclosed:
                    enclosed.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)

        if len(component) > 12:
            continue
        boundary = []
        for x, y in component:
            for ox, oy in (
                (-1, -1), (0, -1), (1, -1),
                (-1, 0),           (1, 0),
                (-1, 1),  (0, 1),  (1, 1),
            ):
                nx, ny = x + ox, y + oy
                if (
                    0 <= nx < width
                    and 0 <= ny < height
                    and pixels[nx, ny][3] >= 200
                ):
                    boundary.append(pixels[nx, ny])
        if not boundary:
            continue
        medians = []
        for channel in range(3):
            values = sorted(pixel[channel] for pixel in boundary)
            medians.append(values[len(values) // 2])
        for x, y in component:
            pixels[x, y] = tuple(medians) + (255,)

    return result


def count_isolated_alpha_defects(image):
    pixels = image.load()
    count = 0
    for y in range(1, image.height - 1):
        for x in range(1, image.width - 1):
            if pixels[x, y][3] >= 240:
                continue
            solid_neighbors = 0
            for oy in (-1, 0, 1):
                for ox in (-1, 0, 1):
                    if (ox or oy) and pixels[x + ox, y + oy][3] >= 240:
                        solid_neighbors += 1
            if solid_neighbors >= 7:
                count += 1
    return count


def main():
    backup_current_files()

    idle = Image.open(IDLE).convert("RGBA")
    frames = [
        idle.copy(),
        close_tiny_arm_seams(
            replace_generated_arms(
                replace_stationary_head(
                    Image.open(BACKUP / "frame_02.png").convert("RGBA"),
                    idle,
                    5,
                    -4,
                ),
                idle,
                5,
                -14,
                14,
            ),
        ),
        idle.copy(),
        close_tiny_arm_seams(
            replace_generated_arms(
                replace_stationary_head(
                    Image.open(BACKUP / "frame_04.png").convert("RGBA"),
                    idle,
                    -5,
                    -4,
                ),
                idle,
                -5,
                14,
                -14,
            ),
        ),
    ]
    frames = [
        harden_pixel_art_alpha(
            repair_isolated_alpha_defects(
                repair_enclosed_transparent_specks(
                    harden_pixel_art_alpha(frame)
                )
            )
        )
        for frame in frames
    ]

    if any(frame.size != idle.size for frame in frames):
        raise RuntimeError("Walk-up frames no longer share the idle dimensions")
    if frames[0].tobytes() != frames[2].tobytes():
        raise RuntimeError("Neutral frames must remain identical")

    for index, frame in enumerate(frames, start=1):
        defects = count_isolated_alpha_defects(frame)
        if defects:
            raise RuntimeError(
                f"frame {index} still has {defects} enclosed alpha defects"
            )
        frame.save(DRAFT / f"frame_{index:02}.png", optimize=True)

    sheet = Image.new("RGBA", (idle.width * len(frames), idle.height))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * idle.width, 0))

    LIVE.mkdir(parents=True, exist_ok=True)
    sheet.save(LIVE / "sprite_sheet_review.png", optimize=True)
    sheet.save(DRAFT / "sprite_sheet_progress.png", optimize=True)

    print("Walk-up frames repaired and sheet rebuilt.")
    print("Head offsets: frame 2 = (+5, -4), frame 4 = (-5, -4).")
    print("Isolated transparent/weak-alpha defects: 0 in all frames.")


if __name__ == "__main__":
    main()
