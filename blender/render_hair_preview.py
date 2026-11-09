"""
Renders a preview of the new custom hairstyles on the Stylized Character Heads.
"""

import bpy
from mathutils import Vector, Euler
import math

bpy.ops.wm.read_factory_settings(use_empty=True)

# World
world = bpy.data.worlds.new("HairPreviewWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.08, 0.10, 0.14, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# Lighting
key = bpy.data.lights.new("Key", 'SUN')
key.energy = 2.8
key.color = (1.0, 0.98, 0.95)
ko = bpy.data.objects.new("Key", key)
ko.rotation_euler = Euler((math.radians(45), math.radians(20), math.radians(-30)), 'XYZ')
bpy.context.scene.collection.objects.link(ko)

fill = bpy.data.lights.new("Fill", 'AREA')
fill.energy = 120.0
fill.size = 2.5
fill.color = (0.75, 0.88, 1.0)
fo = bpy.data.objects.new("Fill", fill)
fo.location = Vector((-2.0, -2.5, 2.0))
fo.rotation_euler = Euler((math.radians(50), 0, math.radians(-35)), 'XYZ')
bpy.context.scene.collection.objects.link(fo)

rim = bpy.data.lights.new("Rim", 'AREA')
rim.energy = 160.0
rim.size = 2.5
rim.color = (0.9, 0.85, 1.0)
ro = bpy.data.objects.new("Rim", rim)
ro.location = Vector((0.0, 2.5, 2.2))
ro.rotation_euler = Euler((math.radians(-45), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(ro)

# 1. Male Head with Dreads
bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\character_male.glb")
bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\hair\hair_dreads_male.glb")
for obj in bpy.context.scene.objects:
    if obj.parent is None:
        obj.location.x = -0.38

# 2. Female Head with Afro
bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\character_female.glb")
bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\hair\hair_afro_female.glb")
for obj in bpy.context.scene.objects:
    if obj.parent is None and obj.location.x == 0.0:
        obj.location.x = 0.38

# Camera framing on heads
cam = bpy.data.cameras.new("Cam")
cam.lens = 65
cam_o = bpy.data.objects.new("Cam", cam)
cam_o.location = Vector((0.0, -2.0, 1.58))
cam_o.rotation_euler = Euler((math.radians(88), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(cam_o)
bpy.context.scene.camera = cam_o

bpy.context.scene.render.resolution_x = 960
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.filepath = r"C:\Users\Derik Van Diest\.gemini\antigravity\brain\2444232c-871c-4210-810a-714c9c3931c4\preview_hairstyles.png"

bpy.ops.render.render(write_still=True)
print("Rendered preview_hairstyles.png successfully!")

