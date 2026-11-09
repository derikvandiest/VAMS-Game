import bpy
from mathutils import Vector

blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

for name in ["GEO-body_male_stylized", "GEO-body_female_stylized"]:
    obj = bpy.data.objects.get(name)
    if obj:
        # Compute world-space bbox
        bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        min_z = min(v.z for v in bbox)
        max_z = max(v.z for v in bbox)
        min_x = min(v.x for v in bbox)
        max_x = max(v.x for v in bbox)
        min_y = min(v.y for v in bbox)
        max_y = max(v.y for v in bbox)
        height = max_z - min_z
        width = max_x - min_x
        depth = max_y - min_y
        print(f"=== {name} ===")
        print(f"  Height: {height:.3f}m, MinZ: {min_z:.3f}m, MaxZ: {max_z:.3f}m")
        print(f"  Width: {width:.3f}m, Depth: {depth:.3f}m")
        print(f"  Location: {obj.location}")
        print(f"  Scale: {obj.scale}")
        print(f"  Vertex groups: {len(obj.vertex_groups)}")
        print(f"  Modifiers: {[m.type for m in obj.modifiers]}")

