import bpy
from mathutils import Vector

blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

def analyze_arms(obj_name):
    obj = bpy.data.objects.get(obj_name)
    verts = [v.co for v in obj.data.vertices]
    print(f"=== {obj_name} Arms ===")
    
    # Arm vertices have abs(x) > 0.16 and z between 0.70 and 1.50
    arm_verts = [v for v in verts if v.x > 0.15 and v.z > 0.65 and v.z < 1.45]
    
    # Sort by X distance to find shoulder -> elbow -> wrist -> fingers
    for x_step in [0.20, 0.25, 0.30, 0.35, 0.40]:
        strip = [v for v in arm_verts if abs(v.x - x_step) < 0.025]
        if strip:
            avg_z = sum(v.z for v in strip) / len(strip)
            avg_y = sum(v.y for v in strip) / len(strip)
            print(f"  X={x_step:.2f}m -> Z={avg_z:.3f}m, Y={avg_y:.3f}m")

analyze_arms("GEO-body_male_stylized")
analyze_arms("GEO-body_female_stylized")

