import bpy
import math
from mathutils import Vector

blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

# Set up clean camera and lighting for preview
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 800
scene.render.resolution_y = 600

# Add Camera
cam_data = bpy.data.cameras.new("PreviewCam")
cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_obj.location = Vector((0, -2.8, 1.1))
cam_obj.rotation_euler = (math.radians(82), 0, 0)

# Add Light
light_data = bpy.data.lights.new(name="PreviewLight", type='SUN')
light_data.energy = 3.5
light_obj = bpy.data.objects.new(name="PreviewLight", object_data=light_data)
scene.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(25), math.radians(-30))

# Simple clean material for base mesh preview
mat = bpy.data.materials.new("ClayPreview")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.75, 0.70, 0.65, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.5

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.data.materials.clear()
        obj.data.materials.append(mat)

# Render to file
out_path = r"c:\ELD_PD_Game\blender\preview_stylized.png"
scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
print("Rendered preview to:", out_path)
