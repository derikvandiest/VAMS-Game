import bpy

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
dest_blend = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Link / append stylized male and female from bundle
objects_to_import = [
    "GEO-body_male_stylized",
    "GEO-body_male_stylized.eye.L",
    "GEO-body_male_stylized.eye.R",
    "GEO-body_female_stylized",
    "GEO-body_female_stylized.eye.L",
    "GEO-body_female_stylized.eye.R",
]

with bpy.data.libraries.load(source_blend, link=False) as (data_from, data_to):
    data_to.objects = [name for name in objects_to_import if name in data_from.objects]

col_male = bpy.data.collections.new("Stylized_Male")
col_female = bpy.data.collections.new("Stylized_Female")
bpy.context.scene.collection.children.link(col_male)
bpy.context.scene.collection.children.link(col_female)

for obj in data_to.objects:
    # Clear invalid drivers/modifiers if any
    obj.animation_data_clear()
    for m in list(obj.modifiers):
        if m.type == 'MASK':
            obj.modifiers.remove(m)
            
    if "female" in obj.name.lower():
        col_female.objects.link(obj)
        obj.location.x = 0.5
    else:
        col_male.objects.link(obj)
        obj.location.x = -0.5

# Save clean blend file
bpy.ops.wm.save_as_mainfile(filepath=dest_blend)
print("SUCCESS: Saved clean stylized base meshes to", dest_blend)

