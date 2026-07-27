from pipeline.edit_stage import resolve_position_arg


def test_resolve_position_arg_explicit_dict():
    assert resolve_position_arg({"x": 40, "y": 1600}, default="bottom-right") == "40,1600"


def test_resolve_position_arg_legacy_string():
    assert resolve_position_arg("top-left", default="bottom-right") == "top-left"


def test_resolve_position_arg_absent_falls_back_to_default():
    assert resolve_position_arg(None, default="bottom-right") == "bottom-right"
