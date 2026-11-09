import bpy

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
bpy.ops.wm.open_mainfile(filepath=source_blend)

body = bpy.data.objects.get("GEO-body_female_stylized")
eye_l = bpy.data.objects.get("GEO-body_female_stylized.eye.L")
eye_r = bpy.data.objects.get("GEO-body_female_stylized.eye.R")

print(f"Female Eye L relative to Body center: {eye_l.matrix_world.translation - body.matrix_world.translation}")
print(f"Female Eye R relative to Body center: {eye_r.matrix_world.translation - body.matrix_world.translation}")

