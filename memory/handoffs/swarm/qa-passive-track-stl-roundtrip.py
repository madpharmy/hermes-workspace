"""Blender STL import/export/import round-trip smoke for passive snap-track artifacts."""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy

NAMES = (
    "replacement-link.stl",
    "bb-guide-wheel.stl",
    "bushing-guide-wheel.stl",
    "bb-cartridge-print-parts.stl",
    "passive-snap-track-plate.stl",
)


def arguments() -> argparse.Namespace:
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--roundtrip-dir", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args(values)


def clean() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def object_metrics(obj: bpy.types.Object) -> dict[str, object]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    result = {
        "vertices": len(bm.verts),
        "edges": len(bm.edges),
        "polygons": len(bm.faces),
        "non_manifold_edges": sum(not edge.is_manifold for edge in bm.edges),
        "degenerate_faces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "dimensions": [round(float(value), 6) for value in obj.dimensions],
        "finite_transform": all(math.isfinite(float(value)) for vector in (obj.location, obj.rotation_euler, obj.scale) for value in vector),
    }
    bm.free()
    return result


def import_metrics(path: Path) -> dict[str, object]:
    clean()
    bpy.ops.wm.stl_import(filepath=str(path), use_scene_unit=False)
    bpy.context.view_layer.update()
    imported = sorted((obj for obj in bpy.context.selected_objects if obj.type == "MESH"), key=lambda item: item.name)
    return {
        "object_count": len(imported),
        "objects": [object_metrics(obj) for obj in imported],
        "selected_names": [obj.name for obj in imported],
    }


def signature(report: dict[str, object]) -> list[tuple[object, ...]]:
    return sorted(
        (
            item["vertices"],
            item["edges"],
            item["polygons"],
            tuple(item["dimensions"]),
            item["non_manifold_edges"],
            item["degenerate_faces"],
        )
        for item in report["objects"]
    )


def main() -> None:
    args = arguments()
    args.roundtrip_dir.mkdir(parents=True, exist_ok=True)
    reports: dict[str, object] = {}
    for name in NAMES:
        source = args.candidate / name
        first = import_metrics(source)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in bpy.context.scene.objects:
            if obj.type == "MESH":
                obj.select_set(True)
        target = args.roundtrip_dir / name
        bpy.ops.wm.stl_export(
            filepath=str(target),
            check_existing=False,
            ascii_format=False,
            export_selected_objects=True,
            apply_modifiers=True,
            use_scene_unit=False,
        )
        second = import_metrics(target)
        same_geometry = signature(first) == signature(second)
        clean_manifold = all(
            item["non_manifold_edges"] == 0 and item["degenerate_faces"] == 0 and item["finite_transform"]
            for item in first["objects"] + second["objects"]
        )
        reports[name] = {
            "status": "verified" if same_geometry and clean_manifold else "failed",
            "source_import": first,
            "roundtrip_import": second,
            "same_geometry_signature": same_geometry,
            "clean_manifold": clean_manifold,
            "roundtrip_path": str(target),
        }
    output = {
        "schema": "qa.passive-track-stl-roundtrip.v1",
        "blender_version": bpy.app.version_string,
        "candidate": str(args.candidate.resolve()),
        "files": reports,
        "summary": dict(Counter(item["status"] for item in reports.values())),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))
    if any(item["status"] == "failed" for item in reports.values()):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
