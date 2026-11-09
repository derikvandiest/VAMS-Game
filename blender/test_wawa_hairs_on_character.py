"""
Tests 4 hairstyles aligned to character_male.glb in Blender:
1. Hair.001 (Cropped fade)
2. Hair.002 (Textured crop)
3. Hair.004 (Side-parted business cut)
4. Hair.007 (Afro / textured curls)
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

key = bpy.data.lights.new("Key", 'SUN')
key.energy = 2.6
ko = bpy.data.objects.new("Key", key)
ko.rotation_euler = Euler((math.radians(45), math.radians(20), math.radians(-30)), 'XYZ')
bpy.context.scene.collection.objects.link(ko)

fill = bpy.data.lights.new("Fill", 'AREA')
fill.energy = 80.0
fill.size = 2.0
fo = bpy.data.objects.new("Fill", fill)
fo.location = Vector((-2.0, -2.5, 2.0))
fo.rotation_euler = Euler((math.radians(50), 0, math.radians(-35)), 'XYZ')
bpy.context.scene.collection.objects.link(fo)

hairs = [
    ("Hair.001.glb", "Hair.001"),
    ("Hair.002.glb", "Hair.002"),
    ("Hair.004.glb", "Hair.004"),
    ("Hair.007.glb", "Hair.007"),
]

# Head landmark for male
crown_z = 1.794
eye_z = 1.578
skull_center = Vector((0, -0.015, 1.66))

for idx, (h_file, label) in enumerate(hairs):
    x_offset = (idx - 1.5) * 0.42
    
    # Import character
    bpy.ops.import_scene.gltf(filepath=r"c:\ELD_PD_Game\client\public\models\character_male.glb")
    char_objs = list(bpy.context.selected_objects)
    for o in char_objs:
        if o.parent is None:
            o.location.x = x_offset
            
    # Import hair
    h_path = f"c:\\ELD_PD_Game\\client\\public\\models\\{h_file}"
    bpy.ops.import_scene.gltf(filepath=h_path)
    hair_objs = [o for o in bpy.context.selected_objects if o.type == 'MESH' and 'icosphere' not in o.name.lower()]
    for ho in hair_objs:
        # Scale to match head proportions: Wawa head sx=0.68, male sx=0.174 => scale ~0.256
        ho.scale = Vector((0.256, 0.260, 0.256))
        ho.location = Vector((x_offset, -0.015, 1.66))
        
        # Hair color material
        mat = bpy.data.materials.new(name=f"Mat_{label}")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.05, 0.03, 0.02, 1.0)
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.8
        ho.data.materials.clear()
        ho.data.materials.append(mat)

# Camera framing
cam = bpy.data.cameras.new("Cam")
cam.lens = 50
cam_o = bpy.data.objects.new("Cam", cam)
cam_o.location = Vector((0.0, -2.4, 1.62))
cam_o.rotation_euler = Euler((math.radians(88), 0, 0), 'XYZ')
bpy.context.scene.collection.objects.link(cam_o)
bpy.context.scene.camera = cam_o

bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 600
bpy.context.scene.render.filepath = r"C:\Users\Derik Van Diest\.gemini\antigravity\brain\2444232c-871c-4210-810a-714c9c3931c4\preview_fitted_hairs.png"

bpy.ops.render.render(write_still=True)
print("Rendered preview_fitted_hairs.png successfully!")
