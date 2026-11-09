"""
Inspects and renders all existing Hair.001 through Hair.011 in client/public/models/
"""

import bpy
import glob
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

key = bpy.data.lights.new("Key", 'SUN')
key.energy = 2.8
ko = bpy.data.objects.new("Key", key)
ko.rotation_euler = Euler((math.radians(45), math.radians(20), math.radians(-30)), 'XYZ')
bpy.context.scene.collection.objects.link(ko)

files = sorted(glob.glob(r"c:\ELD_PD_Game\client\public\models\Hair.*.glb"))
for idx, f in enumerate(files):
    bpy.ops.import_scene.gltf(filepath=f)
    x = (idx % 6) * 0.45 - 1.15
    y = (idx // 6) * 0.45
    # Move newly imported objects
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            # Remove icosphere if present
            if 'icosphere' in obj.name.lower():
                bpy.data.objects.remove(obj)
            else:
                obj.location = Vector((x, 0, 1.5 - y))
                obj.scale = Vector((0.25, 0.25, 0.25))

cam = bpy.data.cameras.new("Cam")
cam.lens = 45
cam_o = bpy.data.objects.new("Cam", cam)
cam_o.location = Vector((0.0, -3.2, 1.25))
cam_o.rotation_euler = Euler((math.radians(90), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(cam_o)
bpy.context.scene.camera = cam_o

bpy.context.scene.render.resolution_x = 960
bpy.context.scene.render.resolution_y = 640
bpy.context.scene.render.filepath = r"C:\Users\Derik Van Diest\.gemini\antigravity\brain\2444232c-871c-4210-810a-714c9c3931c4\preview_existing_hairs.png"

bpy.ops.render.render(write_still=True)
print("Rendered preview_existing_hairs.png successfully!")

