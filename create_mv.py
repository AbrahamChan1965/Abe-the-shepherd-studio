"""Create a 1080p music video from an MP3 and a background image using MoviePy.

Default inputs:
- song.mp3
- background.jpg

Output:
- output.mp4
"""

from __future__ import annotations

import argparse
from pathlib import Path

from moviepy import (
    AudioFileClip,
    CompositeVideoClip,
    ImageClip,
    TextClip,
)


DEFAULT_TITLE = "Tyre: Silk & Cedar"


def build_video(
    audio_path: Path,
    background_path: Path,
    output_path: Path,
    title: str = DEFAULT_TITLE,
    fps: int = 30,
) -> None:
    """Generate a 1920x1080 MP4 with centered title text overlay."""
    with AudioFileClip(str(audio_path)) as audio:
        duration = audio.duration

        background = (
            ImageClip(str(background_path))
            .resized(new_size=(1920, 1080))
            .with_duration(duration)
        )

        title_clip = (
            TextClip(
                text=title,
                font_size=72,
                color="white",
                stroke_color="black",
                stroke_width=2,
                method="caption",
                size=(1600, None),
                text_align="center",
            )
            .with_position(("center", "bottom"))
            .with_duration(duration)
        )

        video = CompositeVideoClip([background, title_clip], size=(1920, 1080)).with_audio(audio)

        video.write_videofile(
            str(output_path),
            fps=fps,
            codec="libx264",
            audio_codec="aac",
            preset="medium",
            threads=4,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Combine an MP3 and JPG into a 1080p MP4 with a title overlay."
    )
    parser.add_argument("--audio", default="song.mp3", help="Input MP3 path")
    parser.add_argument("--image", default="background.jpg", help="Input JPG/PNG path")
    parser.add_argument("--output", default="output.mp4", help="Output MP4 path")
    parser.add_argument("--title", default=DEFAULT_TITLE, help="Title overlay text")
    parser.add_argument("--fps", type=int, default=30, help="Output FPS")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_video(
        audio_path=Path(args.audio),
        background_path=Path(args.image),
        output_path=Path(args.output),
        title=args.title,
        fps=args.fps,
    )


if __name__ == "__main__":
    main()
