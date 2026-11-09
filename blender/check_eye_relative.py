import bpy
from mathutils import Vector

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
bpy.ops.wm.open_mainfile(filepath=source_blend)

body = bpy.data.objects.get("GEO-body_male_stylized")
eye_l = bpy.data.objects.get("GEO-body_male_stylized.eye.L")
eye_r = bpy.data.objects.get("GEO-body_male_stylized.eye.R")

print("Male Body Loc:", body.location)
print("Eye L Loc (local to parent):", eye_l.location)
print("Eye R Loc (local to parent):", eye_r.location)
print("Eye L World Center:", eye_l.matrix_world.translation)
print("Eye R World Center:", eye_r.matrix_world.translation)

# Check distance between eye centers
dist = (eye_l.matrix_world.translation - eye_r.matrix_world.translation).length
print(f"Inter-pupillary distance: {dist*1000:.1f} mm")
print(f"Eye L relative to Body center: {eye_l.matrix_world.translation - body.matrix_world.translation}")
print(f"Eye R relative to Body center: {eye_r.matrix_world.translation - body.matrix_world.translation}")

