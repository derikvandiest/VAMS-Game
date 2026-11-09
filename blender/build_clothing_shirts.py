"""
Generates 4 optimized 3D shirt options for both Male and Female character models in Blender:
1. Top.ButtonUp (Classic Collared Button-Up Shirt)
2. Top.Polo (Campus Polo Shirt with short sleeves)
3. Top.Sweater (Academic Crewneck Sweater)
4. Top.Blazer (Professional Tailored Suit Blazer with lapels)

Rigged with the character armature and exported as GLBs to client/public/models/clothes/.
"""

import bpy
import bmesh
from mathutils import Vector, Matrix
import math
import sys
sys.path.append(r"c:\ELD_PD_Game\blender")

def create_pbr_material(name, hex_color, roughness=0.6, metalness=0.0):
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

def get_torso_bmesh(source_mesh, is_male, style="ButtonUp"):
    bm = bmesh.new()
    bm.from_mesh(source_mesh.data)
    
    waist_z = 0.88 if is_male else 0.79
    wrist_cutoff_x = 0.38 if is_male else 0.32
    short_sleeve_cutoff_x = 0.28 if is_male else 0.24
    
    # 1. Delete vertices that don't belong to the shirt
    verts_to_delete = []
    for v in bm.verts:
        # Delete lower body below waist
        if v.co.z < waist_z:
            verts_to_delete.append(v)
            continue
            
        cx = abs(v.co.x)
        cz = v.co.z
        cy = v.co.y
        
        # Anatomical neck opening - keeps full shoulders, trapezius, clavicle, and chest
        if is_male:
            if cx < 0.065 and cy < -0.04 and cz > 1.43:
                verts_to_delete.append(v)
                continue
            if cx < 0.080 and cz > 1.47:
                verts_to_delete.append(v)
                continue
            if cz > 1.50:
                verts_to_delete.append(v)
                continue
        else:
            if cx < 0.055 and cy < -0.035 and cz > 1.30:
                verts_to_delete.append(v)
                continue
            if cx < 0.075 and cz > 1.34:
                verts_to_delete.append(v)
                continue
            if cz > 1.37:
                verts_to_delete.append(v)
                continue
            
        # Short sleeves for Polo
        if style == "Polo":
            if cx > short_sleeve_cutoff_x:
                verts_to_delete.append(v)
        else:
            # Delete hands (below wrists)
            if cx > wrist_cutoff_x and cz < 0.95:
                verts_to_delete.append(v)

    bmesh.ops.delete(bm, geom=verts_to_delete, context='VERTS')
    
    # 2. Offset / inflate outward along vertex normals (+5mm) so it sits cleanly on top of skin
    offset_dist = 0.0050
    if style == "Blazer":
        offset_dist = 0.0075  # Blazers are thicker and sit outside shirts
        
    for v in bm.verts:
        v.co += v.normal * offset_dist
        if style == "Blazer" and v.co.z > (1.35 if is_male else 1.22) and abs(v.co.x) > 0.12:
            # Subtle shoulder pad structure
            v.co.z += 0.006
            v.co.x += (0.005 if v.co.x > 0 else -0.005)

    # 3. Add Style-Specific 3D Details
    collar_y = -0.075 if is_male else -0.070
    collar_z = 1.45 if is_male else 1.32
    collar_r = 0.065 if is_male else 0.055
    
    if style in ("ButtonUp", "Polo"):
        # Extruded folded collar ring around neck
        bmesh.ops.create_cone(
            bm, cap_ends=False, segments=20,
            radius1=collar_r * 1.05, radius2=collar_r * 1.15,
            depth=0.035,
            matrix=Matrix.Translation(Vector((0, collar_y, collar_z))) @ Matrix.Rotation(math.radians(14), 4, 'X')
        )
        # Front placket strip
        placket_w = 0.015
        placket_bot = waist_z + 0.02 if style == "ButtonUp" else waist_z + 0.18
        p1 = bm.verts.new(Vector((-placket_w, collar_y - 0.035, collar_z)))
        p2 = bm.verts.new(Vector((placket_w, collar_y - 0.035, collar_z)))
        p3 = bm.verts.new(Vector((placket_w, collar_y - 0.032, placket_bot)))
        p4 = bm.verts.new(Vector((-placket_w, collar_y - 0.032, placket_bot)))
        bm.faces.new([p1, p2, p3, p4])
        
    elif style == "Sweater":
        # Ribbed crewneck ring
        bmesh.ops.create_cone(
            bm, cap_ends=False, segments=22,
            radius1=collar_r * 1.02, radius2=collar_r * 1.06,
            depth=0.025,
            matrix=Matrix.Translation(Vector((0, collar_y, collar_z + 0.01))) @ Matrix.Rotation(math.radians(10), 4, 'X')
        )
        # Waistband hem ring
        bmesh.ops.create_cone(
            bm, cap_ends=False, segments=24,
            radius1=0.16 if is_male else 0.14, radius2=0.16 if is_male else 0.14,
            depth=0.040,
            matrix=Matrix.Translation(Vector((0, 0, waist_z + 0.02)))
        )
        
    elif style == "Blazer":
        # Lapels on Left and Right
        lapel_w = 0.042
        lapel_top_z = collar_z + 0.01
        lapel_mid_z = collar_z - 0.15
        lapel_bot_z = waist_z + 0.10
        lapel_y = collar_y - 0.035
        
        # Left Lapel
        l1 = bm.verts.new(Vector((0.015, lapel_y, lapel_top_z)))
        l2 = bm.verts.new(Vector((0.015 + lapel_w, lapel_y, lapel_mid_z)))
        l3 = bm.verts.new(Vector((0.005, lapel_y + 0.005, lapel_bot_z)))
        bm.faces.new([l1, l2, l3])
        
        # Right Lapel
        r1 = bm.verts.new(Vector((-0.015, lapel_y, lapel_top_z)))
        r2 = bm.verts.new(Vector((-0.015 - lapel_w, lapel_y, lapel_mid_z)))
        r3 = bm.verts.new(Vector((-0.005, lapel_y + 0.005, lapel_bot_z)))
        bm.faces.new([r1, r3, r2])

    return bm

def build_and_export_shirt(source_blend, gender, style):
    bpy.ops.wm.open_mainfile(filepath=source_blend)
    is_male = (gender == "male")
    mesh_name = "GEO-body_male_stylized" if is_male else "GEO-body_female_stylized"
    body = bpy.data.objects.get(mesh_name)
    if not body:
        print(f"Error: {mesh_name} not found")
        return
        
    body.matrix_world.translation = Vector((0, 0, 0))
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    # Build shirt geometry
    bm = get_torso_bmesh(body, is_male, style)
    shirt_mesh = bpy.data.meshes.new(f"Top_{style}_{gender.capitalize()}")
    bm.to_mesh(shirt_mesh)
    bm.free()
    
    shirt_obj = bpy.data.objects.new(f"Top_{style}_{gender.capitalize()}", shirt_mesh)
    bpy.context.scene.collection.objects.link(shirt_obj)
    
    for p in shirt_mesh.polygons:
        p.use_smooth = True
        
    # Assign materials
    mat_shirt = create_pbr_material("Mat_Shirt", "#1d4ed8", roughness=0.65)
    mat_accent = create_pbr_material("Mat_Shirt_Accent", "#f8fafc", roughness=0.40)
    shirt_obj.data.materials.append(mat_shirt)
    shirt_obj.data.materials.append(mat_accent)
    
    # Import the Armature
    from build_characters_fixed_eyes import create_armature
    arm_name = f"Armature_{gender.capitalize()}"
    arm = create_armature(arm_name, is_male)
    arm.location = Vector((0, 0, 0))
    
    # Parent shirt to armature with auto weights
    bpy.ops.object.select_all(action='DESELECT')
    shirt_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    # Export GLB
    style_slug = style.lower()
    export_path = f"c:/ELD_PD_Game/client/public/models/clothes/top_{style_slug}_{gender}.glb"
    bpy.ops.object.select_all(action='DESELECT')
    shirt_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        use_selection=True,
        export_format='GLB',
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_yup=True
    )
    print(f"Exported: {export_path}")

def main():
    source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
    styles = ["ButtonUp", "Polo", "Sweater", "Blazer"]
    genders = ["male", "female"]
    
    for g in genders:
        for s in styles:
            print(f"Generating Top: {s} for {g.capitalize()}...")
            build_and_export_shirt(source_blend, g, s)
            
    print("ALL SHIRTS GENERATED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
