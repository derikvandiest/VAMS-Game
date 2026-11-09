"""
Renders 4 characters side-by-side with the new calibrated hairstyles:
1. Male with Afro
2. Male with Dreads
3. Female with Afro
4. Female with Dreads
"""

import bpy
from mathutils import Vector, Euler
import math

bpy.ops.wm.read_factory_settings(use_empty=True)

world = bpy.data.worlds.new("W")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.08, 0.10, 0.14, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# 3-Point Studio Lighting
key = bpy.data.lights.new("Key", 'SUN')
key.energy = 2.4
key.color = (1.0, 0.98, 0.95)
ko = bpy.data.objects.new("Key", key)
ko.rotation_euler = Euler((math.radians(45), math.radians(15), math.radians(-30)), 'XYZ')
bpy.context.scene.collection.objects.link(ko)

fill = bpy.data.lights.new("Fill", 'AREA')
fill.energy = 90.0
fill.size = 2.5
fill.color = (0.8, 0.9, 1.0)
fo = bpy.data.objects.new("Fill", fill)
fo.location = Vector((-2.0, -2.5, 2.0))
fo.rotation_euler = Euler((math.radians(50), 0, math.radians(-35)), 'XYZ')
bpy.context.scene.collection.objects.link(fo)

front_fill = bpy.data.lights.new("FrontFill", 'AREA')
front_fill.energy = 70.0
front_fill.size = 2.0
front_fill.color = (1.0, 0.95, 0.90)
ffo = bpy.data.objects.new("FrontFill", front_fill)
ffo.location = Vector((0.0, -2.2, 1.6))
ffo.rotation_euler = Euler((math.radians(85), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(ffo)

rim = bpy.data.lights.new("Rim", 'AREA')
rim.energy = 120.0
rim.size = 2.5
rim.color = (0.9, 0.85, 1.0)
ro = bpy.data.objects.new("Rim", rim)
ro.location = Vector((0.0, 2.5, 2.2))
ro.rotation_euler = Euler((math.radians(-45), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(ro)

pairs = [
    (r"c:\ELD_PD_Game\client\public\models\character_male.glb", r"c:\ELD_PD_Game\client\public\models\hair\hair_afro_male.glb", -0.62),
    (r"c:\ELD_PD_Game\client\public\models\character_male.glb", r"c:\ELD_PD_Game\client\public\models\hair\hair_dreads_male.glb", -0.21),
    (r"c:\ELD_PD_Game\client\public\models\character_female.glb", r"c:\ELD_PD_Game\client\public\models\hair\hair_afro_female.glb", 0.21),
    (r"c:\ELD_PD_Game\client\public\models\character_female.glb", r"c:\ELD_PD_Game\client\public\models\hair\hair_dreads_female.glb", 0.62),
]

for body_path, hair_path, x_pos in pairs:
    bpy.ops.import_scene.gltf(filepath=body_path)
    b_objs = list(bpy.context.selected_objects)
    for o in b_objs:
        if o.parent is None:
            o.location.x = x_pos
            
    bpy.ops.import_scene.gltf(filepath=hair_path)
    h_objs = list(bpy.context.selected_objects)
    for o in h_objs:
        if o.parent is None:
            o.location.x = x_pos

# Camera
cam = bpy.data.cameras.new("Cam")
cam.lens = 52
cam_o = bpy.data.objects.new("Cam", cam)
cam_o.location = Vector((0.0, -2.3, 1.58))
cam_o.rotation_euler = Euler((math.radians(88), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(cam_o)
bpy.context.scene.camera = cam_o

bpy.context.scene.render.resolution_x = 1200
bpy.context.scene.render.resolution_y = 650
bpy.context.scene.render.filepath = r"C:\Users\Derik Van Diest\.gemini\antigravity\brain\2444232c-871c-4210-810a-714c9c3931c4\preview_calibrated_hairs.png"

bpy.ops.render.render(write_still=True)
print("Rendered preview_calibrated_hairs.png successfully!")

