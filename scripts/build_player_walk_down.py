from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
IDLE_PATH = ROOT / "art" / "player_idle" / "player_idle_down.png"
DRAFT = ROOT / "art" / "animation_drafts" / "player_walk_down_9frame"
LIVE = ROOT / "art" / "animations" / "player_walk_down"

LEFT_ARM = (0, 380, 140, 600)
RIGHT_ARM = (347, 380, 487, 600)
LEFT_BOOT = (65, 565, 235, 679)
RIGHT_BOOT = (252, 565, 430, 679)


def colored_part_mask(image, box):
    """Select a brown/skin limb plus its dark outline inside a safe box."""
    crop = image.crop(box)
    source = crop.load()
    seed = Image.new("L", crop.size)
    seed_pixels = seed.load()
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue, alpha = source[x, y]
            if (
                alpha >= 24
                and red >= 45
                and red > green * 1.07
                and red > blue * 1.10
            ):
                seed_pixels[x, y] = 255

    nearby = seed.filter(ImageFilter.MaxFilter(23))
    near_pixels = nearby.load()
    mask = Image.new("L", crop.size)
    mask_pixels = mask.load()
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue, alpha = source[x, y]
            green_cloth = green > red * 1.16 and green > blue * 1.08
            silver_belt = (
                abs(red - green) < 20
                and abs(green - blue) < 20
                and max(red, green, blue) > 70
            )
            if (
                seed_pixels[x, y]
                or (
                    near_pixels[x, y]
                    and alpha > 0
                    and not green_cloth
                    and not silver_belt
                    and max(red, green, blue) < 105
                )
            ):
                mask_pixels[x, y] = alpha
    return mask


def part_mask(image, box):
    if box in (LEFT_BOOT, RIGHT_BOOT):
        return image.crop(box).getchannel("A")
    return colored_part_mask(image, box)


def part_layer(image, box):
    crop = image.crop(box)
    crop.putalpha(part_mask(image, box))
    return crop


def remove_shifted_part(canvas, idle, box, body_dx, body_dy):
    mask = part_mask(idle, box)
    mask_pixels = mask.load()
    canvas_pixels = canvas.load()
    x0, y0, x1, y1 = box
    for local_y in range(y1 - y0):
        for local_x in range(x1 - x0):
            if not mask_pixels[local_x, local_y]:
                continue
            x = x0 + body_dx + local_x
            y = y0 + body_dy + local_y
            if 0 <= x < canvas.width and 0 <= y < canvas.height:
                canvas_pixels[x, y] = (0, 0, 0, 0)


def close_tiny_seams(image):
    """Close only one-to-three-pixel gaps at moved limb joints."""
    result = image.copy()
    alpha = result.getchannel("A").point(lambda value: 255 if value >= 24 else 0)
    closed = alpha.filter(ImageFilter.MaxFilter(5)).filter(
        ImageFilter.MinFilter(5)
    )
    pixels = result.load()
    alpha_pixels = alpha.load()
    closed_pixels = closed.load()
    additions = [
        (x, y)
        for y in range(result.height)
        for x in range(result.width)
        if not alpha_pixels[x, y] and closed_pixels[x, y]
    ]
    for x, y in additions:
        replacement = None
        for radius in range(1, 5):
            for oy in range(-radius, radius + 1):
                for ox in range(-radius, radius + 1):
                    nx, ny = x + ox, y + oy
                    if (
                        0 <= nx < result.width
                        and 0 <= ny < result.height
                        and alpha_pixels[nx, ny]
                    ):
                        replacement = pixels[nx, ny]
                        break
                if replacement:
                    break
            if replacement:
                break
        if replacement:
            pixels[x, y] = replacement[:3] + (255,)
    return result


def make_step(
    idle,
    body_dx,
    body_dy,
    left_arm_delta,
    right_arm_delta,
    left_boot_delta,
    right_boot_delta,
):
    frame = Image.new("RGBA", idle.size)
    frame.alpha_composite(idle, (body_dx, body_dy))

    parts = [
        (LEFT_ARM, left_arm_delta),
        (RIGHT_ARM, right_arm_delta),
        (LEFT_BOOT, left_boot_delta),
        (RIGHT_BOOT, right_boot_delta),
    ]
    for box, _ in parts:
        remove_shifted_part(frame, idle, box, body_dx, body_dy)
    for box, (part_dx, part_dy) in parts:
        layer = part_layer(idle, box)
        frame.alpha_composite(
            layer,
            (box[0] + body_dx + part_dx, box[1] + body_dy + part_dy),
        )
    return close_tiny_seams(frame)


def main():
    idle = Image.open(IDLE_PATH).convert("RGBA")
    transition_a = make_step(
        idle, 6, -6,
        left_arm_delta=(-3, -7),
        right_arm_delta=(-3, 7),
        left_boot_delta=(-3, 7),
        right_boot_delta=(3, -9),
    )
    full_a = make_step(
        idle, 12, -12,
        left_arm_delta=(-6, -14),
        right_arm_delta=(-6, 14),
        left_boot_delta=(-6, 14),
        right_boot_delta=(6, -18),
    )
    transition_b = make_step(
        idle, -6, -6,
        left_arm_delta=(3, 7),
        right_arm_delta=(3, -7),
        left_boot_delta=(-3, -9),
        right_boot_delta=(3, 7),
    )
    full_b = make_step(
        idle, -12, -12,
        left_arm_delta=(6, 14),
        right_arm_delta=(6, -14),
        left_boot_delta=(-6, -18),
        right_boot_delta=(6, 14),
    )

    frames = [
        idle.copy(),
        transition_a,
        full_a,
        transition_a.copy(),
        idle.copy(),
        transition_b,
        full_b,
        transition_b.copy(),
        idle.copy(),
    ]
    if not (
        frames[0].tobytes() == frames[4].tobytes() == frames[8].tobytes()
    ):
        raise RuntimeError("Frames 1, 5, and 9 must be identical idle frames")
    if any(frame.size != idle.size for frame in frames):
        raise RuntimeError("A walk-down frame changed dimensions")

    DRAFT.mkdir(parents=True, exist_ok=True)
    LIVE.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        frame.save(DRAFT / f"frame_{index:02}.png", optimize=True)

    sheet = Image.new("RGBA", (idle.width * len(frames), idle.height))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * idle.width, 0))
    sheet.save(DRAFT / "sprite_sheet_progress.png", optimize=True)
    sheet.save(LIVE / "sprite_sheet_review.png", optimize=True)
    print("Built nine-frame player walk-down cycle.")


if __name__ == "__main__":
    main()
