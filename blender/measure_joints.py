import bpy
import numpy as np
from mathutils import Vector

blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

def analyze_mesh_landmarks(obj_name):
    obj = bpy.data.objects.get(obj_name)
    if not obj:
        print(f"Object {obj_name} not found")
        return
    
    verts = [v.co for v in obj.data.vertices]
    zs = [v.z for v in verts]
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    
    min_z, max_z = min(zs), max(zs)
    print(f"=== {obj_name} Analysis ===")
    print(f"Z range: {min_z:.3f} to {max_z:.3f} (Height: {max_z - min_z:.3f})")
    
    # Slice through Z levels to find centers and widths
    for name, z_pct in [
        ("Cranium Top", 1.0),
        ("Eyes/Nose", 0.88),
        ("Chin", 0.81),
        ("Neck", 0.78),
        ("Shoulders", 0.74),
        ("Chest", 0.68),
        ("Waist", 0.58),
        ("Hips/Pelvis", 0.50),
        ("Knees", 0.28),
        ("Ankles", 0.06),
        ("Feet Base", 0.01)
    ]:
        target_z = min_z + (max_z - min_z) * z_pct
        band = [v for v in verts if abs(v.z - target_z) < 0.03]
        if band:
            avg_y = sum(v.y for v in band) / len(band)
            max_x = max(abs(v.x) for v in band)
            print(f"  {name:15} Z={target_z:.3f}m, avgY={avg_y:.3f}m, halfWidth={max_x:.3f}m")

analyze_mesh_landmarks("GEO-body_male_stylized")
analyze_mesh_landmarks("GEO-body_female_stylized")

