import bpy
from mathutils import Vector

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
bpy.ops.wm.open_mainfile(filepath=source_blend)

for name in [
    "GEO-body_male_stylized.eye.L",
    "GEO-body_male_stylized.eye.R",
    "GEO-body_female_stylized.eye.L",
    "GEO-body_female_stylized.eye.R",
    "Eye - Stylized",
    "stylized_eye"
]:
    obj = bpy.data.objects.get(name)
    if obj:
        print(f"=== {name} ===")
        print("  Location:", obj.location)
        print("  Rotation:", obj.rotation_euler)
        print("  Scale:", obj.scale)
        print("  Parent:", obj.parent.name if obj.parent else "None")
        print("  Materials:", [m.name for m in obj.data.materials if m])
        print("  UV layers:", [uv.name for uv in obj.data.uv_layers])
        print("  Verts:", len(obj.data.vertices), "Polys:", len(obj.data.polygons))
        bbox = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        print(f"  Center: ({(min(v.x for v in bbox)+max(v.x for v in bbox))/2:.3f}, {(min(v.y for v in bbox)+max(v.y for v in bbox))/2:.3f}, {(min(v.z for v in bbox)+max(v.z for v in bbox))/2:.3f})")

