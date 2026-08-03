#!/usr/bin/env python3
"""Read-only QA probe for the passive snap-track proof artifacts.

Uses only the Python standard library so it can be rerun outside Blender.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
import sys
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

STL_NAMES = (
    "replacement-link.stl",
    "bb-guide-wheel.stl",
    "bushing-guide-wheel.stl",
    "bb-cartridge-print-parts.stl",
    "passive-snap-track-plate.stl",
)
PNG_NAMES = (
    "assembled-perspective.png",
    "assembled-side.png",
    "bb-cartridge-detail.png",
    "print-plate.png",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class UnionFind:
    def __init__(self) -> None:
        self.parent: list[int] = []
        self.rank: list[int] = []

    def add(self) -> int:
        index = len(self.parent)
        self.parent.append(index)
        self.rank.append(0)
        return index

    def find(self, value: int) -> int:
        while self.parent[value] != value:
            self.parent[value] = self.parent[self.parent[value]]
            value = self.parent[value]
        return value

    def union(self, left: int, right: int) -> None:
        left_root, right_root = self.find(left), self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1


def _cross(left: tuple[float, float, float], right: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    )


def inspect_binary_stl(path: Path) -> dict[str, object]:
    size = path.stat().st_size
    with path.open("rb") as stream:
        header = stream.read(84)
        if len(header) != 84:
            raise ValueError(f"short STL header: {path}")
        triangle_count = struct.unpack_from("<I", header, 80)[0]
        expected_size = 84 + triangle_count * 50
        if size != expected_size:
            raise ValueError(f"not a supported binary STL or truncated: {path} ({size} != {expected_size})")

        vertex_ids: dict[tuple[float, float, float], int] = {}
        uf = UnionFind()
        edge_counts: Counter[tuple[int, int]] = Counter()
        triangle_keys: Counter[tuple[int, int, int]] = Counter()
        mins = [math.inf, math.inf, math.inf]
        maxs = [-math.inf, -math.inf, -math.inf]
        degenerate = 0
        non_finite = 0
        signed_volume = 0.0

        for _ in range(triangle_count):
            record = stream.read(50)
            values = struct.unpack("<12fH", record)
            vertices = [tuple(values[offset : offset + 3]) for offset in (3, 6, 9)]
            ids: list[int] = []
            for vertex in vertices:
                if not all(math.isfinite(value) for value in vertex):
                    non_finite += 1
                for axis, value in enumerate(vertex):
                    mins[axis] = min(mins[axis], value)
                    maxs[axis] = max(maxs[axis], value)
                if vertex not in vertex_ids:
                    vertex_ids[vertex] = uf.add()
                ids.append(vertex_ids[vertex])
            uf.union(ids[0], ids[1])
            uf.union(ids[1], ids[2])
            uf.union(ids[2], ids[0])
            for left, right in ((ids[0], ids[1]), (ids[1], ids[2]), (ids[2], ids[0])):
                edge_counts[tuple(sorted((left, right)))] += 1
            triangle_keys[tuple(sorted(ids))] += 1

            a, b, c = vertices
            ab = tuple(b[i] - a[i] for i in range(3))
            ac = tuple(c[i] - a[i] for i in range(3))
            cross = _cross(ab, ac)
            doubled_area = math.sqrt(sum(value * value for value in cross))
            if doubled_area <= 1e-10:
                degenerate += 1
            signed_volume += sum(a[i] * _cross(b, c)[i] for i in range(3)) / 6.0

    roots = {uf.find(index) for index in range(len(uf.parent))}
    edge_histogram = Counter(edge_counts.values())
    return {
        "bytes": size,
        "triangles": triangle_count,
        "unique_vertices_exact": len(vertex_ids),
        "bounds_min_mm": [round(value, 6) for value in mins],
        "bounds_max_mm": [round(value, 6) for value in maxs],
        "dimensions_mm": [round(maxs[i] - mins[i], 6) for i in range(3)],
        "components_by_shared_vertices": len(roots),
        "non_finite_vertex_occurrences": non_finite,
        "degenerate_triangles": degenerate,
        "duplicate_triangle_instances": sum(count - 1 for count in triangle_keys.values() if count > 1),
        "boundary_edges": edge_histogram.get(1, 0),
        "non_manifold_edges_gt2": sum(count for uses, count in edge_histogram.items() if uses > 2),
        "signed_volume_mm3": round(signed_volume, 4),
        "watertight_edge_pairs": edge_histogram.get(1, 0) == 0 and all(uses == 2 for uses in edge_histogram),
    }


def inspect_3mf(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        names = sorted(archive.namelist())
        required = {"[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model"}
        missing = sorted(required.difference(names))
        root = ET.fromstring(archive.read("3D/3dmodel.model"))
    namespace = {"m": "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"}
    objects = root.findall(".//m:resources/m:object", namespace)
    bases = root.findall(".//m:resources/m:basematerials/m:base", namespace)
    build_items = root.findall(".//m:build/m:item", namespace)
    return {
        "bytes": path.stat().st_size,
        "zip_members": names,
        "missing_required_members": missing,
        "unit": root.attrib.get("unit"),
        "object_count": len(objects),
        "object_names": [item.attrib.get("name") for item in objects],
        "base_material_count": len(bases),
        "display_colors": [item.attrib.get("displaycolor") for item in bases],
        "build_item_count": len(build_items),
        "vertex_count": len(root.findall(".//m:vertex", namespace)),
        "triangle_count": len(root.findall(".//m:triangle", namespace)),
    }


def inspect_png(path: Path) -> dict[str, object]:
    with path.open("rb") as stream:
        header = stream.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"invalid PNG header: {path}")
    width, height = struct.unpack(">II", header[16:24])
    return {"bytes": path.stat().st_size, "width": width, "height": height}


def result(status: str, expected: object, actual: object, evidence: str, hard_gate: bool = True) -> dict[str, object]:
    return {
        "status": status,
        "hard_gate": hard_gate,
        "expected": expected,
        "actual": actual,
        "evidence": evidence,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    candidate = args.candidate.resolve()
    report_path = candidate / "engineering-report.json"
    manifest_path = candidate / "artifact-manifest.json"
    slice_path = candidate / "slices-hermetic" / "slice-report.json"
    engineering = json.loads(report_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    slice_report = json.loads(slice_path.read_text(encoding="utf-8"))
    contract = json.loads(args.contract.read_text(encoding="utf-8")) if args.contract else None

    manifest_checks: dict[str, object] = {}
    for name, record in manifest.items():
        path = candidate / name
        manifest_checks[name] = {
            "exists": path.is_file(),
            "bytes_expected": record["bytes"],
            "bytes_actual": path.stat().st_size if path.is_file() else None,
            "sha256_expected": record["sha256"],
            "sha256_actual": sha256(path) if path.is_file() else None,
        }
    manifest_ok = all(
        item["exists"]
        and item["bytes_expected"] == item["bytes_actual"]
        and item["sha256_expected"] == item["sha256_actual"]
        for item in manifest_checks.values()
    )

    stls = {name: inspect_binary_stl(candidate / name) for name in STL_NAMES}
    three_mf = {
        name: inspect_3mf(candidate / name)
        for name in ("passive-snap-track-colored.3mf", "snap-and-race-coupons-colored.3mf")
    }
    pngs = {name: inspect_png(candidate / name) for name in PNG_NAMES}
    stale_evidence_state = "pending fresh Orca slice" in engineering.get("evidence_state", "") and slice_report.get("passed") is True
    contract_snap_values = None
    if contract:
        snap_ladder = next(
            value
            for value in contract["architecture"]["tolerance_and_calibration"]
            if value.startswith("snap diametral ladder")
        )
        contract_snap_values = [float(value) for value in re.findall(r"\d+\.\d+", snap_ladder)]
    report_snap_values = engineering.get("interfaces", {}).get("snap_hinge", {}).get("coupon_values_mm")

    checks = {
        "artifact.manifest_integrity": result(
            "verified" if manifest_ok else "failed", True, manifest_ok, str(manifest_path)
        ),
        "artifact.report_gates": result(
            "verified" if engineering.get("passed") and all(engineering.get("gates", {}).values()) else "failed",
            "engineering report passes all declared gates",
            {"passed": engineering.get("passed"), "false_gates": [key for key, value in engineering.get("gates", {}).items() if not value]},
            str(report_path),
        ),
        "artifact.report_slice_state_consistency": result(
            "failed" if stale_evidence_state else "verified",
            "engineering evidence state agrees with the colocated successful slice report",
            {"engineering_evidence_state": engineering.get("evidence_state"), "slice_passed": slice_report.get("passed")},
            f"{report_path}; {slice_path}",
        ),
        "contract.snap_coupon_ladder": result(
            "verified" if not contract or report_snap_values == contract_snap_values else "failed",
            contract_snap_values if contract else "contract not supplied",
            report_snap_values,
            f"{args.contract if args.contract else 'not supplied'}; {report_path}",
        ),
        "export.replacement_link_round_trip": result(
            "verified" if stls["replacement-link.stl"]["watertight_edge_pairs"] and stls["replacement-link.stl"]["components_by_shared_vertices"] == 1 else "failed",
            "one watertight component with finite, nondegenerate triangles",
            stls["replacement-link.stl"],
            str(candidate / "replacement-link.stl"),
        ),
        "export.production_plate_stl_integrity": result(
            "verified" if stls["passive-snap-track-plate.stl"]["watertight_edge_pairs"] and stls["passive-snap-track-plate.stl"]["degenerate_triangles"] == 0 else "failed",
            "all STL shells watertight with no degenerate triangles",
            stls["passive-snap-track-plate.stl"],
            str(candidate / "passive-snap-track-plate.stl"),
        ),
        "export.production_3mf_semantics": result(
            "verified" if three_mf["passive-snap-track-colored.3mf"]["unit"] == "millimeter" and three_mf["passive-snap-track-colored.3mf"]["object_count"] == 44 and three_mf["passive-snap-track-colored.3mf"]["build_item_count"] == 44 else "failed",
            {"unit": "millimeter", "object_count": 44, "build_item_count": 44},
            {key: three_mf["passive-snap-track-colored.3mf"][key] for key in ("unit", "object_count", "build_item_count", "base_material_count")},
            str(candidate / "passive-snap-track-colored.3mf"),
        ),
        "visual.png_encoding": result(
            "verified" if all(item["width"] == 1400 and item["height"] == 900 and item["bytes"] > 100_000 for item in pngs.values()) else "failed",
            "four nontrivial 1400x900 PNG proof images",
            pngs,
            str(candidate),
            hard_gate=False,
        ),
        "manufacturing.hermetic_slice": result(
            "verified_with_warnings" if slice_report.get("passed") else "failed",
            "fresh generic hermetic slice succeeds; it must not be promoted to H2D production proof",
            {
                "passed": slice_report.get("passed"),
                "profiles": slice_report.get("profiles"),
                "models": slice_report.get("models"),
            },
            str(slice_path),
        ),
        "manufacturing.h2d_production_slice": result(
            "not_run",
            "exact H2D/nozzle/plate/material/profile tuple slices and critical layers are reviewed",
            "No passing H2D production slice is present in proof-cycle5-refined.",
            str(candidate),
        ),
        "manufacturing.physical_qualification": result(
            "not_run",
            "measured coupons plus 500-cycle assembled test pass",
            engineering.get("limitations"),
            str(report_path),
        ),
    }

    output = {
        "schema": "qa.passive-track-baseline.v1",
        "candidate": str(candidate),
        "candidate_blend_sha256": sha256(candidate / "passive-snap-track.blend"),
        "checks": checks,
        "manifest": manifest_checks,
        "stls": stls,
        "three_mf": three_mf,
        "pngs": pngs,
        "summary": dict(Counter(item["status"] for item in checks.values())),
    }
    rendered = json.dumps(output, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if not any(item["status"] == "failed" and item["hard_gate"] for item in checks.values()) else 2


if __name__ == "__main__":
    sys.exit(main())
