import bpy
from mathutils import Vector
import math

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
bpy.ops.wm.open_mainfile(filepath=source_blend)

def create_pbr_material(name, hex_color, roughness=0.2, metalness=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        hex_c = hex_color.lstrip('#')
        r = pow(int(hex_c[0:2], 16) / 255.0, 2.2)
        g = pow(int(hex_c[2:4], 16) / 255.0, 2.2)
        b = pow(int(hex_c[4:6], 16) / 255.0, 2.2)
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metalness
    return mat

mat_skin = create_pbr_material("Mat_Skin", "#e5a782", roughness=0.55)
mat_sclera = create_pbr_material("Mat_Eye_Sclera", "#f8fafc", roughness=0.15)
mat_iris = create_pbr_material("Mat_Eye_Iris", "#3b82f6", roughness=0.10)
mat_pupil = create_pbr_material("Mat_Eye_Pupil", "#09090b", roughness=0.05)

body = bpy.data.objects.get("GEO-body_male_stylized")
body.data.materials.clear()
body.data.materials.append(mat_skin)

for eye_name in ["GEO-body_male_stylized.eye.L", "GEO-body_male_stylized.eye.R"]:
    eye = bpy.data.objects.get(eye_name)
    if not eye: continue
    eye.data.materials.clear()
    eye.data.materials.append(mat_sclera)
    eye.data.materials.append(mat_iris)
    eye.data.materials.append(mat_pupil)
    for poly in eye.data.polygons:
        c = poly.center
        r = math.hypot(c.x, c.z)
        if c.y < -0.015:
            if r < 0.009:
                poly.material_index = 2
            elif r < 0.021:
                poly.material_index = 1
            else:
                poly.material_index = 0
        else:
            poly.material_index = 0

# Set up render
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 640

# Camera focused on face
head_world_z = 1.62
body_world_x = body.matrix_world.translation.x
cam_data = bpy.data.cameras.new("FaceCam")
cam_obj = bpy.data.objects.new("FaceCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_obj.location = Vector((body_world_x, -0.65, head_world_z))
cam_obj.rotation_euler = (math.radians(90), 0, 0)

# 3-Point Light
sun_data = bpy.data.lights.new(name="KeySun", type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new(name="KeySun", object_data=sun_data)
scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-30))

out_path = r"c:\ELD_PD_Game\blender\preview_face_eyes.png"
scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
print("Saved face render to:", out_path)

