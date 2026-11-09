import bpy

blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

for name in ["GEO-body_male_stylized", "GEO-body_female_stylized"]:
    obj = bpy.data.objects.get(name)
    if obj:
        print(f"=== {name} ===")
        print("  Materials:", [m.name for m in obj.data.materials if m])
        print("  UV Layers:", [uv.name for uv in obj.data.uv_layers])
        print("  Color attributes:", [ca.name for ca in obj.data.color_attributes])

