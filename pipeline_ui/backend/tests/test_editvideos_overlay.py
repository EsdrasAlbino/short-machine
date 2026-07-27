import argparse

import editVideos


def _base_args(**overrides):
    defaults = dict(
        background=None,
        canvas_size="1080x1920",
        watermark=None,
        watermark_position="bottom-right",
        watermark_opacity=1.0,
        icon_position=[],
    )
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


def test_resolve_position_named():
    assert editVideos.resolve_position("bottom-right") == ("W-w-20", "H-h-20")


def test_resolve_position_explicit_coordinates():
    assert editVideos.resolve_position("40,1600") == ("40", "1600")


def test_resolve_position_explicit_coordinates_strips_whitespace():
    assert editVideos.resolve_position(" 40 , 1600 ") == ("40", "1600")


def test_build_filter_complex_watermark_named_position():
    args = _base_args(watermark="logo.png", watermark_position="top-left")
    filter_complex, _ = editVideos.build_filter_complex(args, {"video": 0, "watermark": 1}, srt_path=None)
    assert "overlay=20:20" in filter_complex


def test_build_filter_complex_watermark_explicit_position():
    args = _base_args(watermark="logo.png", watermark_position="40,1600")
    filter_complex, _ = editVideos.build_filter_complex(args, {"video": 0, "watermark": 1}, srt_path=None)
    assert "overlay=40:1600" in filter_complex


def test_build_filter_complex_icon_explicit_position():
    args = _base_args(icon_position=["900,60"])
    filter_complex, _ = editVideos.build_filter_complex(
        args, {"video": 0, "icons": [1]}, srt_path=None
    )
    assert "overlay=900:60" in filter_complex
