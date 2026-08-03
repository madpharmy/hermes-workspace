"""Read-only Blender scene probe for the passive snap-track candidate.

Run after opening the candidate .blend in a fresh background Blender process:
blender candidate.blend --background --factory-startup --python-exit-code 1 \
  --python qa-passive-track-blender-probe.py -- --out scene-probe.json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import bmesh
import bpy


def arguments() -> argparse.Namespace:
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args(values)


def finite(values) -> bool:
    return all(math.isfinite(float(value)) for value in values)


def mesh_metrics(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    unseen = set(bm.verts)
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in unseen:
                    unseen.remove(other)
                    stack.append(other)
    zero_area_faces = sum(face.calc_area() <= 1e-12 for face in bm.faces)
    zero_length_edges = sum(edge.calc_length() <= 1e-12 for edge in bm.edges)
    signed_volume = bm.calc_volume(signed=True) if bm.faces else 0.0
    result = {
        "vertices": len(bm.verts),
        "edges": len(bm.edges),
        "polygons": len(bm.faces),
        "components": components,
        "non_manifold_edges": sum(not edge.is_manifold for edge in bm.edges),
        "zero_area_faces": zero_area_faces,
        "zero_length_edges": zero_length_edges,
        "signed_volume": round(float(signed_volume), 6),
        "dimensions": [round(float(value), 6) for value in obj.dimensions],
        "mesh_data_users": mesh.users,
        "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
        "modifiers": [{"name": modifier.name, "type": modifier.type, "show_render": modifier.show_render} for modifier in obj.modifiers],
    }
    bm.free()
    return result


def gate(status: str, expected: object, actual: object, evidence: str, hard_gate: bool = True) -> dict[str, object]:
    return {
        "status": status,
        "hard_gate": hard_gate,
        "expected": expected,
        "actual": actual,
        "evidence": evidence,
    }


def main() -> None:
    args = arguments()
    scene = bpy.context.scene
    view_layer = bpy.context.view_layer
    view_layer.update()
    objects = list(scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    object_type_counts = Counter(obj.type for obj in objects)
    material_missing = [obj.name for obj in meshes if not obj.material_slots or any(slot.material is None for slot in obj.material_slots)]
    nonfinite_transforms = [
        obj.name
        for obj in objects
        if not finite(obj.location) or not finite(obj.rotation_euler) or not finite(obj.scale)
    ]
    nonunit_scale = [obj.name for obj in meshes if any(abs(float(value) - 1.0) > 1e-6 for value in obj.scale)]
    modifiers = {
        obj.name: [{"name": modifier.name, "type": modifier.type} for modifier in obj.modifiers]
        for obj in meshes
        if obj.modifiers
    }
    mesh_users: dict[str, list[str]] = defaultdict(list)
    for obj in meshes:
        mesh_users[obj.data.name].append(obj.name)
    shared_mesh_groups = {name: names for name, names in mesh_users.items() if len(names) > 1}
    track_links = sorted(obj.name for obj in meshes if obj.name.startswith("TrackLink_"))
    plate_links = sorted(obj.name for obj in meshes if obj.name.startswith("PlateLink_"))
    root_collections = [collection.name for collection in scene.collection.children]
    all_collections = sorted(collection.name for collection in bpy.data.collections)
    render_visible_meshes = sorted(obj.name for obj in meshes if not obj.hide_render)
    current_camera = scene.camera.name if scene.camera else None
    key_names = [
        "LinkMaster",
        "BBGuideWheel",
        "BushingGuideWheel",
        "BBInnerHub",
        "PassiveTrackFrame",
        "BBRetainerFront",
        "BBRetainerRear",
    ]
    key_metrics = {name: mesh_metrics(bpy.data.objects[name]) for name in key_names if name in bpy.data.objects}
    required_present = all(name in bpy.data.objects for name in key_names)
    key_geometry_clean = all(
        item["components"] == 1
        and item["non_manifold_edges"] == 0
        and item["zero_area_faces"] == 0
        and item["zero_length_edges"] == 0
        and item["signed_volume"] > 0
        for item in key_metrics.values()
    )
    unit_actual = {
        "system": scene.unit_settings.system,
        "scale_length": scene.unit_settings.scale_length,
        "length_unit": scene.unit_settings.length_unit,
    }
    semantic_collections = {
        "MASTER",
        "KINEMATIC",
        "FABRICATION",
        "PLATE",
        "COUPONS",
        "PURCHASED_REFERENCE",
        "CAMERAS",
        "LIGHTS",
    }
    missing_semantic_collections = sorted(semantic_collections.difference(all_collections))
    independent_track_meshes = len({bpy.data.objects[name].data.name for name in track_links}) if track_links else 0
    independent_plate_meshes = len({bpy.data.objects[name].data.name for name in plate_links}) if plate_links else 0

    checks = {
        "tool.blender_scene_load": gate(
            "verified",
            "candidate opens in a fresh background Blender process",
            {"filepath": bpy.data.filepath, "version": bpy.app.version_string, "background": bpy.app.background},
            bpy.data.filepath,
        ),
        "scene.required_objects": gate(
            "verified" if required_present and len(track_links) == 28 and len(plate_links) == 28 else "failed",
            {"required_key_objects": key_names, "assembled_links": 28, "plate_links": 28},
            {"required_present": required_present, "assembled_links": len(track_links), "plate_links": len(plate_links)},
            bpy.data.filepath,
        ),
        "scene.units_mm_explicit": gate(
            "verified" if unit_actual["system"] == "METRIC" and abs(unit_actual["scale_length"] - 0.001) <= 1e-12 and unit_actual["length_unit"] == "MILLIMETERS" else "failed",
            {"system": "METRIC", "scale_length": 0.001, "length_unit": "MILLIMETERS"},
            unit_actual,
            bpy.data.filepath,
        ),
        "scene.transforms_finite_and_scaled": gate(
            "verified" if not nonfinite_transforms and not nonunit_scale else "failed",
            "finite transforms and unit object scale for mesh objects",
            {"nonfinite_transforms": nonfinite_transforms, "nonunit_scale": nonunit_scale},
            bpy.data.filepath,
        ),
        "scene.key_geometry_integrity": gate(
            "verified" if key_geometry_clean else "failed",
            "key parts are one component, manifold, nondegenerate, and outward-oriented",
            key_metrics,
            bpy.data.filepath,
        ),
        "scene.modifier_application": gate(
            "verified_with_warnings" if not modifiers else "failed",
            "fabrication candidate has no unapplied modifiers; editable master separately preserves construction stacks",
            {"unapplied_modifiers": modifiers, "editable_modifier_master_present": False},
            bpy.data.filepath,
        ),
        "scene.source_evaluated_export_separation": gate(
            "failed" if missing_semantic_collections else "verified",
            "semantic source/evaluated/export/plate/reference/camera/light collections exist",
            {"collections": all_collections, "missing": missing_semantic_collections},
            bpy.data.filepath,
        ),
        "scene.repeated_link_instancing": gate(
            "verified" if independent_track_meshes == 1 and independent_plate_meshes == 1 else "failed",
            "repeated presentation and plate links share immutable mesh data",
            {
                "assembled_link_objects": len(track_links),
                "assembled_unique_meshes": independent_track_meshes,
                "plate_link_objects": len(plate_links),
                "plate_unique_meshes": independent_plate_meshes,
                "shared_mesh_groups": shared_mesh_groups,
            },
            bpy.data.filepath,
            hard_gate=False,
        ),
        "scene.material_assignment": gate(
            "verified" if not material_missing else "failed",
            "every mesh object has a non-null material",
            {"missing_material_objects": material_missing},
            bpy.data.filepath,
        ),
        "scene.default_render_readiness": gate(
            "verified" if current_camera and any(name.startswith("TrackLink_") for name in render_visible_meshes) else "failed",
            "fresh reopen has a camera and defaults to the assembled proof, not only the print plate",
            {"scene_camera": current_camera, "render_visible_mesh_count": len(render_visible_meshes), "render_visible_meshes": render_visible_meshes},
            bpy.data.filepath,
            hard_gate=False,
        ),
    }

    output = {
        "schema": "qa.passive-track-blender-scene.v1",
        "blender": {
            "version": bpy.app.version_string,
            "background": bpy.app.background,
            "filepath": bpy.data.filepath,
        },
        "scene": {
            "name": scene.name,
            "object_type_counts": dict(object_type_counts),
            "mesh_object_count": len(meshes),
            "collections": all_collections,
            "root_collections": root_collections,
            "unit_settings": unit_actual,
            "render_engine": scene.render.engine,
            "render_resolution": [scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage],
            "render_filepath": scene.render.filepath,
            "scene_camera": current_camera,
            "render_visible_mesh_count": len(render_visible_meshes),
            "all_mesh_vertices": sum(len(obj.data.vertices) for obj in meshes),
            "all_mesh_polygons": sum(len(obj.data.polygons) for obj in meshes),
        },
        "checks": checks,
        "summary": dict(Counter(item["status"] for item in checks.values())),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))
    if any(item["status"] == "failed" and item["hard_gate"] for item in checks.values()):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
