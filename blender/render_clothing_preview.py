"""
Renders side-by-side preview of Male and Female stylized models wearing the new 3D shirts:
- Male: Campus Short-Sleeve Polo Shirt with rich warm tan skin tone
- Female: Tailored Suit Blazer with porcelain skin tone
"""

import bpy
from mathutils import Vector, Euler
import math

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. World setup
world = bpy.data.worlds.new("PreviewWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.07, 0.09, 0.13, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# 2. Studio Lighting
key_data = bpy.data.lights.new(name="KeyLight", type='SUN')
key_data.energy = 2.4
key_data.color = (1.0, 0.98, 0.95)
key_obj = bpy.data.objects.new("KeyLight", key_data)
key_obj.rotation_euler = Euler((math.radians(45), math.radians(15), math.radians(-30)), 'XYZ')
bpy.context.scene.collection.objects.link(key_obj)

fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 100.0
fill_data.size = 3.0
fill_data.color = (0.75, 0.88, 1.0)
fill_obj = bpy.data.objects.new("FillLight", fill_data)
fill_obj.location = Vector((-2.5, -2.5, 2.0))
fill_obj.rotation_euler = Euler((math.radians(50), 0, math.radians(-35)), 'XYZ')
bpy.context.scene.collection.objects.link(fill_obj)

rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 150.0
rim_data.size = 2.5
rim_data.color = (0.9, 0.85, 1.0)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
rim_obj.location = Vector((0.0, 2.5, 2.2))
rim_obj.rotation_euler = Euler((math.radians(-45), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(rim_obj)

# 3. Import Male Character + Polo Shirt
bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\character_male.glb")
male_imported = list(bpy.context.selected_objects)

bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\clothes\top_polo_male.glb")
polo_imported = list(bpy.context.selected_objects)

# Find root armature / top parents for male and shift by -0.42m
for obj in male_imported + polo_imported:
    if obj.parent is None:
        obj.location.x = -0.42

# 4. Import Female Character + Blazer
bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\character_female.glb")
female_imported = list(bpy.context.selected_objects)

bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\clothes\top_blazer_female.glb")
blazer_imported = list(bpy.context.selected_objects)

# Find root armature / top parents for female and shift by +0.42m
for obj in female_imported + blazer_imported:
    if obj.parent is None:
        obj.location.x = 0.42

# 5. Camera setup
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 48
cam_obj = bpy.data.objects.new("Cam", cam_data)
cam_obj.location = Vector((0.0, -3.1, 1.15))
cam_obj.rotation_euler = Euler((math.radians(88), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# 6. Render
bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 810
bpy.context.scene.render.filepath = r"C:\Users\Derik Van Diest\.gemini\antigravity\brain\2444232c-871c-4210-810a-714c9c3931c4\preview_clothing_models.png"

bpy.ops.render.render(write_still=True)
print("Rendered preview_clothing_models.png successfully!")
