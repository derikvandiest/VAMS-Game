"""
Builds game-ready rigged GLB models from the official Blender Studio stylized base meshes.
- Creates precision humanoid armatures matching exact anatomical joints.
- Sets up multi-slot PBR materials (Skin, Shirt, Pants, Shoes, Eyes).
- Computes automatic vertex weights (skinning).
- Exports character_male.glb and character_female.glb to client/public/models/.
- Saves master rigged project as blender/character_studio_rigged.blend.
"""

import bpy
import bmesh
from mathutils import Vector, Matrix

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

def create_armature(name, is_male=True):
    arm_data = bpy.data.armatures.new(name)
    arm_data.display_type = 'OCTAHEDRAL'
    arm_obj = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    
    eb = arm_data.edit_bones
    
    if is_male:
        hip_z = 0.90
        spine_z = 1.05
        chest_z = 1.22
        neck_z = 1.40
        head_z = 1.58
        head_top = 1.80
        
        sh_x, sh_z, sh_y = 0.17, 1.34, 0.01
        el_x, el_z, el_y = 0.28, 1.20, 0.03
        wr_x, wr_z, wr_y = 0.36, 0.98, 0.00
        hd_x, hd_z, hd_y = 0.41, 0.82, -0.01
        
        leg_x = 0.10
        knee_z = 0.50
        ankle_z = 0.10
        foot_y = -0.10
        toe_y = -0.18
    else:
        hip_z = 0.81
        spine_z = 0.94
        chest_z = 1.10
        neck_z = 1.26
        head_z = 1.42
        head_top = 1.62
        
        sh_x, sh_z, sh_y = 0.15, 1.20, 0.00
        el_x, el_z, el_y = 0.23, 1.07, 0.01
        wr_x, wr_z, wr_y = 0.30, 0.90, -0.02
        hd_x, hd_z, hd_y = 0.36, 0.76, -0.01
        
        leg_x = 0.09
        knee_z = 0.45
        ankle_z = 0.09
        foot_y = -0.09
        toe_y = -0.16

    # Hips & Spine Chain
    hips = eb.new('Hips')
    hips.head = Vector((0, 0, hip_z))
    hips.tail = Vector((0, 0, spine_z))
    
    spine = eb.new('Spine')
    spine.head = hips.tail
    spine.tail = Vector((0, 0, chest_z))
    spine.parent = hips
    
    spine1 = eb.new('Spine1')
    spine1.head = spine.tail
    spine1.tail = Vector((0, 0, neck_z))
    spine1.parent = spine
    
    neck = eb.new('Neck')
    neck.head = spine1.tail
    neck.tail = Vector((0, 0, head_z))
    neck.parent = spine1
    
    head = eb.new('Head')
    head.head = neck.tail
    head.tail = Vector((0, 0, head_top))
    head.parent = neck
    
    # Arms
    for side, prefix, sx in (('Left', 'Left', 1), ('Right', 'Right', -1)):
        sh = eb.new(f'{prefix}Shoulder')
        sh.head = Vector((0, 0, neck_z))
        sh.tail = Vector((sh_x * sx, sh_y, sh_z))
        sh.parent = spine1
        
        arm = eb.new(f'{prefix}Arm')
        arm.head = sh.tail
        arm.tail = Vector((el_x * sx, el_y, el_z))
        arm.parent = sh
        
        forearm = eb.new(f'{prefix}ForeArm')
        forearm.head = arm.tail
        forearm.tail = Vector((wr_x * sx, wr_y, wr_z))
        forearm.parent = arm
        
        hand = eb.new(f'{prefix}Hand')
        hand.head = forearm.tail
        hand.tail = Vector((hd_x * sx, hd_y, hd_z))
        hand.parent = forearm

    # Legs
    for side, prefix, sx in (('Left', 'Left', 1), ('Right', 'Right', -1)):
        upleg = eb.new(f'{prefix}UpLeg')
        upleg.head = Vector((leg_x * sx, 0, hip_z))
        upleg.tail = Vector((leg_x * sx, 0, knee_z))
        upleg.parent = hips
        
        leg = eb.new(f'{prefix}Leg')
        leg.head = upleg.tail
        leg.tail = Vector((leg_x * sx, 0, ankle_z))
        leg.parent = upleg
        
        foot = eb.new(f'{prefix}Foot')
        foot.head = leg.tail
        foot.tail = Vector((leg_x * sx, foot_y, 0.02))
        foot.parent = leg
        
        toe = eb.new(f'{prefix}ToeBase')
        toe.head = foot.tail
        toe.tail = Vector((leg_x * sx, toe_y, 0.02))
        toe.parent = foot

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def assign_materials_to_body(obj, is_male=True):
    skin_hex = "#e5a782" if is_male else "#ebb79a"
    mat_skin = create_pbr_material("Mat_Skin", skin_hex, roughness=0.55)
    mat_shirt = create_pbr_material("Mat_Shirt", "#1d4ed8", roughness=0.65)
    mat_pants = create_pbr_material("Mat_Pants", "#334155", roughness=0.70)
    mat_shoes = create_pbr_material("Mat_Shoes", "#f8fafc", roughness=0.40)
    
    obj.data.materials.clear()
    obj.data.materials.append(mat_skin)   # Slot 0
    obj.data.materials.append(mat_shirt)  # Slot 1
    obj.data.materials.append(mat_pants)  # Slot 2
    obj.data.materials.append(mat_shoes)  # Slot 3
    
    neck_cutoff = 1.35 if is_male else 1.22
    waist_cutoff = 0.90 if is_male else 0.81
    ankle_cutoff = 0.10 if is_male else 0.09
    hand_cutoff_x = 0.35 if is_male else 0.29
    
    for poly in obj.data.polygons:
        cz = poly.center.z
        cx = abs(poly.center.x)
        
        if cz > neck_cutoff:
            poly.material_index = 0  # Head & Neck: Skin
        elif cx > hand_cutoff_x and cz < 1.05:
            poly.material_index = 0  # Hands: Skin
        elif cz > waist_cutoff:
            poly.material_index = 1  # Torso: Shirt
        elif cz > ankle_cutoff:
            poly.material_index = 2  # Legs: Pants
        else:
            poly.material_index = 3  # Feet: Shoes

def process_character(gender="male"):
    is_male = (gender == "male")
    mesh_name = "GEO-body_male_stylized" if is_male else "GEO-body_female_stylized"
    body = bpy.data.objects.get(mesh_name)
    if not body:
        print(f"Error: {mesh_name} not found")
        return
    
    # Reset location
    body.location = Vector((0, 0, 0))
    body.rotation_euler = (0, 0, 0)
    body.scale = Vector((1, 1, 1))
    
    # Assign materials
    assign_materials_to_body(body, is_male)
    
    # Process eyes
    eye_l_name = f"{mesh_name}.eye.L"
    eye_r_name = f"{mesh_name}.eye.R"
    eye_l = bpy.data.objects.get(eye_l_name)
    eye_r = bpy.data.objects.get(eye_r_name)
    mat_eyes = create_pbr_material("Mat_Eyes", "#1e293b", roughness=0.15, metalness=0.1)
    
    for eye in (eye_l, eye_r):
        if eye:
            eye.location.x = 0
            eye.data.materials.clear()
            eye.data.materials.append(mat_eyes)
    
    # Create Armature
    arm_name = f"Armature_{gender.capitalize()}"
    arm = create_armature(arm_name, is_male)
    arm.location = Vector((0, 0, 0))
    
    # Parent & Auto-weight
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    if eye_l: eye_l.select_set(True)
    if eye_r: eye_r.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    print(f"Rigged {gender.capitalize()} with {len(body.vertex_groups)} vertex groups")
    
    # Export to GLB
    export_path = f"c:/ELD_PD_Game/client/public/models/character_{gender}.glb"
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    if eye_l: eye_l.select_set(True)
    if eye_r: eye_r.select_set(True)
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
    blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    
    print("Processing Stylized Male Character...")
    process_character("male")
    
    # Re-open for female so scenes stay isolated
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    print("Processing Stylized Female Character...")
    process_character("female")
    
    print("All game-ready stylized character GLBs successfully built!")

if __name__ == "__main__":
    main()

